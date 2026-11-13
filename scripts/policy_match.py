"""
STEP 2 · 근거 있는 지원 추천  (3단계 서비스: 1 내 상황 → 2 지원 추천 → 3 집 비교)
  processed/demo_policies.json (현금 지원 4개 + 중복 규칙, 사람이 정리)으로
  ① 자격 판정 (code 조건은 ✓/✗, llm 조건은 '확인 필요')  ② 받을 수 있는 금액
  ③ 기준일 대비 접수 상태 · 달력  ④ 중복 수혜 → 가장 유리한 조합  ⑤ 조건이 바뀌면?  ⑥ 총액
  ⑦ 더 찾아본 지원: 온통청년·정부24 전체 목록에서 조건이 맞을 수 있는 정책
     (조건 문장은 RAG가 읽어서 판정 · 금액은 총액에서 제외)
  을 코드로 계산하고, AI 설명에 넘길 근거 문장을 만든다.

실행: python scripts/policy_match.py
입력: processed/profile_demo.json (STEP 1 · housing_plan = 집 예산)
결과: processed/step2_support/policy_result.json
금액 단위: 만원
"""
import copy
import json
import os
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(BASE, "processed")
OUT = os.path.join(PROC, "step2_support")
os.makedirs(OUT, exist_ok=True)

# 시연일(본선) 기준. 실제 날짜로 계산해요 → 올해 현금 지원은 접수가 끝나서 "내년 신청"으로 나와요.
DEMO_DATE = date(2026, 11, 21)
MONTHS = 24

with open(os.path.join(PROC, "demo_policies.json"), encoding="utf-8") as f:
    DP = json.load(f)
POL = {p["key"]: p for p in DP["policies"]}
COLOR = {"seoul_youth_rent": "#2f6bff", "seoul_moving_brokerage": "#1f8a5b", "seoul_deposit_interest": "#8b5cf6", "molit_youth_rent": "#e8590c"}
SHORT = {"seoul_youth_rent": "서울시 청년월세", "seoul_moving_brokerage": "중개보수·이사비", "seoul_deposit_interest": "임차보증금 이자지원", "molit_youth_rent": "국토부 청년월세"}


def load_profile():
    with open(os.path.join(PROC, "profile_demo.json"), encoding="utf-8") as f:
        return json.load(f)


def housing_cases(p):
    """집을 고르기 전이라 STEP 1의 집 예산으로 판정. 전세는 '조건이 바뀌면?' 비교용"""
    hp = p.get("housing_plan", {"type": "월세", "deposit": p.get("cash", 1000), "monthly": 50})
    rent = {"name": "월세", "type": "월세", "deposit": hp["deposit"], "monthly": hp["monthly"], "rent_months": MONTHS, "public_after": False, "loan": 0}
    jeonse = {"name": "전세", "type": "전세", "deposit": p.get("cash", 2000), "monthly": 0, "rent_months": 0, "public_after": False, "loan": 0}
    return rent, jeonse


# ───────────── ① 자격 판정 ─────────────
def check(cond, p, h):
    f = cond["field"]
    if cond["check"] != "code":
        return "확인 필요", cond["text"]
    if f == "age":
        ok = cond["min"] <= p["age"] <= cond["max"]
        return ("통과" if ok else "안 맞음"), f"만 {cond['min']}~{cond['max']}세 (지금 {p['age']}세)"
    if f == "region":
        return ("통과" if p["region"] == cond["value"] else "안 맞음"), cond["text"]
    if f == "homeless":
        return ("통과" if p["homeless"] else "안 맞음"), cond["text"]
    if f == "rent":
        if h["rent_months"] == 0:
            return "안 맞음", "월세로 사는 경우만 (전세는 해당 없음)"
        ok = h["deposit"] <= cond["deposit_max"] and (h["monthly"] <= cond["monthly_rent_max"] or h["deposit"] * 0.05 / 12 + h["monthly"] <= 93)
        return ("통과" if ok else "안 맞음"), f"보증금 {cond['deposit_max']}만·월세 {cond['monthly_rent_max']}만 이하 (지금 {h['deposit']:g}만/{h['monthly']:g}만)"
    if f == "contract_amount":
        amt = h["deposit"] + h["monthly"] * 100          # 월세는 보증금 + 월세×100으로 거래금액 환산
        return ("통과" if amt <= cond["max"] else "안 맞음"), f"거래금액 {cond['max']}만 이하 (환산 {amt:g}만)"
    if f == "income":
        ok = p["income_annual"] <= cond["annual_max"]
        return ("통과" if ok else "안 맞음"), f"연소득 {cond['annual_max']}만 이하 (지금 {p['income_annual']}만)"
    if f == "public_rental":
        ok = not h["public_after"]
        return ("통과" if ok else "부분"), cond["text"] + ("" if ok else " → 공공임대 입주 전 월세 기간만 가능")
    return "확인 필요", cond["text"]


