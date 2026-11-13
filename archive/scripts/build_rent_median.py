"""서울시 부동산 전월세가 원본(zip/csv) → 동네별 원룸 시세 중앙값 테이블.

실행: python scripts/build_rent_median.py
      python scripts/build_rent_median.py --max-area 33 --months 12
입력: raw/seoul_rent/ 안의
      - API 수집본 seoul_rent_api_*.json (collect_seoul_rent.py 결과) ← 있으면 이것만 사용 (기본)
      - 없으면 파일 다운로드본 .zip / .csv
      --source api | file 로 직접 고를 수 있음
결과: processed/rent_median_seoul.json / .csv

전처리 규칙 (노션 「서울시 부동산 전월세가 정보」 페이지와 동일)
  - "원룸" 분류가 없음 → 아파트 제외 + 임대면적 ≤ --max-area(기본 40㎡)로 근사
  - 신규 계약만 (갱신 계약은 인상 상한 때문에 시세보다 낮음)
  - 기간은 계약일(CTRT_DAY) 기준, 데이터 안의 가장 최근 계약일부터 --months 개월
  - 평균 대신 중앙값, 표본 5건 미만은 sample_ok=false
  - 금액 단위: 만원
"""
import argparse
import csv
import io
import json
import statistics
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, save_json

# 영문 컬럼명 ← 한글 헤더로 받은 파일도 처리
ALIASES = {
    "CGG_CD": ["CGG_CD", "자치구코드"],
    "CGG_NM": ["CGG_NM", "자치구명"],
    "STDG_CD": ["STDG_CD", "법정동코드"],
    "STDG_NM": ["STDG_NM", "법정동명"],
    "CTRT_DAY": ["CTRT_DAY", "계약일"],
    "RENT_SE": ["RENT_SE", "전월세구분"],
    "RENT_AREA": ["RENT_AREA", "임대면적", "임대면적㎡", "임대면적(㎡)"],
    "GRFE": ["GRFE", "보증금", "보증금만원", "보증금(만원)"],
    "RTFE": ["RTFE", "임대료", "임대료만원", "임대료(만원)"],
    "BLDG_USG": ["BLDG_USG", "건물용도"],
    "NEW_UPDT_YN": ["NEW_UPDT_YN", "신규갱신여부"],
}
AREA_BINS = [(0, 20, "~20㎡"), (20, 33, "20~33㎡"), (33, 999, "33㎡~")]
MIN_SAMPLE = 5


def norm(h):
    return "".join(ch for ch in h.strip().lstrip("﻿") if ch not in " ()")


def decode(raw):
    for enc in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise SystemExit("[에러] CSV 인코딩을 읽지 못했어요 (utf-8/cp949 아님)")


def read_api_rows(files):
    rows = []
    for f in files:
        print(f"읽는 중: {f.name}")
        d = json.loads(f.read_text(encoding="utf-8"))
        for r in d.get("row", []):
            rows.append({k: str(r.get(k, "") or "").strip() for k in ALIASES})
    return rows


def iter_csv_texts(folder):
    files = sorted(folder.glob("*.zip")) + sorted(folder.glob("*.csv"))
    if not files:
        raise SystemExit(f"[에러] {folder.relative_to(ROOT)} 에 API 수집본·zip·csv가 없어요.\n"
                         "  python scripts/collect_seoul_rent.py 를 먼저 실행하거나 원본 파일을 넣어주세요.")
    for f in files:
        if f.suffix == ".zip":
            with zipfile.ZipFile(f) as z:
                for name in z.namelist():
                    if name.lower().endswith(".csv"):
                        print(f"읽는 중: {f.name} / {name}")
                        yield decode(z.read(name))
        else:
            print(f"읽는 중: {f.name}")
            yield decode(f.read_bytes())


def read_rows(folder):
    rows = []
    for text in iter_csv_texts(folder):
        reader = csv.reader(io.StringIO(text))
        header = [norm(h) for h in next(reader)]
        idx = {}
        for key, names in ALIASES.items():
            for n in names:
                if norm(n) in header:
                    idx[key] = header.index(norm(n))
                    break
        missing = [k for k in ALIASES if k not in idx]
        if missing:
            raise SystemExit(f"[에러] 컬럼을 못 찾았어요: {missing}\n헤더: {header}")
        for r in reader:
            if len(r) < len(header):
                continue
            rows.append({k: r[i].strip() for k, i in idx.items()})
    return rows


def to_float(v):
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def pct(vals, q):
    s = sorted(vals)
    if len(s) == 1:
        return s[0]
    return statistics.quantiles(s, n=4, method="inclusive")[q - 1]


def area_bin(a):
    for lo, hi, label in AREA_BINS:
        if lo <= a < hi:
            return label
    return None


