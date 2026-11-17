"""
RAG ② 검색 + 근거 인용 답변 (청년 주거 정책)
  1) 코드 필터: 나이 · 지역(전국/서울/내 자치구) · 지난 공고 제외
  2) 검색: TF-IDF(글자 2~3그램, 한국어에 강함) [+ 임베딩, 설정 시] → 정책 단위로 묶기
  3) 답변: LLM이 '찾은 원문만' 보고 답 + [번호] 인용
     → 숫자 검사(원문에 없는 금액·기간이면 버림) → 실패 시 원문 문장 그대로 보여주는 추출형 답변

사용:
  from rag import Rag
  r = Rag()                                   # processed/rag/ 색인 읽기
  r.search("고시원 사는데 이사 지원 있어?", profile)
  r.answer("직장 1년 안 됐는데 버팀목 한도는?", profile)
  python scripts/rag.py "질문"                 # 터미널에서 바로 물어보기

환경변수 (.env)
  LLM_API_KEY / LLM_BASE_URL / LLM_MODEL   비워 두면 추출형 답변
  EMBED_BACKEND = none(기본) | openai | st   임베딩 섞기 (openai: text-embedding-3-small, st: sentence-transformers)
  EMBED_MODEL   = st일 때 모델 이름 (기본 intfloat/multilingual-e5-small)
"""
import json
import os
import pickle
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import common
    common.load_env()
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(BASE, "processed", "rag")
REF_YEAR = 2026

SYN = {  # 사람들이 쓰는 말 → 공고문에 쓰는 말
    "전세대출": "버팀목 전세자금 대출", "전세 대출": "버팀목 전세자금 대출", "버팀목": "버팀목 전세자금",
    "월세대출": "보증부월세대출 월세 대출", "청년주택": "청년안심주택", "안심주택": "청년안심주택",
    "이사비": "이사비 중개보수", "복비": "중개보수", "보증보험": "전세보증금반환보증 보증료",
    "고시원": "고시원 주거상향 이주", "lh": "LH 한국토지주택공사 매입임대 전세임대", "sh": "SH 서울주택도시공사",
    "집이어야": "대상 주택 보증금 월세 이하", "어떤 집": "대상 주택 보증금 월세 이하", "몇 살": "세 이상 이하 연령 나이 대상", "나이": "세 이상 이하 연령 대상", "한도": "한도 최대", "금리": "금리 연소득", "임대료": "임대료 수준 시중시세", "순위": "순위 소득",
    "1년": "재직 1년 미만 한도 공통 규칙", "재직": "재직 1년 미만 한도 공통 규칙", "신입": "재직 1년 미만 한도 공통 규칙",
    "같이 받": "중복 수혜", "중복": "중복 수혜", "언제까지": "신청 기간 기한", "얼마": "지원 내용 금액 한도",
}
CURATED = {"시연 정책": 0.06, "주택도시기금": 0.06, "SH": 0.06}   # 검증해 둔 문서는 살짝 우대


LOAN_WORDS = ("대출", "버팀목", "보증부")


def expand(q):
    ql = q.lower()
    loan = any(w in ql for w in LOAN_WORDS)
    x = q + " " + " ".join(v for k, v in SYN.items() if k in ql and not (loan and v == "중복 수혜"))   # 대출끼리 중복은 대출 공통 규칙에서
    if loan:                      # 대출 질문 + 같이/언제 → 공통 규칙(중복·신청 시기)
        if re.search(r"같이|동시|중복|둘 ?다", ql):
            x += " 공통 규칙 중복 동시에 받을 수 없음"
        if re.search(r"언제|기간|기한|시기", ql):
            x += " 공통 규칙 신청 시기 잔금일 전입일 3개월 이내"
    if re.search(r"입주|언제", ql) and re.search(r"안심주택|청년주택|sh", ql):
        x += " 일정 공고 신청 당첨 발표 계약 입주"
    return x


# ───────────── 색인 ─────────────
def _vectorizer():
    from sklearn.feature_extraction.text import TfidfVectorizer
    return TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3), sublinear_tf=True, min_df=2, max_features=400000)