# ───────────── ② 금액 ─────────────
def amount(key, p, h):
    b = POL[key]["benefit"]
    if key in ("seoul_youth_rent", "molit_youth_rent"):
        months = min(b["months"], h["rent_months"])
        return min(h["monthly"], b["monthly_max"]) * months, f"월 {min(h['monthly'], b['monthly_max']):g}만 × {months}개월"
    if key == "seoul_moving_brokerage":
        return b["total_max"], "중개보수 + 이사비 실비, 최대"
    if key == "seoul_deposit_interest":
        # 서울시 이자지원은 '은행 전세대출'의 이자를 깎아 주는 것 → 버팀목(기금 대출)과 동시에 못 씀.
        # 은행 금리를 몰라서 버팀목보다 유리한지 계산할 수 없음 → 총액에 넣지 않고 '대안'으로만 표시
        return 0, "전세일 때 버팀목 대신 고를 수 있는 대안 (은행 금리 − 연 2.0%, 은행 금리 확인 필요)"
    return 0, ""


# ───────────── ③ 마감 ─────────────
def deadline(key, today):
    rounds = []
    for r in POL[key]["apply_rounds"]:
        if not r["start"]:
            rounds.append({"round": r["round"], "status": "상시", "dday": None, "start": None, "end": None})
            continue
        s, e = date.fromisoformat(r["start"]), date.fromisoformat(r["end"])
        if today < s:
            st, d = "예정", (s - today).days
        elif today <= e:
            st, d = "접수 중", (e - today).days
        else:
            st, d = "마감", None
        rounds.append({"round": r["round"], "status": st, "dday": d, "start": r["start"], "end": r["end"], "channel": r.get("channel")})
    live = [r for r in rounds if r["status"] == "접수 중"]
    nxt = [r for r in rounds if r["status"] == "예정"]
    if live:
        lab = f"D-{live[0]['dday']} 마감"
    elif nxt:
        lab = f"{nxt[0]['start']} 시작 (D-{nxt[0]['dday']})"
    elif any(r["status"] == "상시" for r in rounds):
        lab = "상시"
    else:
        lab = "올해 접수 끝 (내년 공고 확인)"
    return rounds, lab


def evaluate(p, h, today):
    out = []
    for key, pol in POL.items():
        checks = [{"text": t, "result": r} for r, t in (check(c, p, h) for c in pol["eligibility"])]
        fail = [c for c in checks if c["result"] == "안 맞음"]
        amt, how = amount(key, p, h)
        rounds, lab = deadline(key, today)
        if key == "seoul_deposit_interest" and h["type"] == "전세" and not fail:
            status = "대안 (확인 필요)"
        else:
            status = None
        status = status or ("못 받아요" if fail or amt == 0 else ("받을 수 있어요" if all(c["result"] == "통과" for c in checks) else "받을 수 있어요 (확인 필요)"))
        out.append({"key": key, "name": pol["name"], "short": SHORT[key], "color": COLOR[key], "status": status,
                    "amount": amt if status != "못 받아요" else 0, "amount_how": how, "checks": checks,
                    "why_not": [c["text"] for c in fail], "deadline": lab, "rounds": rounds,
                    "need_check": [c["text"] for c in checks if c["result"] == "확인 필요"], "source": pol.get("source_url")})
    return out