def summarize(group):
    dep = [g["GRFE"] for g in group]
    mon = [g["RTFE"] for g in group]
    return {
        "n": len(group),
        "sample_ok": len(group) >= MIN_SAMPLE,
        "deposit_median": statistics.median(dep),
        "deposit_p25": pct(dep, 1), "deposit_p75": pct(dep, 3),
        "monthly_median": statistics.median(mon),
        "monthly_p25": pct(mon, 1), "monthly_p75": pct(mon, 3),
        "area_median": round(statistics.median(g["RENT_AREA"] for g in group), 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-area", type=float, default=40.0, help="원룸으로 볼 최대 임대면적(㎡)")
    ap.add_argument("--months", type=int, default=12, help="가장 최근 계약일부터 몇 개월")
    ap.add_argument("--source", choices=["auto", "api", "file"], default="auto")
    a = ap.parse_args()

    folder = ROOT / "raw" / "seoul_rent"
    api_files = sorted(folder.glob("seoul_rent_api_*.json"))
    use_api = a.source == "api" or (a.source == "auto" and api_files)
    if use_api:
        if not api_files:
            raise SystemExit("[에러] API 수집본이 없어요. python scripts/collect_seoul_rent.py 먼저 실행")
        raw = read_api_rows(api_files)
        source_name = "Open API tbLnOpendataRentV: " + ", ".join(f.name for f in api_files)
    else:
        raw = read_rows(folder)
        source_name = "파일 다운로드본"
    print(f"원본 {len(raw):,}건")
    from collections import Counter
    print("  신규갱신여부 값:", dict(Counter(r["NEW_UPDT_YN"] or "(빈칸)" for r in raw).most_common()))
    print("  건물용도 값:", dict(Counter(r["BLDG_USG"] or "(빈칸)" for r in raw).most_common()))

    rows = []
    for r in raw:
        area, dep, mon = to_float(r["RENT_AREA"]), to_float(r["GRFE"]), to_float(r["RTFE"])
        if area is None or dep is None or mon is None:
            continue
        if "아파트" in r["BLDG_USG"] or area > a.max_area:
            continue
        if r["NEW_UPDT_YN"] != "신규":
            continue
        try:
            day = datetime.strptime(r["CTRT_DAY"][:8], "%Y%m%d")
        except ValueError:
            continue
        rows.append({**r, "RENT_AREA": area, "GRFE": dep, "RTFE": mon, "_day": day})
    if not rows:
        raise SystemExit("[에러] 조건에 맞는 거래가 0건이에요. 신규갱신여부 값이 '신규'인지 확인해 주세요.")

    latest = max(r["_day"] for r in rows)
    since = latest - timedelta(days=a.months * 30)
    rows = [r for r in rows if r["_day"] >= since]
    print(f"원룸 근사·신규·{since:%Y-%m-%d}~{latest:%Y-%m-%d}: {len(rows):,}건")

    groups = defaultdict(list)
    for r in rows:
        b = area_bin(r["RENT_AREA"])
        se = r["RENT_SE"]
        dong = (r["CGG_CD"], r["CGG_NM"], r["STDG_CD"], r["STDG_NM"])
        gu = (r["CGG_CD"], r["CGG_NM"], "", "(구 전체)")
        for loc in (dong, gu):
            groups[(loc, se, "전체")].append(r)
            groups[(loc, se, b)].append(r)

    table = []
    for (loc, se, b), g in sorted(groups.items()):
        table.append({"gu_code": loc[0], "gu": loc[1], "dong_code": loc[2], "dong": loc[3],
                      "rent_type": se, "area_bin": b, **summarize(g)})

    meta = {
        "source": "서울 열린데이터광장 OA-21276 서울시 부동산 전월세가 정보 (" + source_name + ")",
        "built_at": datetime.now().strftime("%Y-%m-%d"),
        "period": [since.strftime("%Y-%m-%d"), latest.strftime("%Y-%m-%d")],
        "filters": {"exclude": "아파트", "max_area_m2": a.max_area, "contract": "신규만"},
        "units": "만원, ㎡",
        "min_sample": MIN_SAMPLE,
        "note": "신고된 거래 기준. 근생 원룸·미신고 저가 월세는 빠졌을 수 있음. dong='(구 전체)' 행은 동 표본이 적을 때 대신 사용",
        "rows": len(table),
    }
    save_json({"meta": meta, "table": table}, ROOT / "processed" / "rent_median_seoul.json")
    out = ROOT / "processed" / "rent_median_seoul.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(table[0].keys()))
        w.writeheader()
        w.writerows(table)
    print(f"저장: {out.relative_to(ROOT)} ({len(table)}행)")


if __name__ == "__main__":
    main()
