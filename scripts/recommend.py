"""
첫집 내비 - 종합 추천 점수
  collect_homes.py 가 만든 processed/step3_homes/homes_summary.csv 를 읽어서
  비용 · 통근 · 생활 편의 점수 → 사용자 우선순위로 가중합 → 추천 + 근거 문장

실행: VS Code에서 ▶ (API 호출 없음, 키 필요 없음)
결과: processed/step3_homes/recommend_result.json  (프론트 화면 / AI 설명 프롬프트에 그대로 넣는 용도)

원칙: 점수와 근거 숫자는 코드가 계산하고, AI는 이 결과를 쉬운 말로 풀어 설명만 한다.
"""
import csv
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "processed", "step3_homes")

# ───────────── 1. 우선순위 → 가중치 ─────────────
# STEP 1 대화에서 사용자가 고른 우선순위에 따라 가중치를 바꾼다 (합 = 1)
PRESETS = {
    "균형":     {"비용": 0.40, "통근": 0.35, "생활": 0.25},
    "돈이 먼저": {"비용": 0.60, "통근": 0.25, "생활": 0.15},
    "시간이 먼저": {"비용": 0.20, "통근": 0.60, "생활": 0.20},
    "동네 생활":  {"비용": 0.30, "통근": 0.20, "생활": 0.50},
}

# ───────────── 2. 항목별 점수 규칙 (0~100) ─────────────
# 숫자로 설명 가능한 규칙만 쓴다. 발표 때 "왜 이 점수?"에 바로 답할 수 있게.
COST_PER_10K = 1.5      # 가장 싼 집보다 월 1만원 비쌀 때마다 -1.5점 (10만원 = -15점)
COMMUTE_FREE = 15       # 15분 이하는 만점
COMMUTE_PER_MIN = 2     # 그 뒤로 1분마다 -2점 (45분이면 40점)
WALK_FULL, WALK_ZERO = 5, 20   # 생활시설: 도보 5분 이하 만점, 20분 이상 0점

LIFE_TYPES = ["지하철역", "대형마트", "동네슈퍼", "편의점", "약국", "병원", "헬스장", "공원"]


def walk_min(dist_m):
    return max(1, round(dist_m * 1.3 / 67))


def clamp(v):
    return max(0.0, min(100.0, v))


def cost_score(cost, min_cost):
    return clamp(100 - (cost - min_cost) * COST_PER_10K)


def commute_score(minutes):
    return clamp(100 - max(0, minutes - COMMUTE_FREE) * COMMUTE_PER_MIN)


def walk_score(minutes):
    if minutes is None:
        return 0.0
    return clamp(100 * (WALK_ZERO - minutes) / (WALK_ZERO - WALK_FULL))


