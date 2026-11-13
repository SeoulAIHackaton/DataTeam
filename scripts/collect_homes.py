"""
첫집 내비 - 후보 집 데이터 한 번에 모으기
  주소 → 좌표(카카오) → 주변 생활시설(카카오) + 자주 가는 곳까지 대중교통(ODsay) → CSV

실행: VS Code에서 ▶ 버튼 (pip install requests 필요)
결과: processed/step3_homes/ 안에
  - homes_summary.csv   : 집별 요약 (집 비교 화면용)
  - nearest_places.csv  : 집별·종류별 가장 가까운 시설
  - cache.json          : API 원본 응답 (시연 때 API가 막혀도 이걸로 다시 실행됨)
"""
import csv
import json
import os
import sys
import requests

# ───────────────────── 1. 여기만 채우세요 ─────────────────────
import common                      # 팀 공통: firsthome_data/.env 읽기
common.load_env()
KAKAO_KEY = os.environ.get("KAKAO_REST_API_KEY", "")   # .env 에 넣기
ODSAY_KEY = os.environ.get("ODSAY_API_KEY", "")        # .env 에 넣기

HOMES = [
    # 이름, 주소, 보증금(만원), 월세(만원), 관리비(만원, 모르면 0)
    {"이름": "성수", "주소": "서울특별시 성동구 성수동2가 333-76", "보증금": 1000, "월세": 60, "관리비": 0},
    {"이름": "역삼", "주소": "서울특별시 강남구 역삼동 778-26",   "보증금": 1000, "월세": 90, "관리비": 0},
    {"이름": "신림", "주소": "서울특별시 관악구 신림동 502-36",   "보증금": 500,  "월세": 42, "관리비": 0},
]
DESTINATION = {"이름": "멀티캠퍼스 역삼", "주소": "서울특별시 강남구 테헤란로 212"}
COMMUTE_DAYS = 20      # 한 달에 다니는 날 수
RADIUS_M = 1000        # 시설 개수를 셀 반경 (1km ≈ 걸어서 15분)
USE_CACHE = True       # True면 저장된 응답을 먼저 사용 (API 호출 아낌)
# ───────────────────────────────────────────────────────────────

# 생활시설 종류: (카테고리코드 또는 키워드, 상세분류에 들어가야 하는 단어)
PLACE_TYPES = {
    "지하철역": {"category": "SW8", "must": None},
    "대형마트": {"category": "MT1", "must": None},
    "동네슈퍼": {"keyword": "슈퍼마켓", "must": ["슈퍼마켓", "마트"]},
    "편의점":   {"category": "CS2", "must": None},
    "약국":     {"category": "PM9", "must": None},
    "병원":     {"category": "HP8", "must": ["내과", "가정의학과"]},   # 감기 등 아플 때 가는 곳 (치과·피부과 제외)
    "헬스장":   {"keyword": "헬스장", "must": ["피트니스", "헬스"]},
    "공원":     {"keyword": "공원", "must": ["공원"],
                 "exclude": ["음수대", "화장실", "주차장", "입구", "관리사무소", "놀이터", "운동기구"]},
}

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "processed", "step3_homes")
CACHE_PATH = os.path.join(OUT_DIR, "cache.json")
os.makedirs(OUT_DIR, exist_ok=True)

cache = {}
if USE_CACHE and os.path.exists(CACHE_PATH):
    with open(CACHE_PATH, encoding="utf-8") as f:
        cache = json.load(f)


def save_cache():
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def get_json(cache_key, url, params, headers=None):
    """API 호출 + 캐시. 같은 요청은 다시 부르지 않는다."""
    if USE_CACHE and cache_key in cache:
        return cache[cache_key]
    r = requests.get(url, params=params, headers=headers, timeout=10)
    data = r.json()
    if r.status_code != 200:
        print(f"[API 오류] {cache_key}: {r.status_code} {data}")
        sys.exit(1)
    cache[cache_key] = data
    save_cache()
    return data


# ───────────── 카카오 ─────────────
KAKAO = "https://dapi.kakao.com/v2/local/search"
KH = {"Authorization": f"KakaoAK {KAKAO_KEY}"}


def geocode(address):
    """주소 → (경도 x, 위도 y, 카카오가 해석한 주소)"""
    d = get_json(f"addr|{address}", f"{KAKAO}/address.json", {"query": address}, KH)
    if not d["documents"]:
        # 주소로 안 잡히면 키워드 검색으로 한 번 더
        d = get_json(f"kw|{address}", f"{KAKAO}/keyword.json", {"query": address}, KH)
        if not d["documents"]:
            print(f"[주소 못 찾음] {address} → 주소를 다시 확인해 주세요")
            sys.exit(1)
    doc = d["documents"][0]
    name = doc.get("address_name") or doc.get("place_name")
    return float(doc["x"]), float(doc["y"]), name


def search_places(kind, x, y):
    """종류별로 가장 가까운 시설 1곳 + 반경 안 검색 결과 수"""
    spec = PLACE_TYPES[kind]
    base = {"x": x, "y": y, "radius": RADIUS_M, "sort": "distance", "size": 15}
    if "category" in spec:
        url, params = f"{KAKAO}/category.json", {**base, "category_group_code": spec["category"]}
    else:
        url, params = f"{KAKAO}/keyword.json", {**base, "query": spec["keyword"]}

    nearest, total = None, 0
    for page in (1, 2, 3):                       # 카카오는 최대 45건(15×3)
        d = get_json(f"place|{kind}|{x:.6f},{y:.6f}|{RADIUS_M}|{page}", url, {**params, "page": page}, KH)
        if page == 1:
            total = d["meta"]["total_count"]
        for doc in d["documents"]:
            cat = doc.get("category_name", "")
            if spec["must"] and not any(w in cat for w in spec["must"]):
                continue                          # 예: 슈퍼 검색에 섞인 술집 제외
            if any(w in doc["place_name"] or w in cat for w in spec.get("exclude", [])):
                continue                          # 예: '○○공원 음수대' 같은 공원 안 시설 제외
            nearest = doc
            break
        if nearest or d["meta"]["is_end"]:
            break
    return nearest, total