# ───────────── ④ 중복 규칙 → 가장 유리한 조합 ─────────────
def apply_duplicates(items, h):
    by = {i["key"]: i for i in items}
    warns = []
    for rule in DP["duplicate_rules"]:
        if "pair" in rule:
            a, b = (by.get(k) for k in rule["pair"])
            if not (a and b) or a["amount"] == 0 or b["amount"] == 0:
                continue
            if rule["type"] == "중복 불가":
                keep, drop = (a, b) if a["amount"] >= b["amount"] else (b, a)
                drop["excluded_by"] = keep["key"]
                warns.append({"type": "중복 불가", "pair": [keep["short"], drop["short"]],
                              "text": f"{keep['short']}와 {drop['short']}는 같이 받을 수 없어요. 금액이 더 큰 {keep['short']}({keep['amount']:g}만 원)를 골랐어요.", "source": rule["sources"]})
            else:
                warns.append({"type": rule["type"], "pair": [SHORT[k] for k in rule["pair"]], "text": rule["text"], "source": rule["sources"]})
        elif "condition" in rule and h["public_after"]:
            warns.append({"type": "중복 불가", "text": rule["text"], "source": rule["sources"]})
        elif "policy" in rule and by.get(rule["policy"], {}).get("amount"):
            warns.append({"type": rule["type"], "text": rule["text"]})
    chosen = [i for i in items if i["amount"] > 0 and not i.get("excluded_by")]
    return chosen, warns


def run_case(p, h, today, exclude=()):
    items = evaluate(p, h, today)
    for i in items:
        if i["key"] in exclude:
            i["status"], i["amount"] = "못 받아요", 0
    chosen, warns = apply_duplicates(items, h)
    total = round(sum(i["amount"] for i in chosen), 1)
    return {"items": items, "chosen": [i["key"] for i in chosen], "total": total, "warnings": warns}


# ───────────── ⑤ 조건이 바뀌면? ─────────────
def what_if(p, h, base, today, h_jeonse=None):
    cases = [("내년에 35살이 되면", {"age": 35}, (), h),
             ("국토부 청년월세 소득 조건이 안 맞으면", {}, ("molit_youth_rent",), h)]
    if h_jeonse:
        cases.append(("전세로 계약하면", {}, (), h_jeonse))
    out = []
    for label, ch, ex, hh in cases:
        q = {**p, **ch}
        r = run_case(q, hh, today, ex)
        lost = [SHORT[k] for k in base["chosen"] if k not in r["chosen"]]
        gained = [SHORT[k] for k in r["chosen"] if k not in base["chosen"]]
        diff = round(r["total"] - base["total"], 1)
        txt = f"{label}: 총액 {base['total']:g}만 → {r['total']:g}만 원"
        if lost:
            txt += f" ({', '.join(lost)} 빠짐"
            txt += f", {', '.join(gained)}로 바뀜)" if gained else ")"
        elif not diff:
            txt += " (변화 없음)"
        out.append({"label": label, "change": ch, "total": r["total"], "diff": diff, "lost": lost, "gained": gained, "text": txt})
    return out


# ───────────── ⑦ 더 찾아본 지원 (온통청년 · 정부24 전체 목록) ─────────────
# 시연용 4개는 금액·기간·중복까지 확인한 정책이고, 전체 목록은 조건이 문장이라 '후보'로만 보여준다.
# 코드 필터: 주거 관련 · 서울(시 전체 또는 내 자치구) 또는 중앙정부 · 나이 · 특정 대상(장애·농어촌·신혼 등) 제외
# 금액은 공고마다 달라 총액에 넣지 않고, 화면에는 '조건 확인 필요'로 표시
import csv as _csv
import re as _re

HOUSING_WORDS = ("청년", "월세", "전세", "임대", "보증금", "중개", "이사", "주거", "주택", "대출", "보증료", "청약", "안심계약")
SPECIAL_WORDS = ("장애", "북한이탈", "보훈", "범죄", "폭력", "한부모", "농촌", "농업", "농림", "귀농", "귀산", "귀어", "수산", "어촌",
                 "노후", "아동", "청소년", "쪽방", "노숙", "수급", "저소득", "기초생활", "차상위", "출산", "신혼", "신생아", "미혼모",
                 "전세피해", "전세사기", "난민", "제대군인", "소방", "태양광", "주차", "에너지", "세탁", "장제", "조사원", "자립준비",
                 "대학", "기숙사", "구축", "개선", "조성", "펀드", "모니터링", "포털", "부도", "사업자", "개발제한", "공동주택관리",
                 "영구임대", "취약계층", "긴급복지", "위기가정", "정신질환", "주거급여",
                 "분양", "구입", "디딤돌", "모기지", "내집마련")       # 집을 사는 상품은 '첫 집 임차' 범위 밖
NATIONAL = ("국토교통부", "금융위원회", "재정경제부", "고용노동부", "주택도시기금", "서울시복지재단")
DEMO_NAME_WORDS = ("청년월세", "청년 월세", "중개보수 및 이사비", "임차보증금 이자")
LOAN_NAMES = ("버팀목", "보증부 월세대출", "보증부월세대출", "청년전용 저리대출")


