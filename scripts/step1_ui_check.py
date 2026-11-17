"""
1단계 연결 시나리오 13개를 실제 화면(web/index.html)에서 확인해요 (확인용 도구라 Playwright가 필요해요. 서비스 코드는 표준 라이브러리만 써요).
  준비: pip install playwright  (설치된 Chrome을 써요. Chrome이 없으면 python -m playwright install chromium 후 channel 줄을 지우세요)
  실행: python scripts/server.py  를 켜 둔 채로  python scripts/step1_ui_check.py
  기본 답 "27 / 회사 다녀요 / 멀티캠퍼스 역삼 / 2천 / 230 / 40분 / 다음 달 / 없어요 / 네"에서 한 항목씩 바꿔 넣고,
  confirm이 나오면 첫 번째 옵션을 골라요. 2단계 총액·3단계 1위·배너·페이지 오류를 확인해요.
"""
import json
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
URL = "http://127.0.0.1:5500/web/index.html"
BASE = ["27", "회사 다녀요", "멀티캠퍼스 역삼", "2천", "230", "40분", "다음 달", "없어요", "네"]
IDX = {k: i for i, k in enumerate(["age", "job", "place", "cash", "income", "time", "when", "own", "sep"])}


def answer(page, text):
    page.fill("#msgin", text)
    page.press("#msgin", "Enter")
    page.wait_for_timeout(150)
    chips = page.locator('button[onclick^="pick1("]')          # confirm → 첫 번째 옵션
    if chips.count():
        chips.first.click(); page.wait_for_timeout(150)


def run_step1(page, answers):
    for a in answers:
        if a.startswith("BTN:"):
            page.locator("button.chip", has_text=a[4:]).first.click(); page.wait_for_timeout(150)
        else:
            answer(page, a)


def state(page):
    return page.evaluate("""() => { const J = judge(); return {prof: S.prof, own: S.own, sep: S.sep, qi: S.qi, total: J.total,
        molitSep: J.list.find(p => p.id==='molit').ev[2], fail: J.fail.map(p => p.why), chosen: J.chosen.map(p => p.name)}; }""")


def step3(page):
    page.evaluate("() => { set({homes:[0,1,2], homesDone:true}); go(3); }")
    page.wait_for_timeout(150)
    top = page.evaluate("() => { const t = scores()[0]; return {label: t.h.label, total: t.total}; }")
    return top, page.inner_text("#root")


SC = [
    ("(기본)", {}, [], lambda s, t3: s["total"] == 520 and "신림" in t3[0]["label"] and t3[0]["total"] == 86.4),
    ('나이 "35살"', {"age": "35살"}, [], lambda s, _: s["prof"]["age"] == 35 and s["total"] == 280),
    ('나이 "1990년생" → 생일 지났어요', {"age": "1990년생"}, [], lambda s, _: s["prof"]["age"] == 36 and s["total"] == 280),
    ('소득 "연봉 3600" → 맞아요', {"income": "연봉 3600"}, [], lambda s, _: s["prof"]["income"] == 300 and s["total"] == 520),
    ('소득 "2300000" → 맞아요', {"income": "2300000"}, [], lambda s, _: s["prof"]["income"] == 230 and s["total"] == 520),
    ('집 "부모님 집은 있어요"', {"own": "부모님 집은 있어요"}, [], lambda s, _: s["own"] == "없어요" and s["total"] == 520),
    ('세대 "아니 같아요"', {"sep": "아니 같아요"}, [], lambda s, _: s["sep"] == "네" and s["_step1"].count("세대 분리 후 전입신고") == 1),
    ('세대 "잘 모르겠어요" 버튼', {"sep": "BTN:잘 모르겠어요"}, [], lambda s, _: s["sep"] == "모름" and s["molitSep"][2] == "q" and "확인 필요" in s["_step2"]),
    ('출퇴근 "1시간 30분"', {"time": "1시간 30분"}, [], lambda s, t3: s["prof"]["time"] == 90 and "분 넘음" not in t3[1]),
    ('보증금 "3천5백"', {"cash": "3천5백"}, [], lambda s, t3: s["prof"]["cash"] == 3500 and "부족" not in t3[1]),
    ('끝난 뒤 "집을 샀어요"', {}, ["집을 샀어요"], lambda s, _: s["own"] == "있어요" and s["total"] == 0 and any("무주택" in w for ws in s["fail"] for w in ws)),
    ('끝난 뒤 "35살인데 받을 수 있어요?"', {}, ["35살인데 받을 수 있어요?"], lambda s, _: s["prof"]["age"] == 27 and "바꿨어요" not in s["_extra"] and len(s["_extra"]) > 20),
]

errors, results = [], []
with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome", headless=True)
    for name, change, updates, check in SC:
        page = br.new_page()
        page.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))
        page.on("console", lambda m, n=name: errors.append(f"{n}: console {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.on("response", lambda r, n=name: errors.append(f"{n}: {r.status} {r.url}") if r.status >= 400 and not r.url.endswith("/favicon.ico") else None)   # 파비콘은 원래 없음
        page.goto(URL); page.wait_for_timeout(200)
        ans = list(BASE)
        for k, v in change.items():
            ans[IDX[k]] = v
        run_step1(page, ans)
        for u in updates:
            page.fill("#msgin", u); page.press("#msgin", "Enter"); page.wait_for_timeout(1500)
        s = state(page)
        s["_step1"] = page.inner_text("#root")
        s["_extra"] = page.evaluate("() => (S.extra||[]).map(e => e.a).join(' / ')")
        page.evaluate("() => go(2)"); page.wait_for_timeout(100)
        s["_step2"] = page.inner_text("#root")
        banner2 = page.locator('[data-banner="step1"]').count()
        t3 = step3(page)
        banner3 = page.locator('[data-banner="step1"]').count()
        ok = bool(check(s, t3)) and s["qi"] == 9 and banner2 == 0 and banner3 == 0
        results.append(ok)
        print(f"{'O' if ok else 'X'} {name}  · 총 {s['total']}만 원 · 나이 {s['prof'].get('age')} · 소득 {s['prof'].get('income')} · 보증금 {s['prof'].get('cash')} · "
              f"시간 {s['prof'].get('time')} · 집 {s['own']} · 주소 {s['sep']} · 3단계 1위 {t3[0]['label']} {t3[0]['total']}점 · 배너 {banner2}/{banner3}")
        if not ok:
            print("    extra:", s["_extra"][:200])
        page.close()
    # 13) 1단계 중간에 2단계 버튼 → 예시 값 배너
    page = br.new_page()
    page.on("pageerror", lambda e: errors.append(f"중간: {e}"))
    page.goto(URL); page.wait_for_timeout(200)
    run_step1(page, BASE[:3])
    page.click('button[data-act="단계 2 이동"]'); page.wait_for_timeout(150)
    b = page.locator('[data-banner="step1"]')
    ok = b.count() == 1 and "예시 값" in b.inner_text()
    print(f"{'O' if ok else 'X'} 1단계 중간에 2단계 버튼  · 배너: {b.inner_text()[:80] if b.count() else '없음'}")
    results.append(ok)
    br.close()

print(f"\n→ 연결 시나리오 {sum(results)}/{len(results)} · 페이지 오류 {len(errors)}개")
for e in errors:
    print("   ", e)
