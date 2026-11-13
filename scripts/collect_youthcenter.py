"""온통청년 청년정책 API 전체 수집.

API의 검색 조건(plcyNm, zipCd, lclsfNm)이 실제로는 적용되지 않아서(2026-11-10 테스트),
전체를 받은 뒤 filter_seoul_housing.py 로 직접 거른다.

실행: python scripts/collect_youthcenter.py
결과: raw/youthcenter/youthcenter_policies_all_YYYYMMDD.json
"""
import time

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, get_json, require_env, save_json, today

URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
PAGE_SIZE = 100  # 100건까지 정상 확인


def main():
    key = require_env("YOUTHCENTER_API_KEY")
    policies, page, total = {}, 1, None
    while True:
        data = get_json(URL, {"apiKeyNm": key, "pageNum": page, "pageSize": PAGE_SIZE, "rtnType": "json"})
        if data.get("resultCode") != 200:
            raise SystemExit(f"[에러] API 응답 이상: {data}")
        result = data["result"]
        total = result["pagging"]["totCount"]
        rows = result.get("youthPolicyList") or []
        for p in rows:
            policies[p["plcyNo"]] = p  # 정책번호로 중복 제거
        print(f"page {page}: +{len(rows)} (누적 {len(policies)}/{total})")
        if not rows or page * PAGE_SIZE >= total:
            break
        page += 1
        time.sleep(0.3)  # 서버 부담 줄이기

    out = {
        "meta": {"source": URL, "collected_at": today(), "totCount_reported": total, "collected": len(policies)},
        "youthPolicyList": list(policies.values()),
    }
    save_json(out, ROOT / "raw" / "youthcenter" / f"youthcenter_policies_all_{today()}.json")
    if len(policies) < total:
        print(f"[주의] 받은 건수({len(policies)})가 전체({total})보다 적어요. 다시 실행해 보세요.")


if __name__ == "__main__":
    main()
