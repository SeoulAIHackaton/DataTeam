"""
STEP 2 · 주거 전략 + 2년 살아보기
  processed/ 데이터로 전략 A(전세+대출) · B(월세) · C(청년안심주택 대기)의
  초기 목돈, 월 비용, 2년 총비용을 코드로 계산하고 근거 문장을 만든다.
  덤: STEP 4 후보 집 월세가 동네 시세보다 비싼지 비교 (processed/step4/homes_summary.csv 있으면)

실행: python scripts/strategy.py            (파이썬 표준 라이브러리만)
입력: processed/profile_demo.json            (STEP 1 대화 결과, 없으면 아래 기본값)
결과: processed/step2/strategy_result.json  (+ 화면 그래프용 월별 누적 비용)

원칙: 금액은 전부 코드가 계산. AI는 '근거' 문장만 받아 설명 (scripts/explain.py --step 2)
금액 단위: 만원
"""
import csv
import json
import os
import re
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(BASE, "processed")
OUT = os.path.join(PROC, "step2")
os.makedirs(OUT, exist_ok=True)

MONTHS = 24                 # 2년 살아보기
REF_DATE = date(2026, 11, 11)   # 계산 기준일 (대기기간 계산용)

DEFAULT_PROFILE = {         # README 페르소나: 27세, 월 230만, 자산 2천
    "name": "정연", "age": 27, "household": "단독세대주", "homeless": True, "region": "서울",
    "income_annual": 2760, "income_monthly_won": 2300000, "asset": 2000,
    "cash": 2000,           # 보증금으로 쓸 수 있는 돈
    "area": {"gu": "관악구", "dong": "신림동"},          # 살고 싶은 동네 (STEP 1)
    "frequent_place": "멀티캠퍼스 역삼",
}


def load(name):
    with open(os.path.join(PROC, name), encoding="utf-8") as f:
        return json.load(f)


