"""LH 서울 임대주택 공고 수집 (공고 목록 + 공고별 공급정보).

실행: python scripts/collect_lh.py
      python scripts/collect_lh.py --no-supply  # 공급정보 API 활용신청 전이면 목록만

결과: raw/lh/lh_notices_YYYYMMDD.json   (공고 목록, 원본 그대로)
      raw/lh/lh_supply_YYYYMMDD.json    (공고별 공급정보 응답, 원본 그대로)

API (둘 다 공공데이터포털, DATA_GO_KR_API_KEY 하나로 사용)
  - 분양임대공고문 조회:      B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1
  - 분양임대공고별 공급정보:  B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1  ← 별도 활용신청 필요(자동승인)

공고 목록 API는 날짜를 바꿔도 최근 공고만 돌려줘요 → 주기적으로 돌려서 누적하세요.
"""
import argparse
import time
from datetime import date, timedelta

import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from common import ROOT, get_json, require_env, save_json, today

NOTICE_URL = "https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1"
SUPPLY_URL = "https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1"
# 06 임대주택(행복주택·국민임대·통합공공임대 등), 13 주거복지(매입임대·전세임대 등 → 청년 매입임대가 여기 있을 수 있음)
UPP_AIS_TP_CDS = ["06", "13"]
CNP_CD = "11"          # 서울특별시
PG_SZ = 100
WINDOW_DAYS = 60


def parse_list(resp):
    """응답은 [ {dsSch}, {dsList, resHeader} ] 형태."""
    rows = []
    if isinstance(resp, list):
        for part in resp:
            if isinstance(part, dict) and "dsList" in part:
                rows.extend(part["dsList"] or [])
    return rows


def fetch_notices(key, months, upp):
    """날짜 파라미터를 바꿔도 최근 공고만 똑같이 돌아와서(테스트 확인), 한 번만 조회해요.
    과거 공고를 쌓으려면 이 스크립트를 주기적으로 돌려서 파일을 누적해야 해요."""
    end = date.today()
    start = end - timedelta(days=months * 30)
    seen, rows, page = set(), [], 1
    while True:
        resp = get_json(NOTICE_URL, {
            "serviceKey": key, "PG_SZ": PG_SZ, "PAGE": page,
            "UPP_AIS_TP_CD": upp, "CNP_CD": CNP_CD,
            "PAN_NT_ST_DT": start.strftime("%Y.%m.%d"), "CLSG_DT": end.strftime("%Y.%m.%d"),
        })
        batch = parse_list(resp)
        new = [r for r in batch if r.get("PAN_ID") not in seen]
        seen.update(r.get("PAN_ID") for r in new)
        rows.extend(new)
        total = int(batch[0].get("ALL_CNT", 0)) if batch else 0
        print(f"[{upp}] page {page}: {len(batch)}건 (누적 {len(rows)}/{total})")
        if not batch or page * PG_SZ >= total:
            break
        page += 1
        time.sleep(0.3)
    return rows


def fetch_supply(key, notices):
    out = []
    for n in notices:
        params = {
            "serviceKey": key,
            "SPL_INF_TP_CD": n.get("SPL_INF_TP_CD", ""),
            "CCR_CNNT_SYS_DS_CD": n.get("CCR_CNNT_SYS_DS_CD", ""),
            "PAN_ID": n.get("PAN_ID", ""),
            "UPP_AIS_TP_CD": n.get("UPP_AIS_TP_CD", ""),
            "AIS_TP_CD": n.get("AIS_TP_CD", ""),
        }
        try:
            resp = get_json(SUPPLY_URL, params, retries=2)
        except SystemExit as e:
            print(f"[건너뜀] 공급정보 호출 실패: {n.get('PAN_NM')}\n"
                  "  403이면 「분양임대공고별 공급정보 조회 서비스」 활용신청이 안 됐거나 아직 반영 전(신청 후 1~2시간)이에요.")
            resp = {"_error": str(e).splitlines()[0]}
        else:
            print(f"공급정보: {n.get('PAN_NM')}")
        out.append({"PAN_ID": n.get("PAN_ID"), "PAN_NM": n.get("PAN_NM"), "request": {k: v for k, v in params.items() if k != "serviceKey"}, "response": resp})
        time.sleep(0.3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--no-supply", action="store_true")
    args = ap.parse_args()

    key = require_env("DATA_GO_KR_API_KEY")
    notices = []
    for upp in UPP_AIS_TP_CDS:
        notices += fetch_notices(key, args.months, upp)
    for n in notices:
        print(f"  - [{n.get('UPP_AIS_TP_NM')}/{n.get('AIS_TP_CD_NM')}] {n.get('PAN_NM')} ({n.get('PAN_SS')}, 마감 {n.get('CLSG_DT')})")
    save_json({"meta": {"source": NOTICE_URL, "collected_at": today(), "region": "서울", "type": "임대주택(06) + 주거복지(13)",
                        "months": args.months, "collected": len(notices)},
               "dsList": notices},
              ROOT / "raw" / "lh" / f"lh_notices_{today()}.json")

    if not args.no_supply and notices:
        supply = fetch_supply(key, notices)
        save_json({"meta": {"source": SUPPLY_URL, "collected_at": today(), "collected": len(supply)},
                   "items": supply},
                  ROOT / "raw" / "lh" / f"lh_supply_{today()}.json")


if __name__ == "__main__":
    main()
