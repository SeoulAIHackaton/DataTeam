"""서울시 부동산 전월세가 정보 Open API(tbLnOpendataRentV) 수집.

실행: python scripts/collect_seoul_rent.py                   # 올해 접수분 전체
      python scripts/collect_seoul_rent.py --year 2025 2026  # 여러 해
      python scripts/collect_seoul_rent.py --gu 11680         # 강남구만 (빠른 테스트용)
결과: raw/seoul_rent/seoul_rent_api_{접수연도}[_{자치구코드}]_YYYYMMDD.json   (원본 row 그대로)

- 서울 열린데이터광장 OA-21276, 인증키는 .env 의 SEOUL_OPEN_API_KEY
- 호출 형식: http://openapi.seoul.go.kr:8088/{KEY}/json/tbLnOpendataRentV/{시작}/{끝}/{접수연도}/{자치구코드}
- 한 번에 최대 1,000건 → 1,000건씩 끝까지 반복
- Open API는 최근 3년치만 제공 (그 이전은 파일 다운로드)
- 접수연도·자치구코드 필터가 실제로 먹었는지 응답 값으로 검사하고, 아니면 멈춰요
"""
import argparse
import json
import time
import urllib.error
import urllib.request
from datetime import datetime

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, require_env, save_json, today

BASE = "http://openapi.seoul.go.kr:8088"
SERVICE = "tbLnOpendataRentV"
PAGE = 1000


def call(key, start, end, year, gu, retries=4):
    path = f"{BASE}/{key}/json/{SERVICE}/{start}/{end}/{year}/"
    if gu:
        path += f"{gu}/"
    last = None
    for i in range(retries):
        try:
            with urllib.request.urlopen(path, timeout=60) as r:
                body = json.loads(r.read().decode("utf-8"))
            if SERVICE in body:
                return body[SERVICE]
            res = body.get("RESULT", {})
            if res.get("CODE") == "INFO-200":   # 해당 데이터 없음
                return {"list_total_count": 0, "row": []}
            raise SystemExit(f"[에러] API 응답 이상: {res or body}\n"
                             "  ERROR-300/INFO-100 이면 인증키 확인, ERROR-336 이면 한 번에 1,000건 초과")
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            last = e
            print(f"  재시도 {i + 1}/{retries} ({e}) → {2 ** i}s 대기")
            time.sleep(2 ** i)
    raise SystemExit(f"[에러] 요청 실패: {last}")


def collect(key, year, gu):
    first = call(key, 1, PAGE, year, gu)
    total = int(first.get("list_total_count", 0))
    rows = list(first.get("row", []))
    print(f"[{year}{' ' + gu if gu else ''}] 전체 {total:,}건")

    # 필터가 무시되고 전체가 오는지 검사
    bad_year = [r for r in rows if str(r.get("RCPT_YR")) != str(year)]
    bad_gu = [r for r in rows if gu and str(r.get("CGG_CD")) != str(gu)]
    if bad_year or bad_gu:
        sample = (bad_year or bad_gu)[0]
        raise SystemExit("[에러] 접수연도/자치구 필터가 적용되지 않았어요 (인자 순서가 다를 수 있음).\n"
                         f"  받은 예시: RCPT_YR={sample.get('RCPT_YR')}, CGG_CD={sample.get('CGG_CD')}\n"
                         "  열린데이터광장 OA-21276 'Open API' 탭의 요청인자 순서를 확인해 주세요.")

    start = PAGE + 1
    while start <= total:
        end = min(start + PAGE - 1, total)
        part = call(key, start, end, year, gu)
        rows.extend(part.get("row", []))
        print(f"  {start:,}~{end:,} (누적 {len(rows):,}/{total:,})")
        start = end + 1
        time.sleep(0.2)
    return rows, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", nargs="+", type=int, default=[datetime.now().year], help="접수연도 (최근 3년 안)")
    ap.add_argument("--gu", default="", help="자치구코드 5자리 (예: 11680 강남구). 비우면 서울 전체")
    a = ap.parse_args()

    key = require_env("SEOUL_OPEN_API_KEY")
    for year in a.year:
        rows, total = collect(key, year, a.gu)
        suffix = f"_{a.gu}" if a.gu else ""
        save_json({"meta": {"source": f"{BASE}/{{KEY}}/json/{SERVICE}", "collected_at": today(),
                            "RCPT_YR": year, "CGG_CD": a.gu or "전체",
                            "list_total_count": total, "collected": len(rows)},
                   "row": rows},
                  ROOT / "raw" / "seoul_rent" / f"seoul_rent_api_{year}{suffix}_{today()}.json")


if __name__ == "__main__":
    main()
