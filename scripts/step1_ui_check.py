"""1단계 한 화면 선택형 입력 확인 시나리오 15개를 실제 화면(web/index.html)에서 돌려요.

    python scripts/server.py              # 다른 터미널에서 서버를 켜 둔 채로
    python scripts/step1_ui_check.py      # [--shots 폴더]  빈 상태 · 다 채운 상태 · 생일 질문 상태 스크린샷 저장

확인용 도구라 Playwright가 필요해요 (pip install playwright, 설치된 Chrome 사용). 서비스 코드는 표준 라이브러리만 써요.
"""
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
URL = "http://127.0.0.1:5500/web/index.html"
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
W = 120  # ms
DEFAULT = dict(year=1999, bd=None, job="직장인", place=("역삼", "멀티캠퍼스 역삼"), cash=2000, inc=(230, "월급"),
               time="45분", when="다음 달", own="없어요", sep="네, 같아요")


def wait(pg, ms=W):
    pg.wait_for_timeout(ms)


def chip(pg, k, label):
    pg.locator(f"#f1-{k} [role=radio]", has_text=label).first.click(); wait(pg)


def year(pg, y, bd=None):
    pg.select_option("#f1-year", str(y)); wait(pg)
    if bd:
        pg.click(f"#f1-bd-{bd}"); wait(pg)


def place(pg, q, name):
    pg.fill("#f1-pin", q); wait(pg)
    pg.locator("#f1-plist [role=radio]", has_text=name).first.click(); wait(pg)


def number(pg, k, v, mode=None):
    if mode:
        chip(pg, "income", mode)
    pg.fill(f"#f1-{k}-n", str(v)); wait(pg)


def fill(pg, skip=(), **kw):
    a = {**DEFAULT, **kw}
    steps = {"age": lambda: year(pg, a["year"], a["bd"]), "job": lambda: chip(pg, "job", a["job"]),
             "place": lambda: place(pg, *a["place"]), "cash": lambda: number(pg, "cash", a["cash"]),
             "income": lambda: number(pg, "income", a["inc"][0], a["inc"][1]), "time": lambda: chip(pg, "time", a["time"]),
             "when": lambda: chip(pg, "when", a["when"]), "own": lambda: chip(pg, "own", a["own"]), "sep": lambda: chip(pg, "sep", a["sep"])}
    for k, f in steps.items():
        if k not in skip:
            f()


def state(pg):
    return pg.evaluate("""() => { const J = judge(); return {prof: S.prof, own: S.own, sep: S.sep, all: all1(), total: J.total,
        n: W1.filter(f => done1(f.k)).length, st: Object.fromEntries(J.list.map(p => [p.id, p.st])),
        molitSep: J.list.find(p => p.id==='molit').ev[2][2], why: J.list.map(p => p.why).flat()}; }""")


def go2(pg):
    pg.click("#f1go"); wait(pg)
    return pg.inner_text("#root")


def step3(pg):
    pg.evaluate("() => { set({homes:[0,1,2], homesDone:true}); go(3); }"); wait(pg, 200)
    top = pg.evaluate("() => { const t = scores()[0]; return {label: t.h.label, total: t.total}; }")
    return top, pg.inner_text("#root")


errors, results = [], []


def report(name, ok, info=""):
    results.append(ok)
    print(f"{'O' if ok else 'X'} {name}  {info}")


