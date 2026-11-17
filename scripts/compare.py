"""
3단계 · 이 비교에 대해 물어보기 · 계산된 비교 결과(facts) → LLM이 2~3문장으로 설명

- 검색(RAG)은 쓰지 않아요. 화면이 보낸 비교 결과(JSON)만 근거예요. 계산·순위는 화면의 코드가 이미 끝낸 값이에요.
- 두 가지 검사를 통과해야 AI 답을 보여줘요. 걸리면 None을 돌려주고, 화면은 코드가 만든 문장으로 답해요.
    숫자 검사: 답에 나온 숫자가 비교 결과에 없으면 → reason 'number'
    결론 검사: "○○이 1위 / ○○을 추천"이 그 기준의 실제 1위와 다르면 → reason 'conclusion'
- LLM 모델은 미정 · .env 의 LLM_BASE_URL / LLM_MODEL / LLM_API_KEY 로 교체 (OpenAI 호환 API).
"""
import json
import os
import re
import urllib.request

PROMPT = """너는 '첫집 내비' 3단계 집 비교 결과를 설명하는 도우미야.
사용자 메시지의 [비교 결과] JSON은 코드가 계산한 값이야. 이 값만 써서 [질문]에 한국어 존댓말(~해요)로 2~3문장 답해.
규칙:
- JSON에 없는 숫자나 사실을 쓰지 마. 새로 계산하지 마. 두 집의 차이는 pairs에 있는 값만 써.
- 순위·추천은 바꾸지 마. 지금 기준은 prio_now이고 그 1위는 priorities[prio_now].rank의 첫 번째야. 다른 기준(돈이 먼저 등)을 물으면 그 기준의 rank를 그대로 말해.
- 집은 homes[].name(예: 성수, 역삼, 신림)으로 불러. 금액 단위는 '만 원', 시간은 '분'.
- 한 달 실부담은 월세+관리비이고 교통비(transit_fare_month_ref)는 참고값이야. 실부담에 교통비를 더하지 마.
- JSON에 없는 내용(소음, 채광, 면적, 집주인 등)은 "비교 결과에는 없는 내용이에요. 집 볼 때 직접 확인해 보세요."라고만 답해.
- 지원 신청 시기·조건 질문은 "지원 조건과 신청 시기는 2단계 [공고문에 물어보기]에서 확인해 보세요."라고만 답해.
JSON으로만 답해: {"answer": "..."}"""


def _nums(s):
    return {float(x) for x in re.findall(r"\d+(?:\.\d+)?", str(s).replace(",", ""))}


UNITS = {   # 답의 숫자 뒤 단위 → 비교 결과에서 그 단위를 가진 값들
    "만 원": {"deposit", "deposit_short", "rent", "fee", "monthly", "transit_fare_month_ref", "support_total", "monthly_support",
             "monthly_after_support", "monthly_diff", "deposit_diff", "my_cash"},
    "분": {"commute_min", "commute_diff_min", "max_commute_wish"},
    "점": {"total", "cost_score", "time_score", "life_score"},
    "시간": {"commute_hours_month_diff"},
    "%": {"비용", "시간", "생활"},
}
UNIT_RE = r"(\d+(?:\.\d+)?)\s*(만\s*원|분|점|시간|%)"


def _by_unit(facts):
    out = {u: set() for u in UNITS}

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    for u, keys in UNITS.items():
                        if k in keys:
                            out[u].add(float(v))
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str):                     # "성수약국 3분", reasons_now 문장 속 "42만 원"
            for n, u in re.findall(UNIT_RE, o.replace(",", "")):
                out[re.sub(r"\s", " ", u) if u.startswith("만") else u].add(float(n))
    walk(facts)
    return out


def number_ok(ans, facts):
    """단위가 붙은 숫자는 같은 단위 값 중에 있어야 하고, 나머지 숫자는 비교 결과 어딘가에 있어야 해요"""
    t = ans.replace(",", "")
    unit, bad = _by_unit(facts), []
    for n, u in re.findall(UNIT_RE, t):
        u = "만 원" if u.startswith("만") else u
        if float(n) not in unit[u]:
            bad.append(f"{n}{u}")
    rest = re.sub(UNIT_RE, " ", t)
    allowed = _nums(json.dumps(facts, ensure_ascii=False)) | {1.0, 2.0, 3.0, 100.0}
    bad += [f"{n:g}" for n in _nums(rest) if n not in allowed]
    return not bad, bad


def conclusion_ok(ans, facts):
    """'○○이 1위' / '○○을 추천'이 그 문장이 말하는 기준(없으면 지금 기준)의 1위와 같은지"""
    names = [h["name"] for h in facts.get("homes", [])]
    pri = facts.get("priorities", {})
    now = facts.get("prio_now")
    for sent in re.split(r"(?<=[.!?])\s+|(?<=요)\s+", ans):
        if not re.search(r"1위|추천", sent):
            continue
        said = [p for p in pri if p in sent]
        expect = pri[said[-1]]["rank"][0]["home"] if said else (pri[now]["rank"][0]["home"] if now in pri else None)
        if not expect:
            continue
        for n in names:
            if n == expect:
                continue
            for m in re.finditer(re.escape(n), sent):
                rest = re.split(r"[,.]|그리고|하지만|대신|반면", sent[m.end():])[0]
                cut = min([rest.index(o) for o in names if o != n and o in rest] or [len(rest)])
                if re.search(r"1위|추천", rest[:cut]) and not re.search(r"2위|3위|되려면|아니", rest[:cut]):
                    return False
    return True


def answer(question, facts):
    """→ {"answer", "mode": "AI"} 또는 {"answer": None, "mode", "reason"}"""
    if not os.environ.get("LLM_API_KEY"):
        return {"answer": None, "mode": "off", "reason": "off"}
    body = json.dumps({"model": os.environ.get("LLM_MODEL", "gpt-4o-mini"), "temperature": 0,
                       "response_format": {"type": "json_object"},
                       "messages": [{"role": "system", "content": PROMPT},
                                    {"role": "user", "content": f"[비교 결과]\n{json.dumps(facts, ensure_ascii=False)}\n\n[질문]\n{question}"}]}).encode()
    base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
    req = urllib.request.Request(base.rstrip("/") + "/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        ans = (json.loads(json.loads(r.read())["choices"][0]["message"]["content"]).get("answer") or "").strip()
    if not ans:
        return {"answer": None, "mode": "AI", "reason": "empty"}
    ok, bad = number_ok(ans, facts)
    if not ok:
        return {"answer": None, "mode": "AI", "reason": "number", "memo": f"없는 숫자 {bad} · {ans}"}
    if not conclusion_ok(ans, facts):
        return {"answer": None, "mode": "AI", "reason": "conclusion", "memo": ans}
    return {"answer": ans, "mode": "AI"}
