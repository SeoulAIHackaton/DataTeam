"""
AI 설명 (STEP 2 지원 추천 · STEP 3 집 비교 공용)
  코드가 계산을 끝낸 결과(요약·근거 문장)만 LLM에 넘겨서 쉬운 말로 설명하게 하고,
  근거에 없는 숫자가 나오거나 추천을 바꾸면 버리고 템플릿 설명으로 바꿔요.

실행: python scripts/explain.py --step 3            (2 = 지원 추천, 3 = 집 비교)
      python scripts/explain.py --step 3 --easy     (쉬운 화면 규칙 추가)
      python scripts/explain.py --step 3 --priority "시간이 먼저"
입력: processed/step2_support/policy_result.json, processed/step3_homes/recommend_result.json
결과: processed/step2_support/ 또는 step3_homes/ 의 explain_result.json
키: .env 의 LLM_API_KEY (없으면 템플릿 설명)
"""
import argparse
import json
import os
import re

import common
common.load_env()

PROC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "processed")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
USER_NAME = "정연"
DIRS = {2: "step2_support", 3: "step3_homes"}
CHECK_ITEMS = {
    2: ["소득 기준(중위소득)", "재산 기준", "신청 기간", "필요 서류", "전입신고 날짜"],
    3: ["관리비", "소음", "채광", "수압과 곰팡이", "건물 용도(주택인지)", "역까지 경사와 계단"],
}
ROLE = {
    2: "받을 수 있는 주거 지원 정책 추천 결과",
    3: "후보 집 비교와 종합 추천 결과",
}

SYSTEM_PROMPT = """너는 '첫집 내비'의 설명 도우미야.
서울에서 처음 혼자 사는 청년에게, 이미 계산이 끝난 {role}를 쉬운 말로 설명해.

[꼭 지킬 것]
1. [요약]과 [근거]에 있는 사실과 숫자만 써. 새로운 숫자, 정책, 시세, 장점을 지어내지 마.
2. [추천]은 절대 바꾸지 마. 너는 고르는 사람이 아니라 설명하는 사람이야.
3. 숫자는 적힌 값을 그대로 옮겨. 더하기·빼기·반올림 같은 계산을 하지 마.
4. 해요체로, 한 문장에 한 가지만 말해. 어려운 말은 쉬운 말로 바꿔.
   (예: 실부담 → 한 달에 실제로 나가는 돈, 중복 수혜 → 같이 받기, 전환율 → 보증금을 월세로 바꾸는 비율)
5. 아쉬운 점이나 주의할 점을 한 가지는 꼭 말해. 좋은 점만 말하지 마.
6. 결정을 강요하지 마. 조건이 바뀌면 결과가 달라질 수 있다는 걸 알려 줘.
7. '확인 필요'라고 적힌 조건은 확정된 것처럼 말하지 마.
8. [직접 확인 후보]에서 이 결과에 맞는 2개를 골라. 후보에 없는 항목은 쓰지 마.
9. 아래 JSON 형식으로만 답해. 다른 말은 붙이지 마.

{{"한줄": "추천 한 줄 (40자 이내, [추천] 이름을 그대로 넣기)",
 "이유": ["이유 1", "이유 2", "이유 3"],
 "아쉬운점": "아쉬운 점이나 주의할 점 한 문장",
 "바꿔보기": "조건이나 선택이 바뀌면 어떻게 되는지 한 문장",
 "직접확인": ["항목", "항목"]}}"""

EASY_RULE = """
[쉬운 화면 켜짐]
- 문장을 아주 짧게 써 (한 문장 20자 안팎).
- 한 문장에 숫자는 하나만 써.
- 어려운 한자어 대신 일상 말을 써. (예: 보증금 → 처음에 맡기는 돈)"""


# ───────────── 단계별 결과 읽기 → 공통 모양 ─────────────
def load_step(step, priority):
    if step == 3:
        with open(os.path.join(PROC, DIRS[3], "recommend_result.json"), encoding="utf-8") as f:
            allres = json.load(f)
        res = allres[priority]
        summary = [f"우선순위: {res['우선순위']} (돈 {round(res['가중치']['비용']*100)}%, 오가는 시간 {round(res['가중치']['통근']*100)}%, 동네 생활 {round(res['가중치']['생활']*100)}%)"]
        for i, h in enumerate(res["순위"], 1):
            s = h["점수"]
            summary.append(f"{i}위 {h['이름']}: 종합 {h['종합']}점 (돈 {s['비용']} / 시간 {s['통근']} / 생활 {s['생활']}), 한 달 {h['월실부담']}만 원, 오가는 시간 {h['통근_분']}분")
        change = [f"우선순위를 '{k}'로 바꾸면 1위가 {v['추천']}(으)로 바뀌어요" for k, v in allres.items() if k != priority and v["추천"] != res["추천"]] \
            or ["다른 우선순위로 바꿔도 1위는 같아요"]
        facts = [f for f in res["근거"] if not f.startswith("지금 우선순위")]
        return {"추천": res["추천"], "key": res["추천"], "요약": summary, "근거": facts, "바꾸면": change}
    if step == 2:
        with open(os.path.join(PROC, DIRS[2], "policy_result.json"), encoding="utf-8") as f:
            r = json.load(f)
        first = r["추천"].split(" + ")[-1]
        return {"추천": f"{r['추천']} (최대 {r['추천_total']:g}만 원)", "key": first, "요약": r["요약"],
                "근거": [f for f in r["근거"] if "되면:" not in f and "맞으면:" not in f],
                "바꾸면": [w["text"] for w in r["what_if"]]}
    raise SystemExit("--step 은 2(지원 추천) 또는 3(집 비교)")


