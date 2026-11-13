"""데이터 준비 상태 점검: 필요한 raw/processed 파일이 다 있는지, 건수가 맞는지 확인.

실행: python scripts/check_data.py
"""
import json
from pathlib import Path

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, load_env
import os


def latest(pattern):
    files = sorted(ROOT.glob(pattern))
    return files[-1] if files else None


def count_json(path, key):
    d = json.loads(path.read_text(encoding="utf-8"))
    v = d
    for k in key.split("."):
        v = v.get(k, []) if isinstance(v, dict) else []
    return len(v), d


def line(ok, name, detail=""):
    print(('[OK] ' if ok else '[X]  ') + name + (('  - ' + detail) if detail else ''))
    return ok


def main():
    problems = 0
    print("=== .env 키 ===")
    load_env()
    for k in ["DATA_GO_KR_API_KEY", "YOUTHCENTER_API_KEY", "SEOUL_OPEN_API_KEY"]:
        problems += not line(bool(os.environ.get(k, "").strip()), k)

    print("\n=== STEP 2 ===")
    api = sorted(ROOT.glob("raw/seoul_rent/seoul_rent_api_*.json"))
    years = {}
    for f in api:
        n, d = count_json(f, "row")
        m = d.get("meta", {})
        years[f.name] = (m.get("RCPT_YR"), m.get("CGG_CD"), n, m.get("list_total_count"))
    for name, (yr, gu, n, tot) in years.items():
        full = str(tot) == str(n)
        problems += not line(full, f"전월세 API {name}", f"접수연도 {yr}, 자치구 {gu}, {n:,}/{tot}건")
    if any(gu not in (None, "전체") for _, gu, _, _ in years.values()) and any(gu == "전체" for _, gu, _, _ in years.values()):
        problems += not line(False, "자치구 테스트 파일이 서울 전체 파일과 같이 있음", "중복 집계됨 → 테스트 파일 삭제 후 build_rent_median 재실행")
    if not api:
        problems += not line(False, "전월세 API 수집본 없음", "python scripts/collect_seoul_rent.py --year 2025 2026")

    p = ROOT / "processed/rent_median_seoul.json"
    if p.exists():
        n, d = count_json(p, "table")
        t = d["table"]
        gus = {r["gu"] for r in t}
        bad = sum(1 for r in t if r["area_bin"] == "전체" and r["dong"] != "(구 전체)" and not r["sample_ok"])
        problems += not line(len(gus) == 25, "rent_median_seoul.json",
                             f"{n}행, 자치구 {len(gus)}/25, 기간 {d['meta'].get('period')}, 표본부족 동 {bad}곳")
    else:
        problems += not line(False, "rent_median_seoul.json 없음", "python scripts/build_rent_median.py")

    for f, key, want in [("processed/loan_products.json", "products", 3),
                         ("processed/sh_youth_housing.json", "complexes", 77)]:
        p = ROOT / f
        if p.exists():
            n, _ = count_json(p, key)
            problems += not line(n == want, f, f"{n}건 (기대 {want})")
        else:
            problems += not line(False, f + " 없음")
    p = ROOT / "archive/processed/rent_conversion_rate_2026Q3.csv"  # 주거 전략 단계용 (보관)
    if p.exists():
        rows = len(p.read_text(encoding="utf-8-sig").strip().splitlines()) - 1
        problems += not line(rows == 26, p.name, f"{rows}행 (25개 구 + 평균)")
    else:
        problems += not line(False, p.name + " 없음")

    print("\n=== STEP 2 · 지원 추천 ===")
    f = latest("raw/youthcenter/youthcenter_policies_all_*.json")
    if f:
        n, d = count_json(f, "youthPolicyList")
        tot = d.get("meta", {}).get("totCount_reported")
        problems += not line(n > 3000, f"온통청년 {f.name}", f"{n:,}건 (보고된 전체 {tot})")
    else:
        problems += not line(False, "온통청년 수집본 없음", "python scripts/collect_youthcenter.py")
    for ep in ["serviceList", "supportConditions"]:
        f = latest(f"raw/gov24/gov24_{ep}_*.json")
        if f:
            n, d = count_json(f, "data")
            tot = d.get("meta", {}).get("totalCount")
            problems += not line(n >= (tot or 1), f"정부24 {f.name}", f"{n:,}/{tot}건")
        else:
            problems += not line(False, f"정부24 {ep} 없음", "python scripts/collect_gov24.py")

    p = ROOT / "processed/youthcenter_seoul_housing.json"
    if p.exists():
        n, d = count_json(p, "policies")
        age = d.get("meta", {}).get("age")
        problems += not line(age is None, "youthcenter_seoul_housing.json",
                             f"{n}건, 나이 필터 {age}" + (" → --age 없이 다시 돌리기" if age is not None else ""))
    else:
        problems += not line(False, "youthcenter_seoul_housing.json 없음", "python scripts/filter_seoul_housing.py")
    p = ROOT / "processed/gov24_housing.json"
    problems += not line(p.exists(), "gov24_housing.json", "" if p.exists() else "python scripts/filter_seoul_housing.py")
    p = ROOT / "processed/demo_policies.json"
    if p.exists():
        n, d = count_json(p, "policies")
        problems += not line(n == 4, "demo_policies.json", f"정책 {n}개, 중복 규칙 {len(d.get('duplicate_rules', []))}개")
    else:
        problems += not line(False, "demo_policies.json 없음")

    print(f"\n{'모두 정상' if problems == 0 else f'확인 필요 {problems}건'}")


if __name__ == "__main__":
    main()
