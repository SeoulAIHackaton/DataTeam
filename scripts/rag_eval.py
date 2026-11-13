"""
RAG 테스트 (심사용 "AI 답이 맞는지 어떻게 확인했나요?")
  processed/rag/eval_questions.csv 의 질문을 하나씩 rag.py 에 물어보고 채점해요.
  - 검색: 찾은 정책 4개 안에 '기대_정책'(| 로 여러 개)이 하나라도 있으면 O
  - 근거: AI에게 넘기는 공고문 조각 안에 '꼭_들어갈_말'이 있으면 O (AI가 정답을 쓸 재료가 있는지)
  - 답:   실제 답 문장에 '꼭_들어갈_말'(| 로 여러 개 중 하나)이 있으면 O
  - 안전·지역: 찾은 정책에 '부산'이 없으면 O
  - 안전·범위 밖: "찾지 못했어요"로 답하면 O (found=False 또는 '꼭_들어갈_말' 문구)

실행: python scripts/rag_eval.py
결과: processed/rag/eval_result.csv  (질문별 O/X + 실제 답)
"""
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rag import Rag  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QF = os.path.join(BASE, "processed", "rag", "eval_questions.csv")
OUT = os.path.join(BASE, "processed", "rag", "eval_result.csv")
PROFILE = {"age": 27, "area": {"gu": "관악구"}}


def norm(t):
    return re.sub(r"[\s,·]", "", t or "")


def main():
    rag = Rag()
    with open(QF, encoding="utf-8-sig") as f:
        qs = list(csv.DictReader(f))
    rows, ok_s, ok_a, ok_c, n_s, n_a, n_c = [], 0, 0, 0, 0, 0, 0
    for q in qs:
        r = rag.answer(q["질문"], PROFILE)
        ctx = " ".join(c["text"] for h in rag.search(q["질문"], PROFILE, k=4, per_policy=4) for c in h["chunks"])
        ctx += " " + " ".join(s["text"] for s in r.get("sources", []))
        names = " / ".join(p["name"] + " " + p["org"] for p in r["policies"])
        ans = r["answer"]
        c_ok = None
        if q["종류"] == "안전·지역":
            s_ok = a_ok = "부산" not in names
        elif q["종류"] == "안전·범위 밖":                      # found=False 이거나 '찾지 못했' 문구가 있으면 통과
            s_ok = a_ok = (not r.get("found", True)) or any(norm(k) in norm(ans) for k in q["꼭_들어갈_말"].split("|") if k)
        else:
            s_ok = any(k in names for k in q["기대_정책"].split("|"))
            a_ok = any(norm(k) in norm(ans) for k in q["꼭_들어갈_말"].split("|"))
            c_ok = any(norm(k) in norm(ctx) for k in q["꼭_들어갈_말"].split("|"))
            n_c += 1; ok_c += c_ok
        n_s += 1; n_a += 1; ok_s += s_ok; ok_a += a_ok
        rows.append({**q, "검색": "O" if s_ok else "X", "근거": "-" if c_ok is None else ("O" if c_ok else "X"), "답": "O" if a_ok else "X", "모드": r["mode"],
                     "실제_답": ans.replace("\n", " "), "찾은_정책": names, "메모": r.get("memo", "")})
        print(f"{q['id']} 검색 {'O' if s_ok else 'X'} 근거 {rows[-1]['근거']} 답 {'O' if a_ok else 'X'}  {q['질문']}")
        if not a_ok:
            print(f"      → 실제 답: {ans.replace(chr(10), ' ')[:160]}" + (f"\n      → 메모: {r['memo']}" if r.get("memo") else ""))
    print(f"\n■ 검색 {ok_s}/{n_s}  ·  근거 {ok_c}/{n_c}  ·  답 {ok_a}/{n_a}  (모드: {rows[0]['모드'] if rows else '-'}, LLM 키가 없으면 '원문' = 공고문 문장 그대로)")
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(f"저장 → processed/rag/eval_result.csv")


if __name__ == "__main__":
    main()