with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome", headless=True)

    def new():
        pg = br.new_page(viewport={"width": 1440, "height": 1000})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append("console " + m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
        pg.goto(URL); wait(pg, 250)
        return pg

    def demo_ok(pg):
        s = state(pg); go2(pg); s2 = state(pg); top, _ = step3(pg)
        return s, top, s["n"] == 9 and s2["total"] == 520 and "신림" in top["label"] and top["total"] == 86.4

    # 1) [예시로 채우기]
    pg = new()
    if SHOTS: pg.evaluate("window.scrollTo(0,0)"); wait(pg); pg.screenshot(path=f"{SHOTS}/1_empty.png", full_page=True)
    pg.click("button.f1ex"); wait(pg)
    s, top, ok = demo_ok(pg)
    report("[예시로 채우기]", ok, f"· {s['n']}/9 · {s['total']}만 원 · 3단계 1위 {top['label']} {top['total']}점"); pg.close()

    # 2) 9개 직접 고르기
    pg = new(); fill(pg)
    if SHOTS: pg.evaluate("window.scrollTo(0,0)"); wait(pg); pg.screenshot(path=f"{SHOTS}/2_filled.png", full_page=True)
    s, top, ok = demo_ok(pg)
    report("9개를 직접 고르기", ok and s["prof"]["age"] == 27 and s["prof"]["time"] == 45 and s["sep"] == "네",
           f"· 만 {s['prof']['age']}세 · {s['n']}/9 · {s['total']}만 원 · {top['label']} {top['total']}점"); pg.close()

    # 3) 1991 → 생일 질문 (지났어요 35세 280 / 아직이에요 34세 520)
    for bd, age, tot in (("after", 35, 280), ("before", 34, 520)):
        pg = new(); fill(pg, skip=("age",)); year(pg, 1991)
        asked = pg.locator("#f1-bd-after").count() == 1 and not pg.evaluate("done1('age')") and pg.get_attribute("#f1go", "aria-disabled") == "true"
        if SHOTS and bd == "after": pg.evaluate("window.scrollTo(0,0)"); wait(pg); pg.screenshot(path=f"{SHOTS}/3_birthday.png", full_page=True)
        pg.click(f"#f1-bd-{bd}"); wait(pg); s = state(pg)
        report(f"출생연도 1991 → {'지났어요' if bd == 'after' else '아직이에요'}", asked and s["prof"]["age"] == age and s["total"] == tot and s["all"],
               f"· 생일 질문 {'뜸 (고르기 전엔 빈 항목)' if asked else '안 뜸'} · 만 {s['prof']['age']}세 · {s['total']}만 원"); pg.close()

    # 4) 1990 → 생일 질문 없음 · 36세 · 280
    pg = new(); fill(pg, year=1990); s = state(pg)
    report("출생연도 1990", pg.locator("#f1-bd-after").count() == 0 and s["prof"]["age"] == 36 and s["total"] == 280, f"· {pg.inner_text('.f1age')} · {s['total']}만 원"); pg.close()

    # 5) 수입 [연봉] 3,600
    pg = new(); fill(pg, inc=(3600, "연봉")); conv = pg.inner_text("#f1-inc-v"); s = state(pg)
    report("수입 [연봉] 3,600", conv == "= 월 300만 원" and s["prof"]["income"] == 300 and s["prof"]["incomeInput"] == {"mode": "연", "amount": 3600} and s["total"] == 520,
           f"· '{conv}' · 저장 {s['prof']['income']} · {s['total']}만 원"); pg.close()

    # 6) 수입 [월급] 400
    pg = new(); fill(pg, inc=(400, "월급")); x = pg.inner_text("#f1-income-x"); over = pg.locator('[data-inc="over"]').count(); s = state(pg)
    report("수입 [월급] 400", over == 1 and s["st"]["seoul"] == "no" and any("150%를 넘어요" in w for w in s["why"]),
           f"· '{x}' · 서울시 청년월세 {s['st']['seoul']} · 이사비 {s['st']['move']}"); pg.close()

    # 7) 보증금 500 → 3단계 성수·역삼 500만 원 부족
    pg = new(); fill(pg, cash=500); go2(pg); _, t3 = step3(pg)
    report("보증금 500", t3.count("500만 원 부족") == 2, f"· '500만 원 부족' {t3.count('500만 원 부족')}곳"); pg.close()

    # 8) 출퇴근 30분 → 넘음 없음
    pg = new(); fill(pg, time="30분"); s = state(pg); go2(pg); _, t3 = step3(pg)
    report("출퇴근 30분", s["prof"]["time"] == 30 and "분 넘음" not in t3, f"· 저장 {s['prof']['time']} · '넘음' {t3.count('분 넘음')}개"); pg.close()

    # 9) 본인 명의 집 있어요 → 0원과 이유
    pg = new(); fill(pg, own="있어요"); s = state(pg)
    report("본인 명의 집 '있어요'", s["own"] == "있어요" and s["total"] == 0 and any("무주택" in w for w in s["why"]), f"· {s['total']}만 원 · '{s['why'][0]}'"); pg.close()

    # 10) 세대 잘 모르겠어요 → 모름 · 확인 필요
    pg = new(); fill(pg, sep="잘 모르겠어요"); s = state(pg); panel = pg.inner_text(".f1panel"); t2 = go2(pg)
    report("세대 '잘 모르겠어요'", s["sep"] == "모름" and s["molitSep"] == "q" and "모름" in panel and "확인 필요" in t2,
           f"· S.sep {s['sep']} · 국토부 독립거주 {s['molitSep']}"); pg.close()

    # 11) 5개만 채우고 [받을 수 있는 지원 보기] → 비활성 · 첫 빈 항목으로 스크롤 · 강조
    pg = new(); fill(pg, skip=("income", "time", "when", "own", "sep")); dis = pg.get_attribute("#f1go", "aria-disabled")
    pg.evaluate("window.scrollTo(0,0)"); pg.click("#f1go", force=True); wait(pg, 700)   # aria-disabled 라 Playwright는 막지만 사람은 누를 수 있어요
    st = pg.evaluate("[S.step, document.getElementById('f1-income').classList.contains('hl'), document.activeElement.closest('.f1') && document.activeElement.closest('.f1').id]")
    inview = pg.evaluate("(() => { const r = document.getElementById('f1-income').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()")
    report("5개만 채우고 [받을 수 있는 지원 보기]", dis == "true" and st[0] == 1 and st[1] and st[2] == "f1-income" and inview,
           f"· 비활성 {dis} · 단계 {st[0]} · 강조 {st[1]} · 포커스 {st[2]} · 화면 안 {inview}"); pg.close()

    # 12) 5개만 채우고 위쪽 2단계 버튼 → 배너
    pg = new(); fill(pg, skip=("income", "time", "when", "own", "sep")); pg.click('button[data-act="단계 2 이동"]'); wait(pg)
    b = pg.locator('[data-banner="step1"]')
    report("5개만 채우고 위쪽 2단계 버튼", b.count() == 1 and "예시 값" in b.inner_text(), f"· {' '.join(b.inner_text().split()) if b.count() else '배너 없음'}"); pg.close()

    # 13) 패널 항목 누르기 → 그 항목으로 스크롤
    pg = new(); pg.click("button.f1ex"); wait(pg); pg.evaluate("window.scrollTo(0,0)")
    pg.locator("button.f1kv", has_text="부모님과 같은 주소").click(); wait(pg, 700)
    r = pg.evaluate("(() => { const r = document.getElementById('f1-sep').getBoundingClientRect(); return [Math.round(r.top), r.top >= 0 && r.bottom <= innerHeight, scrollY > 0, document.activeElement.id]; })()")
    report("패널 항목 누르기", r[1] and r[2] and r[3].startswith("f1-sep"), f"· 스크롤 {r[2]} · 화면 안 {r[1]} · 포커스 {r[3]}"); pg.close()

    # 14) 키보드만으로 9개 (Tab은 그룹 단위 · 그룹 안은 화살표 · Enter · 글자)
    pg = new(); kb = pg.keyboard
    pg.focus("#f1-year")
    kb.press("Home")
    for _ in range(2010 - 1991 + 1): kb.press("ArrowDown")   # '선택' → 2010 … 1991
    wait(pg); kb.press("Tab"); kb.press("Enter"); wait(pg)    # 생일: 지났어요
    kb.press("ArrowRight"); kb.press("Enter"); wait(pg)       # 아직이에요 → 만 34세
    kb.press("Tab"); kb.press("Enter"); wait(pg)              # 지금 상황: 직장인
    kb.press("Tab"); kb.type("역삼"); wait(pg); kb.press("Enter"); wait(pg)   # 장소: 첫 후보
    kb.press("Tab"); kb.type("2000"); wait(pg)                # 보증금
    kb.press("Tab"); kb.press("Tab")                           # 빠른 선택 그룹 지나 수입 [월급]
    kb.press("Tab"); kb.type("230"); wait(pg)                 # 수입 숫자칸
    kb.press("Tab"); kb.press("Tab")                           # 빠른 선택 그룹 지나 출퇴근 (30분)
    kb.press("ArrowRight"); kb.press("Enter"); wait(pg)       # 45분
    kb.press("Tab"); kb.press("ArrowRight"); kb.press("Enter"); wait(pg)   # 입주 시기: 다음 달
    kb.press("Tab"); kb.press("Enter"); wait(pg)              # 본인 명의 집: 없어요
    kb.press("Tab"); kb.press("Enter"); wait(pg)              # 부모님과 같은 주소: 네, 같아요
    s = state(pg)
    report("키보드만으로 9개", s["all"] and s["prof"]["age"] == 34 and s["prof"]["cash"] == 2000 and s["prof"]["income"] == 230 and s["prof"]["time"] == 45 and s["prof"]["when"] == "다음 달" and s["own"] == "없어요" and s["sep"] == "네",
           f"· {s['n']}/9 · 만 {s['prof'].get('age')}세 · {s['prof'].get('job')} · {s['prof'].get('place')} · {s['prof'].get('cash')} · {s['prof'].get('income')} · {s['prof'].get('time')}분 · {s['prof'].get('when')} · {s['own']} · {s['sep']}")
    pg.close()

    # 15) 카카오 키 없이 자주 가는 곳
    pg = new(); pg.fill("#f1-pin", "판교"); wait(pg)
    cands = pg.locator("#f1-plist [role=radio]").all_inner_texts()
    pg.locator("#f1-plist [role=radio]", has_text="판교역").click(); wait(pg)
    dest = pg.evaluate("[S.prof.place, S.prof.placeOk, DEST.name, DEST.addr]"); shown = pg.inner_text(".f1pick")
    report("카카오 키 없이 자주 가는 곳", pg.evaluate("kakaoOn()") is False and "판교역" in cands and dest == ["판교역", True, "판교역", "판교역 신분당선"] and "바꾸기" in shown,
           f"· '판교' 후보 {cands} · 저장 {dest} · 표시 '{' '.join(shown.split())}'"); pg.close()

    br.close()

print(f"\n→ 확인 시나리오 {sum(results)}/{len(results)} · 페이지 오류 {len(errors)}개")
for e in errors:
    print("   ", e)