def profile():
    p = os.path.join(PROC, "profile_demo.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return {**DEFAULT_PROFILE, **json.load(f)}
    return dict(DEFAULT_PROFILE)


RENT = load("rent_median_seoul.json")
LOANS = {p["id"]: p for p in load("loan_products.json")["products"]}
SH = load("sh_youth_housing.json")
with open(os.path.join(PROC, "rent_conversion_rate_2026Q3.csv"), encoding="utf-8-sig") as f:
    CONV = {r["자치구"]: float(r["연립다세대_전환율(%)"]) for r in csv.DictReader(f)}

# 가까운 자치구 (청년안심주택 후보를 찾을 범위)
NEAR = {
    "관악구": ["관악구", "동작구", "금천구", "구로구", "영등포구", "서초구"],
    "강남구": ["강남구", "서초구", "송파구", "강동구", "동작구", "성동구"],
    "성동구": ["성동구", "광진구", "동대문구", "중랑구", "용산구", "강동구"],
}


def r1(v):
    return round(v, 1)


def won(v):            # 만원 → "1.2억" / "400만"
    if v >= 10000:
        return f"{v/10000:.2f}".rstrip("0").rstrip(".") + "억"
    return f"{r1(v):g}만"


# ───────────── 데이터 조회 ─────────────
def market(gu, dong, rent_type):
    """동네 원룸 시세 (표본 부족하면 구 전체 값)"""
    rows = [t for t in RENT["table"] if t["gu"] == gu and t["rent_type"] == rent_type and t["area_bin"] == "전체"]
    d = next((t for t in rows if t["dong"] == dong and t["sample_ok"]), None)
    g = next((t for t in rows if t["dong"] == "(구 전체)"), None)
    row = d or g
    return {**row, "level": "동" if d else "구"} if row else None


def conv_rate(gu):
    return CONV.get(gu, CONV["서울시 평균"])


def jeonse_loan_for(p):
    return LOANS["youth_jeonse_loan"] if p["age"] <= 34 else LOANS["general_jeonse_loan"]


def jeonse_rate(loan_prod, income, deposit):
    if loan_prod["id"] == "youth_jeonse_loan":
        for b in loan_prod["rate"]["by_income"]:
            if income <= b["income_max"]:
                return b["rate"]
    else:
        key = "deposit_le_5000" if deposit <= 5000 else "deposit_le_10000" if deposit <= 10000 else "deposit_over_10000"
        for b in loan_prod["rate"]["by_income_and_deposit"]:
            if income <= b["income_max"]:
                return b[key]
    return None


def loan_ok(prod, p, deposit=None, monthly=None, public=False):
    """대출 자격 (코드로 볼 수 있는 것만). 반환: (가능 여부, 안 되는 이유 목록)"""
    e, t, why = prod["eligibility"], prod["target_house"], []
    amax = e.get("age_max")
    if p["age"] < e["age_min"] or (amax and p["age"] > amax):
        why.append(f"나이 {e['age_min']}~{amax}세 조건")
    if p["income_annual"] > e["income_max"]:
        why.append(f"연소득 {e['income_max']}만 원 이하 조건")
    if p["asset"] > e["net_asset_max"]:
        why.append(f"순자산 {e['net_asset_max']}만 원 이하 조건")
    dmax = t.get("deposit_max") or t.get("deposit_max_capital_area")
    if deposit is not None and dmax and deposit > dmax:
        why.append(f"보증금 {dmax}만 원 이하 주택만")
    if monthly is not None and t.get("monthly_rent_max") and monthly > t["monthly_rent_max"]:
        why.append(f"월세 {t['monthly_rent_max']}만 원 이하 주택만")
    if public and not t.get("public_rental_target_allowed"):
        why.append("공공임대주택에는 못 씀")
    return (not why), why


# ───────────── 전략 A · 전세 + 버팀목 ─────────────
def jeonse_case(p, deposit):
    prod = jeonse_loan_for(p)
    ok, why = loan_ok(prod, p, deposit=deposit)
    ratio = prod["limit"]["ratio_new_contract"]
    limit = prod["limit"].get("max") or prod["limit"].get("max_capital_area")
    cap = min(limit, deposit * ratio) if ok else 0
    loan = min(cap, max(0, deposit - p["cash"]))
    cash_need = deposit - loan
    rate = jeonse_rate(prod, p["income_annual"], deposit) if ok else 0
    interest = loan * rate / 100 / 12
    return {"deposit": deposit, "loan": loan, "loan_cap": cap, "cash_need": cash_need, "rate": rate,
            "monthly": interest, "shortfall": max(0, cash_need - p["cash"]), "product": prod["name"],
            "loan_ok": ok, "loan_why": why}


def strategy_a(p):
    gu, dong = p["area"]["gu"], p["area"]["dong"]
    m = market(gu, dong, "전세")
    base = jeonse_case(p, m["deposit_median"])
    alt = jeonse_case(p, m["deposit_p25"]) if base["shortfall"] > 0 else None
    use = alt if (alt and alt["shortfall"] == 0) else base
    feasible = use["shortfall"] == 0 and use["loan_ok"]
    monthly = use["monthly"]
    eq = use["deposit"] * conv_rate(gu) / 100 / 12          # 전세금을 월세로 환산하면
    facts = []
    if base["shortfall"] > 0:
        facts.append(f"{dong} 원룸 전세 중앙값은 {won(base['deposit'])} 원이라, {base['product']} 최대 {won(base['loan_cap'])} 원을 받아도 목돈이 {won(base['shortfall'])} 원 부족해요.")
        if alt and alt["shortfall"] == 0:
            facts.append(f"싼 편(하위 25%)인 {won(alt['deposit'])} 원짜리 전세라면 대출 {won(alt['loan'])} 원으로 가능해요.")
    else:
        facts.append(f"{dong} 원룸 전세 중앙값 {won(base['deposit'])} 원에 {base['product']} {won(base['loan'])} 원을 받으면 돼요.")
    if feasible:
        facts.append(f"대출 이자는 연 {use['rate']}%로 한 달 약 {r1(monthly)}만 원, 2년 동안 약 {r1(monthly*MONTHS)}만 원이에요. 보증금은 2년 뒤 돌려받아요.")
    facts.append(f"전세금 {won(use['deposit'])} 원은 {gu} 전환율 {conv_rate(gu)}%로 치면 월세 약 {r1(eq)}만 원과 같은 값이에요.")
    return {
        "key": "A", "name": "전세 + 버팀목 대출", "feasible": feasible,
        "deposit": use["deposit"], "loan": use["loan"], "cash_need": use["cash_need"],
        "monthly_phases": [{"months": MONTHS, "monthly": r1(monthly), "what": f"대출 이자 (연 {use['rate']}%)"}],
        "total": r1(monthly * MONTHS), "price_basis": "하위 25% 전세" if use is alt else "전세 중앙값",
        "market": {"deposit_median": m["deposit_median"], "deposit_p25": m["deposit_p25"], "n": m["n"], "level": m["level"]},
        "warnings": ([f"대출 조건 미충족: {', '.join(use['loan_why'])}"] if not use["loan_ok"] else []) +
                    ["변동금리라 실제 금리는 신청 시점에 확인 (확인일 2026-11-10)", "전세보증금 반환보증 가입 권장"],
        "facts": facts,
    }


# ───────────── 전략 B · 월세 ─────────────
def strategy_b(p):
    gu, dong = p["area"]["gu"], p["area"]["dong"]
    m = market(gu, dong, "월세")
    dep, mon = m["deposit_median"], m["monthly_median"]
    loan, interest, note = 0, 0, None
    if dep > p["cash"]:            # 보증금이 모자라면 청년 보증부월세대출
        prod = LOANS["youth_monthly_rent_loan"]
        ok, why = loan_ok(prod, p, deposit=dep, monthly=mon)
        if ok:
            loan = min(prod["limit"]["deposit_loan_max"], dep * 0.7, dep - p["cash"])
            interest = loan * prod["rate"]["deposit"] / 100 / 12
            note = f"보증금 중 {won(loan)} 원은 청년 보증부월세대출(연 {prod['rate']['deposit']}%)"
    monthly = mon + interest
    feasible = dep - loan <= p["cash"]
    facts = [f"{dong} 원룸 월세 중앙값은 보증금 {won(dep)} 원에 월 {r1(mon)}만 원이에요 (최근 1년 신고 {m['n']:,}건)."]
    facts.append(f"2년 동안 월세로 약 {r1(monthly*MONTHS)}만 원이 나가요. 대신 처음 목돈은 {won(dep - loan)} 원이면 돼요.")
    if note:
        facts.append(note + "로 마련해요.")
    facts.append("3단계 월세 지원을 받으면 이 금액이 더 줄어들어요.")
    return {
        "key": "B", "name": "월세", "feasible": feasible,
        "deposit": dep, "loan": loan, "cash_need": dep - loan,
        "monthly_phases": [{"months": MONTHS, "monthly": r1(monthly), "what": "월세" + (" + 보증금 대출 이자" if loan else "")}],
        "total": r1(monthly * MONTHS), "price_basis": "월세 중앙값",
        "market": {"deposit_median": dep, "monthly_median": mon, "monthly_p25": m["monthly_p25"], "monthly_p75": m["monthly_p75"], "n": m["n"], "level": m["level"]},
        "warnings": ["신고된 거래 기준 (미신고 저가 월세는 빠졌을 수 있음)", "관리비 별도"],
        "facts": facts,
    }


# ───────────── 전략 C · 청년안심주택 ─────────────
def sh_rank(p):
    inc100 = SH["eligibility_youth"]["income_monthly_won"]["1인"]["100%"]
    r3 = SH["eligibility_youth"]["rank"]["3"]
    if not (19 <= p["age"] <= 39) or not p["homeless"]:
        return None, "만 19~39세 무주택 미혼만 신청 가능"
    if p["income_monthly_won"] <= inc100 and p["asset"] <= r3["asset_max"]:
        return "3", r3["rent_level"]
    return None, "소득·자산 기준 초과"


def next_move_in(ref):
    """공고(3/31, 7/31) 후 약 6개월 뒤 입주 → 기준일 이후 첫 공고 기준 입주 예상월"""
    gap = SH["timeline"][0]["months_announce_to_movein"]
    for y in (ref.year, ref.year + 1, ref.year + 2):
        for md in ("03-31", "07-31"):
            ann = date.fromisoformat(f"{y}-{md}")
            if ann > ref:
                mi_m = ann.month + gap
                mi = date(ann.year + (mi_m - 1) // 12, (mi_m - 1) % 12 + 1, 28)
                return ann, mi
    return None, None


def months_between(a, b):
    return (b.year - a.year) * 12 + (b.month - a.month)


def strategy_c(p, b):
    gu = p["area"]["gu"]
    rank, level = sh_rank(p)
    if not rank:
        return {"key": "C", "name": "청년안심주택 (SH)", "feasible": False, "total": None, "facts": [f"청년안심주택은 {level}이라 이 조건으로는 어려워요."], "warnings": [], "monthly_phases": []}
    near = NEAR.get(gu, [gu])
    cands = [c for c in SH["complexes"] if c["gu"] in near and not c.get("note") and c["rent"].get(level)]
    if not cands:
        cands = [c for c in SH["complexes"] if not c.get("note") and c["rent"].get(level)]
    prod = jeonse_loan_for(p)

    def cost(c):
        dep, mon = c["rent"][level]["deposit"], c["rent"][level]["monthly"]
        ok, _ = loan_ok(prod, p, deposit=dep, public=True)
        loan = min(dep * prod["limit"]["ratio_new_contract"], max(0, dep - p["cash"])) if ok else 0
        conv = 0
        if dep - loan > p["cash"]:      # 그래도 모자라면 보증금 일부를 월세로 전환 (최대 50%, 2.5%)
            conv = min(dep * SH["lease_terms"]["conversion"]["deposit_to_monthly"]["max_ratio"], dep - loan - p["cash"])
        rate = jeonse_rate(prod, p["income_annual"], dep) if loan else 0
        monthly = mon + loan * rate / 100 / 12 + conv * SH["lease_terms"]["conversion"]["deposit_to_monthly"]["rate"] / 12
        return {"c": c, "deposit": dep, "rent": mon, "loan": loan, "conv": conv, "rate": rate, "monthly": monthly, "cash_need": dep - loan - conv}

    best = min((cost(c) for c in cands), key=lambda x: (0 if x["c"]["gu"] == gu else 1, x["monthly"]))
    ann, mi = next_move_in(REF_DATE)
    wait = max(0, min(MONTHS, months_between(REF_DATE, mi)))
    b_month = b["monthly_phases"][0]["monthly"]
    total = b_month * wait + r1(best["monthly"]) * (MONTHS - wait)     # 화면에 보이는 월 금액과 합계가 맞도록
    c = best["c"]
    facts = [
        f"소득·자산 기준으로 청년 {rank}순위라 시세의 50% 수준(B형) 임대료예요.",
        f"가까운 단지 중 {c['complex']}({c['gu']}, {c['area_m2']}㎡)은 보증금 {won(best['deposit'])} 원에 월 {best['rent']}만 원이에요.",
        f"다음 공고는 {ann.year}년 {ann.month}월 말, 입주는 {mi.year}년 {mi.month}월쯤이라 그 전 {wait}개월은 월세로 살아야 해요.",
        f"2년 합계는 대기 {wait}개월 월세 + 입주 후 {MONTHS - wait}개월로 약 {r1(total)}만 원이에요.",
    ]
    if best["loan"]:
        facts.append(f"보증금 중 {won(best['loan'])} 원은 {prod['name']}(연 {best['rate']}%)으로 마련해요. 버팀목은 공공임대에도 쓸 수 있어요.")
    return {
        "key": "C", "name": "청년안심주택 (SH) 대기", "feasible": True,
        "deposit": best["deposit"], "loan": best["loan"], "cash_need": best["cash_need"],
        "complex": {k: c[k] for k in ("notice", "complex", "address", "gu", "type", "area_m2", "units")},
        "wait_months": wait, "expected_move_in": f"{mi.year}-{mi.month:02d}",
        "monthly_phases": [{"months": wait, "monthly": b_month, "what": "입주 전 월세 (전략 B와 같음)"},
                           {"months": MONTHS - wait, "monthly": r1(best["monthly"]), "what": "청년안심주택 임대료" + (" + 대출 이자" if best["loan"] else "")}],
        "total": r1(total),
        "warnings": ["당첨이 보장되지 않아요 (순위 → 가점 → 추첨)", "입주하면 국토부 청년월세 지원은 못 받아요 (공공임대 제외)", "관리비는 단지별 별도"],
        "facts": facts,
    }


# ───────────── STEP 4 연결: 후보 집 월세가 시세보다 비싼가? ─────────────
def price_check():
    path = os.path.join(PROC, "step4", "homes_summary.csv")
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            parts = r.get("카카오주소", "").split()
            if len(parts) < 3:
                continue
            gu, dong = parts[1], parts[2]
            m = market(gu, dong, "월세")
            if not m:
                continue
            rent, med = float(r["월세(만원)"]), m["monthly_median"]
            diff = r1(rent - med)
            pos = "비싼 편" if rent > m["monthly_p75"] else "싼 편" if rent < m["monthly_p25"] else "보통"
            word = f"{abs(diff):g}만 원 {'비싸요' if diff > 0 else '싸요'}" if diff else "같아요"
            out.append({"이름": r["이름"], "gu": gu, "dong": dong, "월세": rent, "시세_중앙값": med,
                        "시세_범위": [m["monthly_p25"], m["monthly_p75"]], "차이": diff, "판정": pos, "표본": m["n"], "기준": m["level"],
                        "문장": f"{r['이름']} 월세 {rent:g}만 원은 {dong} 원룸 보통 월세 {med:g}만 원보다 {word} ({pos})."})
    return out


def cumulative(s):
    acc, arr = 0, []
    for ph in s.get("monthly_phases", []):
        for _ in range(ph["months"]):
            acc += ph["monthly"]
            arr.append(r1(acc))
    return arr


def run(p=None):
    p = p or profile()
    b = strategy_b(p)
    S = [strategy_a(p), b, strategy_c(p, b)]
    for s in S:
        s["cumulative"] = cumulative(s)
    ok = [s for s in S if s["feasible"] and s["total"] is not None]
    best = min(ok, key=lambda s: s["total"]) if ok else None
    facts = []
    if best:
        facts.append(f"2년 동안 실제로 나가는 돈이 가장 적은 건 전략 {best['key']}({best['name']}) 약 {best['total']}만 원이에요.")
    for s in S:
        facts += s["facts"]
    others = sorted([s for s in ok if s is not best], key=lambda s: s["total"])
    for s in others:
        facts.append(f"전략 {s['key']}({s['name']})는 {best['key']}보다 2년에 약 {r1(s['total'] - best['total'])}만 원 더 들어요.")
    pc = price_check()
    tidy = lambda t: re.sub(r"(\d)\.0(?=만|%|\b)", r"\1", t)      # 350.0만 → 350만
    facts = [tidy(f) for f in facts]
    for s in S:
        s["facts"] = [tidy(f) for f in s["facts"]]
    return {
        "step": 2, "기준일": REF_DATE.isoformat(), "profile": p,
        "추천": f"전략 {best['key']} {best['name']}" if best else None, "추천_key": best["key"] if best else None,
        "strategies": S,
        "요약": [tidy(f"전략 {s['key']} {s['name']}: " + (f"2년 {s['total']}만 원, 처음 목돈 {won(s['cash_need'])} 원" if s["feasible"] else "지금 조건으로는 어려움")) for s in S],
        "근거": facts, "시세비교": pc,
        "주의": ["금액은 신고 실거래 중앙값과 공고 기준 추정이에요", "대출 금리는 변동 (확인일 2026-11-10)",
                 "보증금(돌려받는 돈)과 목돈이 묶여서 생기는 기회비용은 2년 비용에 넣지 않았어요"],
    }


if __name__ == "__main__":
    res = run()
    p = res["profile"]
    print(f"■ STEP 2 · {p['name']}님 ({p['age']}세, 연소득 {p['income_annual']}만, 목돈 {p['cash']}만) · {p['area']['gu']} {p['area']['dong']}")
    for s in res["strategies"]:
        mark = "★" if s["key"] == res["추천_key"] else " "
        if s["feasible"]:
            ph = " → ".join(f"{x['months']}개월 월 {x['monthly']:g}만" for x in s["monthly_phases"])
            print(f" {mark} {s['key']} {s['name']}: 2년 {s['total']:g}만 원 | 처음 목돈 {won(s['cash_need'])} | {ph}")
        else:
            print(f"   {s['key']} {s['name']}: 어려움")
    print("\n■ 근거 (AI는 이 문장만 사용)")
    for f in res["근거"]:
        print("  -", f)
    if res["시세비교"]:
        print("\n■ STEP 4 후보 집 시세 비교")
        for x in res["시세비교"]:
            print("  -", x["문장"])
    with open(os.path.join(OUT, "strategy_result.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    print(f"\n저장 → processed/step2/strategy_result.json")