def _embed(texts, backend):
    if backend == "openai":
        import urllib.request
        key, base = os.environ["LLM_API_KEY"], os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
        out = []
        for i in range(0, len(texts), 256):
            body = json.dumps({"model": os.environ.get("EMBED_MODEL", "text-embedding-3-small"), "input": texts[i:i + 256]}).encode()
            req = urllib.request.Request(f"{base.rstrip('/')}/embeddings", data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                out += [d["embedding"] for d in json.loads(r.read())["data"]]
        v = np.array(out, dtype="float32")
    else:
        from sentence_transformers import SentenceTransformer
        m = SentenceTransformer(os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small"))
        v = m.encode([("passage: " + t) for t in texts], batch_size=64, normalize_embeddings=True, show_progress_bar=True)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def build_index(chunks, out=IDX):
    docs = [f"{c['name']} {c['section']} {c['text']}" for c in chunks]
    vec = _vectorizer()
    X = vec.fit_transform(docs)
    with open(os.path.join(out, "index.pkl"), "wb") as f:
        pickle.dump({"vec": vec, "X": X}, f)
    backend = os.environ.get("EMBED_BACKEND", "none")
    if backend != "none":
        np.save(os.path.join(out, "emb.npy"), _embed(docs, backend))


# ───────────── 검색 ─────────────
class Rag:
    def __init__(self, idx=IDX):
        with open(os.path.join(idx, "chunks.jsonl"), encoding="utf-8") as f:
            self.chunks = [json.loads(l) for l in f]
        with open(os.path.join(idx, "index.pkl"), "rb") as f:
            d = pickle.load(f)
        self.vec, self.X = d["vec"], d["X"]
        ep = os.path.join(idx, "emb.npy")
        self.backend = os.environ.get("EMBED_BACKEND", "none")
        self.E = np.load(ep) if os.path.exists(ep) and self.backend != "none" else None

    # ① 코드 필터
    @staticmethod
    def _named(c, q):
        """질문에 정책 이름이 직접 나오면 True (예: '국토부 청년월세')"""
        key = re.sub(r"[()]|\d{4}|지원|사업|운영|\s", "", c["name"])     # '(국토부)'도 이름에 포함 → '서울시 청년월세' 질문에 국토부가 끼지 않게
        qn = re.sub(r"\s", "", q)
        if len(key) < 3 or key not in qn:
            return False
        pre = qn[:qn.index(key)][-3:]                          # '서울시 청년월세'라고 물었는데 국토부 '청년월세 지원'이 걸리지 않게
        org = c.get("org", "") + c["name"]
        if ("서울" in pre and "서울" not in org) or (("국토" in pre or "정부" in pre) and "서울" in org):
            return False
        return True

    @staticmethod
    def _age(profile, q):
        m = re.search(r"(?:만\s*)?(\d{2})\s*(?:살|세)", q)          # "35살인데" → 질문 속 나이가 우선
        return int(m.group(1)) if m else (profile or {}).get("age")

    def _allowed(self, c, profile, q):
        age = self._age(profile, q)
        if age and not self._named(c, q):                      # 이름을 콕 집어 물으면 나이가 안 맞아도 남기고 '나이 확인'을 붙임
            if c["age_min"] and age < c["age_min"]:
                return False
            if c["age_max"] and age > c["age_max"]:
                return False
        reg = c["region"]
        if reg.startswith("서울-"):
            gu = reg.split("-", 1)[1]
            mine = (profile or {}).get("area", {}).get("gu")
            if gu != mine and gu not in q:
                return False
        end = (c.get("apply") or {}).get("end")
        if end and end < f"{REF_YEAR}-01-01":
            return False
        return True

    def search(self, q, profile=None, k=5, per_policy=2):
        qx = expand(q)
        s = (self.X @ self.vec.transform([qx]).T).toarray().ravel()
        if self.E is not None:
            qe = _embed(["query: " + qx], self.backend)[0] if self.backend == "st" else _embed([qx], self.backend)[0]
            s = 0.5 * s / (s.max() or 1) + 0.5 * (self.E @ qe)
        for i, c in enumerate(self.chunks):
            if c["source"] in CURATED:
                s[i] += CURATED[c["source"]]
        order = np.argsort(-s)
        pols, out = {}, []
        for i in order[:3000]:
            c = self.chunks[i]
            if s[i] <= 0 or not self._allowed(c, profile, q):
                continue
            p = pols.setdefault(c["policy_id"], {"policy_id": c["policy_id"], "name": c["name"], "org": c["org"], "source": c["source"],
                                                 "url": c["url"], "apply": c.get("apply"), "score": float(s[i]), "chunks": []})
            if len(p["chunks"]) < per_policy:
                p["chunks"].append({"section": c["section"], "text": c["text"], "score": float(s[i])})
            if p not in out:
                out.append(p)
            if len(out) >= k and all(len(x["chunks"]) >= 1 for x in out[:k]):
                if len(out) > k + 10:
                    break
        return sorted(out, key=lambda x: -x["score"])[:k]

    # ② 답변
    def answer(self, q, profile=None, k=4):
        age0 = self._age(profile, q)
        if age0 and not 19 <= age0 <= 39:                      # 청년(만 19~39세) 밖이면 검색하지 않고 코드가 바로 안내
            return {"answer": f"첫집 내비는 만 19~39세 청년의 첫 집 지원을 다뤄요. 만 {age0}세는 여기서 찾는 청년 주거 지원의 나이 조건에 맞지 않아요. "
                              "다른 연령 주거 지원은 복지로(129)나 120 다산콜센터에 문의해 보세요.",
                    "citations": [], "found": False, "mode": "코드 판정", "sources": [], "policies": []}
        hits = self.search(q, profile, k=k, per_policy=4)
        ctx, refs = [], []
        age = self._age(profile, q)
        rr = rent_check(q)                                     # 서울시 청년월세 월세·보증금 조건도 코드가 계산해서 근거로 붙임
        if rr:
            refs.append({"n": 1, "name": "2026 서울시 청년월세 지원", "org": "서울특별시", "section": "월세 조건 확인 (코드 판정)",
                         "text": rr, "url": "https://youth.seoul.go.kr/content.do?key=2310100046", "source": "코드 판정"})
        seen = set()
        for h in hits:                                         # 나이 판정은 코드가 해서 근거로 붙임 (AI가 계산하지 않게)
            c0 = next(c for c in self.chunks if c["policy_id"] == h["policy_id"])
            lo, hi = c0["age_min"], c0["age_max"]
            same = (lo, hi, re.sub(r"\(.*?\)|\d{4}|지원|사업|운영|\s", "", h["name"]))   # 온통청년·정부24에 같은 정책이 두 번 있으면 한 번만
            asks_age = re.search(r"\d{2}\s*(살|세)|나이|몇\s*살", q) or self._named(c0, q)   # 나이를 묻거나 그 정책을 콕 집어 물을 때만 (다른 질문에 끼어들지 않게)
            if age and asks_age and ((lo and age < lo) or (hi and age > hi)) and same not in seen:
                seen.add(same)
                refs.append({"n": len(refs) + 1, "name": h["name"], "org": h["org"], "section": "나이 확인 (코드 판정)",
                             "text": f"{h['name']}은 만 {lo or '?'}~{hi or '?'}세가 대상이라, 만 {age}세는 대상이 아니에요.", "url": h["url"], "source": "코드 판정", "policy_id": h["policy_id"]})
        today = os.environ.get("DEMO_DATE", "2026-11-21")
        for h in hits:
            ap = h.get("apply") or {}                              # 접수 상태도 코드가 날짜로 판정해서 근거로 붙임
            st, en = ap.get("start"), ap.get("end")
            if en and re.match(r"\d{4}-\d{2}-\d{2}$", str(en)):
                if en < today:
                    txt = f"{h['name']}의 올해 신청 기간({st or ''}~{en})은 {today} 기준으로 끝났어요. 내년 공고가 나오면 신청할 수 있어요."
                elif st and st > today:
                    txt = f"{h['name']}은 {st}부터 신청할 수 있어요 ({today} 기준 아직 시작 전)."
                else:
                    txt = f"{h['name']}은 {today} 기준으로 지금 신청할 수 있어요 (마감 {en})."
                refs.append({"n": len(refs) + 1, "name": h["name"], "org": h["org"], "section": "신청 상태 (코드 판정)", "text": txt, "url": h["url"], "source": "코드 판정", "policy_id": h["policy_id"]})
            for c in h["chunks"]:
                refs.append({"n": len(refs) + 1, "name": h["name"], "org": h["org"], "section": c["section"], "text": c["text"], "url": h["url"], "source": h["source"], "policy_id": h["policy_id"]})
        ctx = "\n".join(f"[{r['n']}] ({r['name']} · {r['section']}) {r['text']}" for r in refs)
        res = None
        if os.environ.get("LLM_API_KEY"):
            try:
                res = self._llm(q, ctx, profile)
                bad = bad_numbers(res.get("answer", ""), ctx + " " + q + " " + json.dumps(profile or {}, ensure_ascii=False) + (f" 만 {age}세" if age else "") + " " + os.environ.get("DEMO_DATE", "2026-11-21"))   # 사용자 나이(27세)는 근거로 인정
                cites = [n for n in res.get("citations", []) if 1 <= n <= len(refs)]
                if bad or (res.get("found", True) and not cites):
                    res = {**extractive(q, refs, self.vec), "memo": f"AI 답에 근거 없는 숫자/인용 {bad or '없음'} → 원문 답변으로 대체"}
                elif rr and conflict(rr, res.get("answer", "")):
                    # 코드 판정(월세 조건)과 AI 결론이 반대면 코드 판정을 답으로
                    res = {"answer": rr + " [1]", "citations": [1], "found": True, "mode": "AI", "memo": "AI 결론이 코드 판정과 달라서 코드 판정으로 대체"}
                else:
                    res = {"answer": re.sub(r"(\[\d+\])(\.?)\]+", r"\1\2", res["answer"]), "citations": cites, "found": res.get("found", True), "mode": "AI"}
            except Exception as e:
                res = {**extractive(q, refs, self.vec), "memo": f"AI 호출 실패: {e}"}
        if res is None:
            res = extractive(q, refs, self.vec)
        res["sources"] = ([r for r in refs if r["n"] in res.get("citations", [])] or refs[:2]) if res.get("found", True) else []   # 못 찾았으면 엉뚱한 근거는 안 보여줌
        res["policies"] = [{k: h[k] for k in ("policy_id", "name", "org", "source", "url", "score")} for h in hits]
        return res

    def _llm(self, q, ctx, profile):
        import urllib.request
        sysmsg = ANSWER_PROMPT
        user = f"[오늘] {os.environ.get('DEMO_DATE', '2026-11-21')} (시연 기준일)\n[질문] {q}\n[사용자] {json.dumps(profile or {}, ensure_ascii=False)}\n[근거]\n{ctx}"
        body = json.dumps({"model": os.environ.get("LLM_MODEL", "gpt-4o-mini"), "temperature": 0, "response_format": {"type": "json_object"},
                           "messages": [{"role": "system", "content": sysmsg}, {"role": "user", "content": user}]}).encode()
        base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
        req = urllib.request.Request(f"{base.rstrip('/')}/chat/completions", data=body,
                                     headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(json.loads(r.read())["choices"][0]["message"]["content"])


def conflict(code_txt, ai_txt):
    """코드 판정과 AI 답의 결론(된다/안 된다)이 반대인지"""
    yes = r"신청할 수 있|받을 수 있|가능|맞아요"
    no = r"받을 수 없|신청할 수 없|안 돼|불가|대상이 아니|지원받을 수 없|충족하지 않"
    code_yes = bool(re.search(yes, code_txt))
    ai_yes, ai_no = bool(re.search(yes, ai_txt)), bool(re.search(no, ai_txt))
    return (code_yes and ai_no and not ai_yes) or (not code_yes and ai_yes and not ai_no)


def _won(t):
    """'1000' '1천' '1천만' '5,000만' '1억' '1억 5천' → 만 원"""
    t = t.replace(",", "")
    m = re.match(r"(?:(\d+(?:\.\d+)?)\s*억)?\s*(?:(\d+(?:\.\d+)?)\s*(천)?)?", t)
    if not m or not (m.group(1) or m.group(2)):
        return None
    v = float(m.group(1) or 0) * 10000
    if m.group(2):
        v += float(m.group(2)) * (1000 if m.group(3) else 1)
    return v


def rent_check(q):
    """서울시 청년월세 거주 요건: 보증금 8천만 원 이하 · 월세 60만 원 이하, 월세 60 초과여도 (보증금×5%÷12 + 월세) ≤ 93만 원이면 가능"""
    if "월세" not in q or not re.search(r"청년\s*월세|월세\s*지원", q):
        return None
    m = re.search(r"월세\s*(\d+(?:\.\d+)?)\s*(?:만|이면|인데|짜리|원|\s|$)", q)   # '월세 70이면'처럼 만이 없어도
    if not m:
        return None
    r = float(m.group(1))
    d = re.search(r"보증금\s*([\d.,]+\s*억?\s*[\d.,]*\s*천?)", q)
    dep = _won(d.group(1)) if d else None
    f = lambda v: f"{v:,.0f}"
    if dep is not None and dep > 8000:
        return f"보증금 {f(dep)}만 원은 서울시 청년월세 조건(보증금 8천만 원 이하)을 넘어서 대상이 아니에요."
    if r <= 60:
        return f"월세 {f(r)}만 원은 서울시 청년월세 월세 조건(60만 원 이하)에 맞아요."
    lim = min(8000, (93 - r) * 12 / 0.05)
    if lim <= 0:
        return f"월세 {f(r)}만 원은 보증금이 없어도 (보증금×5%÷12 + 월세)가 93만 원을 넘어서 서울시 청년월세 대상이 아니에요."
    if dep is not None:
        v = dep * 0.05 / 12 + r
        return (f"월세 {f(r)}만 원은 60만 원을 넘지만, 보증금 {f(dep)}만 원이면 (보증금×5%÷12 + 월세) = {v:.1f}만 원"
                + ("으로 93만 원 이하라 신청할 수 있어요." if v <= 93 else "으로 93만 원을 넘어서 대상이 아니에요."))
    return (f"월세 {f(r)}만 원은 60만 원을 넘지만, 보증금이 {f(lim)}만 원 이하면 (보증금×5%÷12 + 월세)가 93만 원 이하라 "
            f"서울시 청년월세를 신청할 수 있어요. 보증금이 {f(lim)}만 원보다 크면 대상이 아니에요.")


ANSWER_PROMPT = """너는 '첫집 내비'의 청년 주거 정책 상담 도우미야. 서울에서 처음 혼자 사는 청년의 질문에 답해.
[꼭 지킬 것]
1. [근거]에 있는 내용만으로 답해. 근거에 없는 정책·금액·기간·조건을 지어내지 마.
2. 문장마다 근거 번호를 [1]처럼 붙여. 숫자(금액·나이·기간·%)는 근거에 적힌 표기 그대로 옮겨. 나이 범위는 "만 19~34세"처럼 물결(~)로 써.
3. 원칙과 함께 예외·단서("~여도 ~이면 가능")가 근거에 있으면 꼭 같이 말해. 원칙만 보고 "안 돼요"라고 단정하지 마. 근거에 "불가·제외·대상 아님"이라고 적혀 있지 않은 조건으로 "신청할 수 없어요"라고 말하지 마.
4. "같이 받을 수 있어요?"처럼 중복을 물으면, 안 될 때 해야 하는 일(예: 지급중지 신청)과 안 하면 생기는 불이익을 근거에 있는 그대로 같이 말해.
5. "받을 수 있어요?"처럼 자격을 물으면 결론만 말하지 말고, 그 이유가 되는 기준(예: "만 19~34세가 대상이라")을 같은 문장에 꼭 넣어.
6. 질문한 사람이 대상이 아니면, [근거] 안에 대신 받을 수 있는 정책이 있을 때 한 문장으로 알려 줘.
7. 날짜는 근거의 날짜를 "2027년 2월 1일"처럼 풀어 써도 돼. 근거에 일정이 여러 차수(1차·2차)면 질문한 차수를 골라.
8. "받을 수 있는 정책"을 물으면 얼마를 받는지(금액)도 같이 말해. 근거에 신청 기간이 있으면 [오늘] 기준으로 올해 접수가 끝났는지, 언제 신청하는지 한마디 붙여.
9. 근거로 답할 수 없으면 found=false로 하고 "공고문에서 찾지 못했어요"라고 말한 뒤, 어디에 물어보면 되는지 근거의 기관명으로 안내해.
10. 해요체, 4문장 이내, 쉬운 말. 소득·재산 심사처럼 서류로 정해지는 조건이 답에 걸려 있을 때만 "확인이 필요해요"를 붙여. 근거로 확실한 답에는 붙이지 마.
11. '(코드 판정)' 근거는 코드가 이미 계산한 결과야. 다른 근거와 다르게 해석하지 말고 그 결론을 그대로 따라. 판정에 나온 정책 이름을 다른 정책과 바꿔 쓰지 마.
12. JSON으로만 답해: {"answer": "...", "citations": [1, 2], "found": true}"""

UNIT = re.compile(r"(\d+(?:[.,]\d+)*)\s*(만|억|원|%|개월|년|세|살|일|회|㎡)")


def bad_numbers(ans, ctx):
    norm = lambda n: n.replace(",", "").rstrip("0").rstrip(".") if "." in n else n.replace(",", "")
    ok = {(norm(n), u) for n, u in UNIT.findall(ctx)}
    ok |= {(norm(n), "살") for n, u in UNIT.findall(ctx) if u == "세"} | {(norm(n), "세") for n, u in UNIT.findall(ctx) if u == "살"}
    # 근거의 날짜(2027-02-01, ~03-02)는 '2027년 2월 1일'처럼 풀어 써도 통과
    for y, mo, d in re.findall(r"(20\d\d)-(\d{1,2})-(\d{1,2})", ctx):
        ok |= {(y, "년"), (str(int(d)), "일")}
    for mo, d in re.findall(r"(?<![\d-])(\d{1,2})-(\d{1,2})(?![\d-])", ctx):
        ok.add((str(int(d)), "일"))
    # 단위 없이 적힌 원 금액(4,576,036)은 '4,576,036원'·'약 457만 원'·'458만 원'으로 써도 통과
    for n in re.findall(r"\d{1,3}(?:,\d{3})+|\d{5,}", ctx):
        v = int(n.replace(",", ""))
        ok |= {(str(v), "원"), (str(v // 10000), "만"), (str(round(v / 10000)), "만"), (norm(f"{v / 10000:.1f}"), "만")}
    return sorted({f"{n}{u}" for n, u in UNIT.findall(ans) if (norm(n), u) not in ok})


def extractive(q, refs, vec):
    """AI 없이: 근거 청크에서 질문과 가장 가까운 문장 2~3개를 그대로 보여준다"""
    if not refs:
        return {"answer": "관련 공고문을 찾지 못했어요. 마이홈포털(1600-1004)이나 120 다산콜센터에 문의해 보세요.", "citations": [], "found": False, "mode": "원문"}
    cands = []
    for r in refs[:6]:
        for s in re.split(r"(?<=[가-힣)%]\.)\s+|(?<=요)\s+|\s/\s|\n", r["text"]):
            s = s.strip()
            if 12 <= len(s) <= 260:
                cands.append((s, r["n"], r["name"]))
    if not cands:
        cands = [(refs[0]["text"][:200], 1, refs[0]["name"])]
    qv = vec.transform([expand(q)])
    sv = vec.transform([c[0] for c in cands])
    sc = (sv @ qv.T).toarray().ravel()
    code = {r["n"] for r in refs if r.get("source") == "코드 판정" and "신청 상태" not in r["section"]}
    sc = sc + np.array([1.0 if c[1] in code else 0 for c in cands])   # 코드가 판정한 문장(나이 등)은 맨 앞에
    picked, used = [], set()
    for i in np.argsort(-sc):
        s, n, name = cands[i]
        if s in used:
            continue
        used.add(s)
        picked.append((s, n, name))
        if len(picked) == 3:
            break
    lines = [f"• {s} [{n}]" for s, n, _ in picked]
    return {"answer": "공고문에서 찾은 내용이에요.\n" + "\n".join(lines), "citations": sorted({n for _, n, _ in picked}), "found": True, "mode": "원문"}


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "직장 다닌 지 1년 안 됐는데 버팀목 전세대출 한도는 어떻게 돼?"
    prof = {"age": 27, "area": {"gu": "관악구"}}
    r = Rag().answer(q, prof)
    print(f"Q. {q}\n[{r['mode']}] {r['answer']}\n")
    if r.get("memo"):
        print(f"  (참고: {r['memo']})\n")
    for s in r["sources"]:
        print(f"  [{s['n']}] {s['name']} · {s['section']} · {s['org']} · {s['url']}")
    print("\n  찾은 정책:", " / ".join(p["name"] for p in r["policies"]))