def walk_min(dist_m):
    """직선거리 → 도보 추정(분). 실제 길은 직선보다 약 1.3배, 걷는 속도 분당 67m"""
    return max(1, round(dist_m * 1.3 / 67))


def haversine(x1, y1, x2, y2):
    """두 좌표 사이 직선거리(m)"""
    from math import radians, sin, cos, asin, sqrt
    dlat, dlon = radians(y2 - y1), radians(x2 - x1)
    a = sin(dlat / 2) ** 2 + cos(radians(y1)) * cos(radians(y2)) * sin(dlon / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))


# ───────────── ODsay ─────────────
def transit(sx, sy, ex, ey):
    d = get_json(
        f"odsay|{sx:.6f},{sy:.6f}->{ex:.6f},{ey:.6f}",
        "https://api.odsay.com/v1/api/searchPubTransPathT",
        {"SX": sx, "SY": sy, "EX": ex, "EY": ey, "OPT": 0, "apiKey": ODSAY_KEY},
    )
    if "error" in d:
        # 집과 도착지가 너무 가까우면 ODsay는 경로 대신 오류를 준다 → 걸어서 가는 것으로 처리
        dist = haversine(sx, sy, ex, ey)
        if dist < 1500:
            return {"분": walk_min(dist), "요금": 0, "환승": 0, "경로": "도보"}
        print("[ODsay 오류]", d["error"])
        return None
    path = d["result"]["path"][0]
    info = path["info"]
    # 탄 노선 이름 (예: 2호선 → 버스 146)
    rides = []
    for sp in path["subPath"]:
        if sp["trafficType"] == 1:
            rides.append(sp["lane"][0].get("name", "지하철"))
        elif sp["trafficType"] == 2:
            rides.append("버스 " + str(sp["lane"][0].get("busNo", "")))
    return {
        "분": info["totalTime"],
        "요금": info["payment"],
        "환승": max(0, info["busTransitCount"] + info["subwayTransitCount"] - 1),
        "경로": " → ".join(rides) or "도보",
    }


# ───────────── 실행 ─────────────
if __name__ == "__main__":
    if not KAKAO_KEY or not ODSAY_KEY:
        if not cache:
            print("firsthome_data/.env 에 KAKAO_REST_API_KEY, ODSAY_API_KEY 를 넣어 주세요.")
            sys.exit(1)

    dx, dy, dname = geocode(DESTINATION["주소"])
    print(f"도착지: {DESTINATION['이름']} ({dname})\n")

    summary_rows, nearest_rows = [], []
    for h in HOMES:
        x, y, resolved = geocode(h["주소"])
        row = {"이름": h["이름"], "입력주소": h["주소"], "카카오주소": resolved,
               "경도": x, "위도": y, "보증금(만원)": h["보증금"], "월세(만원)": h["월세"],
               "관리비(만원)": h["관리비"]}

        # 생활시설
        for kind in PLACE_TYPES:
            doc, total = search_places(kind, x, y)
            if doc:
                dist = int(doc["distance"])
                name = doc["place_name"]
                if kind == "지하철역":
                    name = name.split(" ")[0]     # '성수역 2호선' → '성수역'
                row[f"{kind}"] = f"{name} 도보 약 {walk_min(dist)}분"
                row[f"{kind}_m"] = dist
                nearest_rows.append({"집": h["이름"], "종류": kind, "장소명": doc["place_name"],
                                     "상세분류": doc.get("category_name", ""), "직선거리_m": dist,
                                     "도보추정_분": walk_min(dist), "반경내_검색수": total,
                                     "카카오맵": doc.get("place_url", "")})
            else:
                row[f"{kind}"] = f"반경 {RADIUS_M}m 안에 없음"
                row[f"{kind}_m"] = ""
            row[f"{kind}_반경내수"] = total

        # 대중교통
        t = transit(x, y, dx, dy)
        if t:
            month_fare = t["요금"] * 2 * COMMUTE_DAYS
            row.update({"통근_분": t["분"], "통근_경로": t["경로"], "환승": t["환승"],
                        "편도요금(원)": t["요금"], "월교통비(원)": month_fare})
            row["월실부담(만원)"] = round(h["월세"] + h["관리비"] + month_fare / 10000, 1)
        summary_rows.append(row)

        print(f"■ {h['이름']}  ({resolved})")
        print(f"  {h['보증금']}/{h['월세']}  →  한 달 실부담 약 {row.get('월실부담(만원)', '?')}만원")
        if t:
            print(f"  {DESTINATION['이름']}까지 {t['분']}분 ({t['경로']}, 환승 {t['환승']}번)")
        for kind in PLACE_TYPES:
            print(f"  - {kind}: {row[kind]}  (반경 1km 검색 {row[kind + '_반경내수']}건)")
        print()

    def write_csv(path, rows):
        keys = list(dict.fromkeys(k for r in rows for k in r))
        with open(path, "w", newline="", encoding="utf-8-sig") as f:   # 엑셀에서 한글 안 깨지게
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            w.writerows(rows)

    write_csv(os.path.join(OUT_DIR, "homes_summary.csv"), summary_rows)
    write_csv(os.path.join(OUT_DIR, "nearest_places.csv"), nearest_rows)
    print(f"저장 완료 → {OUT_DIR}")