def build_user_prompt(step, d, easy):
    lines = [f"[사용자] {USER_NAME}님", f"[추천] {d['추천']}", "[요약]"] + [f"- {x}" for x in d["요약"]]
    lines += ["[근거]"] + [f"- {x}" for x in d["근거"]]
    lines += ["[바뀌면]"] + [f"- {x}" for x in d["바꾸면"]]
    lines.append("[직접 확인 후보] " + ", ".join(CHECK_ITEMS[step]))
    return "\n".join(lines) + (EASY_RULE if easy else "")


# ───────────── 숫자 검사 ─────────────
NUM = re.compile(r"\d+(?:\.\d+)?")


def allowed_numbers(text):
    nums = set(NUM.findall(text)) | {str(n) for n in range(1, 4)}
    nums |= {n.rstrip("0").rstrip(".") for n in list(nums) if "." in n}
    nums |= {n.replace(",", "") for n in re.findall(r"\d{1,3}(?:,\d{3})+", text)}
    return nums


UNIT = re.compile(r"(\d+(?:\.\d+)?)\s*(만|억|%|분|개월|시간|세|점)")


def unit_tokens(text):
    norm = lambda n: n[:-2] if n.endswith(".0") else n
    return {(norm(n), u) for n, u in UNIT.findall(text.replace(",", ""))}


def bad_numbers(answer, allowed, prompt=""):
    """① 처음 보는 숫자  ② 단위가 붙은 숫자(만 원·%·분…)는 숫자+단위 조합까지 입력에 있어야 함"""
    text = json.dumps(answer, ensure_ascii=False).replace(",", "")
    bad = {n for n in NUM.findall(text) if n not in allowed}
    if prompt:
        ok = unit_tokens(prompt)
        bad |= {f"{n}{u}" for n, u in unit_tokens(text) if (n, u) not in ok}
    return sorted(bad)


def call_llm(step, user_prompt):
    import urllib.request
    body = json.dumps({"model": LLM_MODEL, "temperature": 0.3, "response_format": {"type": "json_object"},
                       "messages": [{"role": "system", "content": SYSTEM_PROMPT.format(role=ROLE[step])},
                                    {"role": "user", "content": user_prompt}]}).encode("utf-8")
    req = urllib.request.Request(f"{LLM_BASE_URL.rstrip('/')}/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(json.loads(resp.read())["choices"][0]["message"]["content"])


def ieyo(word):
    """받침 따라 '이에요/예요' (괄호 안 글자는 건너뜀 없이 마지막 한글 기준)"""
    last = next((c for c in reversed(word) if "가" <= c <= "힣"), "가")
    return word + ("이에요" if (ord(last) - 0xAC00) % 28 else "예요")


def template(step, d):
    facts = d["근거"]
    warn_kw = ("먼 편", "부족", "같이 받을 수 없", "어려워요", "확인 필요", "더 들어요")
    weak = next((f for f in facts if any(k in f for k in warn_kw)), None)
    pool = [f for f in facts if f is not weak]
    reasons = ([f for f in pool if d["key"] in f] + [f for f in pool if d["key"] not in f])[:3]
    head = {2: f"받을 수 있는 지원은 {ieyo(d['추천'])}.",
            3: f"지금 우선순위로는 {d['key']} 집이 가장 잘 맞아요."}[step]
    return {"한줄": head, "이유": reasons,
            "아쉬운점": weak or "데이터로 확인한 범위에서는 크게 아쉬운 점이 없어요.",
            "바꿔보기": d["바꾸면"][0] if d["바꾸면"] else "", "직접확인": CHECK_ITEMS[step][:2]}


def explain(step=3, priority="균형", easy=False):
    d = load_step(step, priority)
    up = build_user_prompt(step, d, easy)
    src, ans, memo = "템플릿", None, ""
    if LLM_API_KEY:
        try:
            ans = call_llm(step, up)
            bad = bad_numbers(ans, allowed_numbers(up), up)
            if bad:
                memo, ans = f"근거에 없는 숫자 {bad} → 템플릿으로 대체", None
            elif d["key"] not in ans.get("한줄", ""):
                memo, ans = "AI가 추천을 바꾸거나 빠뜨림 → 템플릿으로 대체", None
            else:
                src = "AI"
        except Exception as e:
            memo = f"AI 호출 실패: {e} → 템플릿으로 대체"
    if ans is None:
        ans = template(step, d)
    return {"step": step, "추천": d["추천"], "출처": src, "메모": memo, "설명": ans,
            "프롬프트": {"system": SYSTEM_PROMPT.format(role=ROLE[step]), "user": up}}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", type=int, default=3, choices=[2, 3])
    ap.add_argument("--priority", default="균형")
    ap.add_argument("--easy", action="store_true")
    a = ap.parse_args()
    out = explain(a.step, a.priority, a.easy)
    e = out["설명"]
    print(f"■ STEP {a.step} [{out['출처']}] 추천: {out['추천']}  {out['메모']}")
    print("  " + e["한줄"])
    for r in e["이유"]:
        print("  • " + r)
    print("  아쉬운 점: " + e["아쉬운점"])
    print("  바꿔보기: " + e["바꿔보기"])
    print("  직접 확인: " + ", ".join(e["직접확인"]))
    print("\n─── AI에게 보내는 내용 (user) ───\n" + out["프롬프트"]["user"])
    with open(os.path.join(PROC, DIRS[a.step], "explain_result.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n저장 → processed/{DIRS[a.step]}/explain_result.json")
