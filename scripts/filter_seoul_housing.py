"""raw 수집본에서 '서울 청년이 받을 수 있는 주거 정책'만 골라 정리.

실행: python scripts/filter_seoul_housing.py            (raw 폴더의 최신 파일 자동 선택)
      python scripts/filter_seoul_housing.py --age 27   (나이 조건까지 적용)
결과: processed/youthcenter_seoul_housing.json / .csv
      processed/gov24_housing.json / .csv   (정부24 raw가 있을 때만)

코드 뜻(aplyPrdSeCd, earnCndSeCd)은 데이터로 추정한 값이라 코드정의서로 최종 확인 필요.
"""
import argparse
import csv
import json
import re
from pathlib import Path

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, save_json

KEYWORDS = ["월세", "전세", "임차", "보증금", "이사", "중개", "주거", "주택", "임대", "기숙사"]

APPLY_PERIOD = {"0057001": "특정기간", "0057002": "상시/미정", "0057003": "연중"}   # 추정
EARN_COND = {"0043001": "무관", "0043002": "연소득 금액 제한", "0043003": "기타(문장)"}  # 추정


def latest(pattern):
    files = sorted((ROOT / "raw").glob(pattern))
    return files[-1] if files else None


def ymd(s):
    s = (s or "").strip()
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if re.fullmatch(r"\d{8}", s) else None


def has_kw(*texts):
    t = " ".join(x or "" for x in texts)
    return any(k in t for k in KEYWORDS)


def age_ok(age, lo, hi):
    if age is None:
        return True
    try:  # 값이 없거나(None/빈칸) 0이면 제한 없음으로 봄
        lo = int(lo) if lo not in (None, "") and str(lo).strip() not in ("", "0") else 0
        hi = int(hi) if hi not in (None, "") and str(hi).strip() not in ("", "0") else 200
    except (ValueError, TypeError):
        return True
    return lo <= age <= hi


# ---------------- 온통청년 ----------------
def filter_youthcenter(path, age):
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = rows.get("youthPolicyList") or rows.get("result", {}).get("youthPolicyList", [])
    out = []
    for p in rows:
        zips = [z.strip() for z in (p.get("zipCd") or "").split(",") if z.strip()]
        seoul_zips = [z for z in zips if z.startswith("11")]
        if not seoul_zips:
            continue
        if "주거" not in (p.get("lclsfNm") or "") and not has_kw(p.get("plcyNm"), p.get("plcyExplnCn"),
                                                                p.get("plcySprtCn"), p.get("plcyKywdNm")):
            continue
        if not age_ok(age, p.get("sprtTrgtMinAge"), p.get("sprtTrgtMaxAge")):
            continue
        start = end = None
        m = re.match(r"\s*(\d{8})\s*~\s*(\d{8})", p.get("aplyYmd") or "")
        if m:
            start, end = ymd(m.group(1)), ymd(m.group(2))
        scope = "전국/다지역" if len(zips) > len(seoul_zips) else ("서울 전역" if len(seoul_zips) >= 25 else "서울 일부 자치구")
        out.append({
            "id": p["plcyNo"], "name": p["plcyNm"], "category": f"{p.get('lclsfNm')} > {p.get('mclsfNm')}",
            "org": p.get("sprvsnInstCdNm"), "top_org": p.get("rgtrHghrkInstCdNm"), "scope": scope,
            "age_min": p.get("sprtTrgtMinAge"), "age_max": p.get("sprtTrgtMaxAge"),
            "apply_type": APPLY_PERIOD.get(p.get("aplyPrdSeCd"), p.get("aplyPrdSeCd")),
            "apply_start": start, "apply_end": end,
            "income_type": EARN_COND.get(p.get("earnCndSeCd"), p.get("earnCndSeCd")),
            "income_max_manwon": p.get("earnMaxAmt"), "income_text": p.get("earnEtcCn"),
            "support": p.get("plcySprtCn"), "extra_qualification": p.get("addAplyQlfcCndCn"),
            "excluded": p.get("ptcpPrpTrgtCn"),  # 참여제한대상 → 중복 수혜 경고 근거
            "how_to_apply": p.get("plcyAplyMthdCn"), "url": p.get("aplyUrlAddr") or p.get("refUrlAddr1"),
            "seoul_zip_count": len(seoul_zips),
        })
    return out


# ---------------- 정부24 ----------------
def filter_gov24(list_path, cond_path, age):
    services = json.loads(Path(list_path).read_text(encoding="utf-8"))["data"]
    conds = {}
    if cond_path:
        for c in json.loads(Path(cond_path).read_text(encoding="utf-8"))["data"]:
            conds[c["서비스ID"]] = c
    out = []
    for s in services:
        org, org_type = s.get("소관기관명") or "", s.get("소관기관유형") or ""
        if not ("서울" in org or org_type in ("중앙행정기관", "공공기관")):
            continue
        if s.get("서비스분야") != "주거·자립" and not has_kw(s.get("서비스명"), s.get("서비스목적요약")):
            continue
        c = conds.get(s["서비스ID"], {})
        if c and not age_ok(age, c.get("JA0110"), c.get("JA0111")):
            continue
        out.append({
            "id": s["서비스ID"], "name": s["서비스명"], "field": s.get("서비스분야"), "org": org, "org_type": org_type,
            "age_min": c.get("JA0110"), "age_max": c.get("JA0111"),
            "one_person_household": c.get("JA0404"), "homeless_household": c.get("JA0412"),
            "apply_period_text": s.get("신청기한"), "apply_period_type": s.get("신청기한유형"),
            "summary": s.get("서비스목적요약"), "criteria": s.get("선정기준"), "target": s.get("지원대상"),
            "support": s.get("지원내용"), "url": s.get("상세조회URL"),
        })
    return out


def save_csv(rows, path):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8-sig") as f:  # 엑셀에서 한글 안 깨지게
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"저장: {Path(path).relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--youth", help="온통청년 raw json (기본: raw/youthcenter 최신)")
    ap.add_argument("--gov24-list", help="정부24 serviceList raw json")
    ap.add_argument("--gov24-cond", help="정부24 supportConditions raw json")
    ap.add_argument("--age", type=int, default=None, help="나이 조건 (예: 27)")
    a = ap.parse_args()

    yc = a.youth or latest("youthcenter/youthcenter_policies_all_*.json")
    if yc:
        rows = filter_youthcenter(yc, a.age)
        save_json({"meta": {"from": Path(yc).name, "age": a.age, "count": len(rows),
                            "note": "apply_type/income_type 은 코드 추정값"}, "policies": rows},
                  ROOT / "processed" / "youthcenter_seoul_housing.json")
        save_csv(rows, ROOT / "processed" / "youthcenter_seoul_housing.csv")
        print(f"온통청년 서울 주거 정책: {len(rows)}건")
    else:
        print("온통청년 raw 파일이 없어요. collect_youthcenter.py 를 먼저 실행하세요.")

    gl = a.gov24_list or latest("gov24/gov24_serviceList_*.json")
    gc = a.gov24_cond or latest("gov24/gov24_supportConditions_*.json")
    if gl:
        rows = filter_gov24(gl, gc, a.age)
        save_json({"meta": {"from": [Path(gl).name, Path(gc).name if gc else None], "age": a.age, "count": len(rows)},
                   "services": rows}, ROOT / "processed" / "gov24_housing.json")
        save_csv(rows, ROOT / "processed" / "gov24_housing.csv")
        print(f"정부24 주거 혜택: {len(rows)}건")


if __name__ == "__main__":
    main()
