"""정부24 공공서비스(혜택) API 전체 수집: serviceList + supportConditions.

실행: python scripts/collect_gov24.py
결과: raw/gov24/gov24_serviceList_YYYYMMDD.json
      raw/gov24/gov24_supportConditions_YYYYMMDD.json
"""
import time

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, get_json, require_env, save_json, today

BASE = "https://api.odcloud.kr/api/gov24/v3"
PER_PAGE = 500


def fetch_all(endpoint, key):
    rows, page, total = [], 1, None
    while True:
        data = get_json(f"{BASE}/{endpoint}", {"page": page, "perPage": PER_PAGE, "serviceKey": key})
        if "data" not in data:
            raise SystemExit(f"[에러] {endpoint} 응답 이상: {data}")
        total = data.get("totalCount")
        rows.extend(data["data"])
        print(f"{endpoint} page {page}: +{len(data['data'])} (누적 {len(rows)}/{total})")
        if not data["data"] or len(rows) >= total:
            break
        page += 1
        time.sleep(0.3)
    return rows, total


def main():
    key = require_env("DATA_GO_KR_API_KEY")
    for ep in ["serviceList", "supportConditions"]:
        rows, total = fetch_all(ep, key)
        out = {"meta": {"source": f"{BASE}/{ep}", "collected_at": today(), "totalCount": total, "collected": len(rows)},
               "data": rows}
        save_json(out, ROOT / "raw" / "gov24" / f"gov24_{ep}_{today()}.json")


if __name__ == "__main__":
    main()