def _norm(name):
    name = _re.sub(r"^(국토교통부|서울특별시|서울시)\s*", "", name)
    n = _re.sub(r"^\(?[가-힣]*\)?\s*", lambda m: "" if m.group(0).strip("() ") in ("국토부",) else m.group(0), name)
    n = _re.sub(r"(20\d\d년?|\d\d년)\s*", "", n)
    return _re.sub(r"[\s·()（）\[\]「」]", "", n)


def _kind(name):
    if any(w in name for w in ("대출", "융자", "모기지")):
        return "대출"
    if "청약" in name:
        return "청약"
    if any(w in name for w in ("임대주택", "공급", "안심주택", "행복주택", "매입임대", "전세임대", "성장주택", "오피스", "도전숙", "창업인의 집", "주거공유")):
        return "공공임대·주택"
    if any(w in name for w in ("상담", "서비스", "안심계약", "감정평가")):
        return "상담·서비스"
    return "지원금"


def _age_ok(p, lo, hi):
    try:
        lo, hi = int(float(lo or 0)), int(float(hi or 0))
    except ValueError:
        return True
    if lo == 0 and hi == 0:
        return True
    return (lo or 0) <= p["age"] <= (hi or 200)


def _region_ok(org, p, seoul_scope=None):
    org = org or ""
    if seoul_scope in ("서울 전역", "서울 일부 자치구"):
        return True
    if any(n in org for n in NATIONAL):
        return True
    if org.startswith("서울특별시"):
        rest = org.replace("서울특별시", "").strip()
        return (not rest.endswith("구")) or rest.startswith(p["area"]["gu"])
    return False


def more_policies(p, today):
    demo_ids = set()
    for pol in DP["policies"]:
        ids = pol.get("youthcenter_id")
        demo_ids |= set(ids if isinstance(ids, list) else [ids])
    out, seen = [], set()

    def add(src, pid, name, org, kind_hint, status, url, summary):
        key = _norm(name)
        if key in seen:
            return
        seen.add(key)
        tag = None
        out.append({"source": src, "id": pid, "name": name, "org": org, "kind": _kind(name), "status": status,
                    "summary": (summary or "").replace("\n", " ")[:120], "url": url, "tag": tag, "check": "조건 확인 필요"})

    with open(os.path.join(PROC, "youthcenter_seoul_housing.csv"), encoding="utf-8-sig") as f:
        for r in _csv.DictReader(f):
            name = r["name"]
            if not r["category"].startswith("주거") or r["id"] in demo_ids:
                continue
            if any(w in name for w in SPECIAL_WORDS) or any(w in name for w in DEMO_NAME_WORDS):
                continue
            if not _region_ok(r["org"], p, r["scope"]) or not _age_ok(p, r["age_min"], r["age_max"]):
                continue
            end = r.get("apply_end") or ""
            if end and end < f"{today.year}-01-01":
                continue                                    # 지난해 공고
            if r["apply_type"].startswith("특정기간") and end:
                st = "접수 중" if (r.get("apply_start") or "0") <= today.isoformat() <= end else ("마감" if today.isoformat() > end else "예정")
                status = f"{st} (~{end})"
            else:
                status = r["apply_type"] or "공고 확인"
            add("온통청년", r["id"], name, r["org"].split()[0] if r["org"] else "", None, status, r["url"], r["support"])

    with open(os.path.join(PROC, "gov24_housing.json"), encoding="utf-8") as f:
        for s in json.load(f)["services"]:
            name, org = s["name"], s["org"] or ""
            if not any(w in name for w in HOUSING_WORDS):
                continue
            if any(w in name for w in SPECIAL_WORDS) or any(w in name for w in DEMO_NAME_WORDS):
                continue
            if not _region_ok(org, p) or not _age_ok(p, s["age_min"], s["age_max"]):
                continue
            if s.get("homeless_household") is None and s.get("one_person_household") is None:
                continue                                    # 1인·무주택 가구 대상 표시가 없으면 제외
            add("정부24", s["id"], name, org, None, s.get("apply_period_type") or "공고 확인", s["url"], s.get("support") or s.get("summary"))

    order = {"지원금": 0, "공공임대·주택": 1, "대출": 2, "청약": 3, "상담·서비스": 4}
    out.sort(key=lambda x: (order.get(x["kind"], 9), 0 if "서울" in x["org"] else 1, x["name"]))
    return out