def load_homes():
    with open(os.path.join(DATA_DIR, "homes_summary.csv"), encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    homes = []
    for r in rows:
        life = {}
        for t in LIFE_TYPES:
            m = r.get(f"{t}_m", "")
            life[t] = {"이름": r.get(t, ""), "도보_분": walk_min(int(float(m))) if m else None}
        homes.append({
            "이름": r["이름"],
            "보증금": int(float(r["보증금(만원)"])),
            "월세": int(float(r["월세(만원)"])),
            "월실부담": float(r["월실부담(만원)"]),
            "통근_분": int(float(r["통근_분"])),
            "통근_경로": r["통근_경로"],
            "생활": life,
        })
    return homes


def score_all(homes, weights):
    min_cost = min(h["월실부담"] for h in homes)
    for h in homes:
        life_scores = {t: walk_score(v["도보_분"]) for t, v in h["생활"].items()}
        h["점수"] = {
            "비용": round(cost_score(h["월실부담"], min_cost), 1),
            "통근": round(commute_score(h["통근_분"]), 1),
            "생활": round(sum(life_scores.values()) / len(life_scores), 1),
        }
        h["생활_세부점수"] = {t: round(s) for t, s in life_scores.items()}
        h["종합"] = round(sum(h["점수"][k] * w for k, w in weights.items()), 1)
    return sorted(homes, key=lambda h: h["종합"], reverse=True)


def eun(word):
    """받침에 맞춰 은/는 붙이기 (성수는, 역삼은)"""
    c = word[-1]
    if "가" <= c <= "힣":
        return word + ("은" if (ord(c) - 0xAC00) % 28 else "는")
    return word + "은(는)"


def reasons(ranked):
    """AI에게 넘길 '사실' 문장. 숫자는 전부 코드가 만든다."""
    facts = []
    best = ranked[0]
    cheapest = min(ranked, key=lambda h: h["월실부담"])
    fastest = min(ranked, key=lambda h: h["통근_분"])

    facts.append(f"한 달 실부담이 가장 적은 집은 {cheapest['이름']}({cheapest['월실부담']}만원)이에요.")
    facts.append(f"통근이 가장 짧은 집은 {fastest['이름']}({fastest['통근_분']}분, {fastest['통근_경로']})이에요.")

    # 다른 집보다 비싸면서 통근도 짧지 않은 집 = '이 값을 하는지' 따져봐야 하는 집
    for a in ranked:
        for b in ranked:
            if a is b:
                continue
            if a["월실부담"] > b["월실부담"] and a["통근_분"] >= b["통근_분"]:
                diff = round(a["월실부담"] - b["월실부담"], 1)
                facts.append(
                    f"{eun(a['이름'])} {b['이름']}보다 한 달 {diff}만원 더 들지만 통근은 "
                    f"{'같아요' if a['통근_분'] == b['통근_분'] else '더 길어요'}"
                    f"({a['통근_분']}분 vs {b['통근_분']}분). 생활 편의 점수는 {a['점수']['생활']} vs {b['점수']['생활']}이에요."
                )

    # 통근 시간을 돈으로 환산 (한 달 20일, 왕복)
    if fastest is not cheapest:
        saved_hours = round((cheapest["통근_분"] - fastest["통근_분"]) * 2 * 20 / 60, 1)
        extra = round(fastest["월실부담"] - cheapest["월실부담"], 1)
        if saved_hours > 0:
            facts.append(
                f"{eun(fastest['이름'])} {cheapest['이름']}보다 한 달 {extra}만원 더 내고, "
                f"출퇴근 시간을 한 달 약 {saved_hours}시간 아껴요."
            )

    # 생활시설 중 눈에 띄게 먼 것
    for h in ranked:
        for t, v in h["생활"].items():
            if v["도보_분"] is not None and v["도보_분"] >= 15:
                facts.append(f"{eun(h['이름'])} {t}까지 걸어서 약 {v['도보_분']}분으로 먼 편이에요.")

    # 보증금 차이
    deps = {h["보증금"] for h in ranked}
    if len(deps) > 1:
        low = min(ranked, key=lambda h: h["보증금"])
        facts.append(f"{eun(low['이름'])} 보증금이 {low['보증금']}만원으로 처음에 드는 목돈이 가장 적어요.")

    facts.insert(0, f"지금 우선순위로는 {best['이름']} 집이 종합 {best['종합']}점으로 가장 잘 맞아요.")
    return facts


def run(preset):
    homes = load_homes()
    ranked = score_all(homes, PRESETS[preset])
    return {
        "우선순위": preset,
        "가중치": PRESETS[preset],
        "추천": ranked[0]["이름"],
        "순위": [{"이름": h["이름"], "종합": h["종합"], "점수": h["점수"],
                 "월실부담": h["월실부담"], "통근_분": h["통근_분"],
                 "생활_세부점수": h["생활_세부점수"]} for h in ranked],
        "근거": reasons(ranked),
    }


if __name__ == "__main__":
    results = {}
    for preset in PRESETS:
        res = run(preset)
        results[preset] = res
        print(f"■ 우선순위: {preset}  {res['가중치']}")
        for i, h in enumerate(res["순위"], 1):
            s = h["점수"]
            print(f"  {i}위 {h['이름']}  종합 {h['종합']}  (비용 {s['비용']} / 통근 {s['통근']} / 생활 {s['생활']})")
        print()

    print("■ 근거 문장 (균형 기준) — AI는 이 문장들만 바탕으로 설명한다")
    for f in results["균형"]["근거"]:
        print("  -", f)

    out = os.path.join(DATA_DIR, "recommend_result.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n저장 완료 → {out}")