def run():
    p = load_profile()
    h, hj = housing_cases(p)
    today = DEMO_DATE
    base = run_case(p, h, today)
    items = {i["key"]: i for i in base["items"]}
    wi = what_if(p, h, base, today, hj)
    jeonse_alt = [i for i in run_case(p, hj, today)["items"] if i["status"].startswith("대안")]

    facts = []
    ch = [items[k] for k in base["chosen"]]
    facts.append(f"{p['name']}님이 받을 수 있는 현금 지원은 {' + '.join(i['short'] for i in ch)}로 최대 {base['total']:g}만 원이에요.")
    for i in ch:
        facts.append(f"{i['short']}: {i['amount_how']} = {i['amount']:g}만 원, 신청 {i['deadline']}.")
    for w in base["warnings"]:
        if w["type"] == "중복 불가":
            facts.append(w["text"])
    for i in base["items"]:
        if i["status"] == "못 받아요" and i["why_not"]:
            facts.append(f"{i['short']}는 '{i['why_not'][0]}' 조건 때문에 어려워요.")
    nc = sorted({t for i in ch for t in i["need_check"]})
    if nc:
        facts.append("소득·재산처럼 서류로 확인해야 하는 조건은 '확인 필요'로 표시했어요: " + " / ".join(nc[:3]))
    for w in wi:
        facts.append(w["text"])
    for i in jeonse_alt:
        facts.append(f"전세로 계약하면 {i['short']}{'을' if (ord(i['short'][-1]) - 0xAC00) % 28 else '를'} 고를 수 있어요 ({i['amount_how']}).")
    live = sorted([(r["dday"], i["short"]) for i in base["items"] for r in i["rounds"] if r["status"] == "접수 중"])
    if live:
        facts.append(f"가장 먼저 마감되는 건 {live[0][1]}(D-{live[0][0]})예요.")
    elif all(i["deadline"].startswith("올해 접수 끝") or i["deadline"] == "상시" for i in ch):
        facts.append(f"{today.month}월 {today.day}일 기준으로 올해 접수는 끝났어요. 내년 공고가 나오면 신청할 수 있어요.")

    more = more_policies(p, today)
    if more:
        cnt = {}
        for m in more:
            cnt[m["kind"]] = cnt.get(m["kind"], 0) + 1
        facts.append(f"그 밖에 조건이 맞을 수 있는 서울 청년 주거 지원을 {len(more)}개 더 찾았어요 ("
                     + ", ".join(f"{k} {v}개" for k, v in cnt.items()) + "). 금액·조건은 공고마다 달라 총액에는 넣지 않았어요.")

    calendar = [{"key": i["key"], "name": i["short"], "color": i["color"], "start": r["start"], "end": r["end"], "status": r["status"]}
                for i in base["items"] for r in i["rounds"] if r["start"]]
    return {
        "step": 2, "기준일": today.isoformat(), "기준일_설명": "본선 시연일 (실제 날짜 기준)",
        "집_예산": p.get("housing_plan"),
        "추천": " + ".join(i["short"] for i in ch), "추천_total": base["total"],
        "policies": base["items"], "jeonse_alternatives": jeonse_alt, "more_policies": more,
        "warnings": base["warnings"], "what_if": wi, "calendar": calendar,
        "요약": [f"{i['short']}: {i['status']} · {i['amount']:g}만 원 · {i['deadline']}" + (f" (→ {SHORT[i['excluded_by']]}와 중복 불가로 제외)" if i.get('excluded_by') else "") for i in base["items"]],
        "근거": facts,
    }


if __name__ == "__main__":
    res = run()
    hp = res["집_예산"] or {}
    print(f"■ STEP 2 · 기준일 {res['기준일']} · 집 예산 {hp.get('type')} 보증금 {hp.get('deposit')}만 / 월세 {hp.get('monthly')}만")
    for line in res["요약"]:
        print("  -", line)
    print(f"  → 추천 조합: {res['추천']} = 최대 {res['추천_total']:g}만 원")
    print(f"\n■ 더 찾아본 지원 {len(res['more_policies'])}개 (온통청년·정부24 · RAG가 조건 판정 · 총액 제외)")
    for m in res["more_policies"]:
        print(f"  [{m['kind']}] {m['name']} · {m['org']} · {m['status']}")
    print("\n■ 근거 (AI는 이 문장만 사용)")
    for f in res["근거"]:
        print("  -", f)
    with open(os.path.join(OUT, "policy_result.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    print("\n저장 → processed/step2_support/policy_result.json")
