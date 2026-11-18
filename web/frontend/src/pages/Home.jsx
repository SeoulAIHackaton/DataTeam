/* 처음 화면 · Toss·당근 서비스 소개 화면 방식
   큰 한 문장 + 버튼 → 떠 있는 결과 카드 → 스크롤하면 브라우저 창 속 웹 화면이 01~03으로 바뀌는 이야기 → 질문이 흐르는 줄 → 숫자 → 마지막 버튼
   숫자는 모두 앱 계산 그대로예요 (예시 인물: 만 27세 · 월 230만 원 · 무주택, 예시 집 3곳 · lpData) */
import { useEffect, useMemo, useRef, useState } from 'react';
import { S, set } from '../store.js';
import { lpData, LP_RM, QA, PCOL, DEST, monthly } from '../lib/core.js';
import { Tile, IcCk } from '../components/ui.jsx';
import { MiniMap } from '../components/Maps.jsx';
import { Footer } from '../components/Shell.jsx';

const f0 = v => Math.round(v).toLocaleString();
/* 숫자 올라가기 · 끝나면 멈추는 함수를 돌려줘요 */
function countTo(setV, from, to, d) {
  if (LP_RM() || !d) { setV(to); return () => {}; }
  let raf = 0; const t0 = performance.now();
  const f = t => { const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); setV(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}
/* 화면에 들어오면 0부터 올라가는 숫자 */
function Count({ to, dur = 1300 }) {
  const ref = useRef(null), [v, setV] = useState(to);
  useEffect(() => {
    let stop = () => {};
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.disconnect(); setV(0); stop = countTo(setV, 0, to, dur); }), { threshold: .15 });
    io.observe(ref.current);
    return () => { io.disconnect(); stop(); };
  }, [to, dur]);
  return <span ref={ref}>{f0(v)}</span>;
}

const STEPS = [
  ['01', <>고르기만 하면<br />끝나요</>, '나이, 소득, 모아둔 돈을 버튼으로 골라요. 금액은 +100만, +500만처럼 더해서 넣어요.'],
  ['02', <>받을 수 있는 돈,<br />근거까지 보여줘요</>, '공고문 조건과 내 조건을 한 줄씩 맞춰 봐요. 왜 받을 수 있는지 원문 문장도 같이 보여드려요.'],
  ['03', <>후보 집은<br />같은 기준으로</>, '한 달 비용, 출퇴근 시간, 동네 생활을 한 표에서 비교해요. 모르는 관리비는 0원으로 치지 않아요.'],
];
const CHS = ['내 조건', '받을 지원', '집 고르기'];

function startApp(easy) { set({ home: false, loading: false, step: 1, ...(easy ? { easy: true } : {}) }); window.scrollTo(0, 0); }

/* 브라우저 창 속 웹 화면 (왼쪽 목차 · 본문 · 오른쪽 패널) */
function WebShot({ scene, play, J, K, U, amt1, tap, amt2 }) {
  const rk = (r, i) => <li key={r.h.key}><span className="n">{i + 1}</span><Tile h={r.h} c="xs" /><b>{r.h.label.replace(' 원룸', '')}</b><span className="br"><i style={{ '--w': `${r.total}%`, background: r.h.color }} /></span><em>{r.total}점</em></li>;
  const uk = r => <li className="u" key={r.h.key}><span className="n">–</span><Tile h={r.h} c="xs" /><b>{r.h.label.replace(' 원룸', '')}</b><span className="uk">관리비 확인 필요</span></li>;
  const cls = n => `ps s${n} ${play === n ? 'play' : ''}`;
  return (
    <div className="bw" data-s={scene} aria-hidden="true">
      <div className="bw-bar">
        <span className="bw-dots"><i /><i /><i /></span>
        <span className="bw-url"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <b>내 첫 집 파일</b>/ 0{scene} {CHS[scene - 1]}</span>
        <span className="bw-sp" />
      </div>
      <div className="bw-body">
        <div className="bw-rail">
          <div className="bw-logo">첫집<b>내비</b></div>
          <ol>{CHS.map((t, i) => <li key={t} className={scene === i + 1 ? 'on' : scene > i + 1 ? 'dn' : ''}><i>{scene > i + 1 ? <IcCk /> : `0${i + 1}`}</i>{t}</li>)}</ol>
        </div>
        <div className="bw-main">
          <div className={cls(1)}>
            <div className="ps-m"><span className="pc">01 내 조건</span><div className="pt">내 상황을 알려 주세요</div>
              <div className="pf"><span className="pl">보증금</span><div><div className="pa"><b>{f0(amt1)}</b>만 원</div>
                <div className="padd"><span className={tap === 1 ? 'tap' : ''}>+100만</span><span className={tap === 2 ? 'tap' : ''}>+500만</span><span className={tap === 3 ? 'tap' : ''}>+1,000만</span></div></div></div>
              <div className="pf"><span className="pl">한 달 수입</span><div><b className="pv">월 230만 원</b><div className="pg"><i /><em /></div></div></div>
              <div className="pf"><span className="pl">출퇴근</span><div><b className="pv">편도 45분까지</b><div className="prng"><i /></div></div></div>
              <div className="pf"><span className="pl">입주 시기</span><div className="pmo"><span>11월</span><span className="on">12월</span><span>1월</span><span>2월</span></div></div>
            </div>
            <div className="ps-side"><div className="t">내 조건<span>7 / 9</span></div><div className="pp"><i /></div>
              <div className="kv">나이<b>만 27세</b></div><div className="kv">월 소득<b>230만 원</b></div><div className="kv">모아둔 돈<b>{f0(amt1)}만 원</b></div>
              <div className="pbtn">받을 수 있는<br />지원 보기</div></div>
          </div>
          <div className={cls(2)}>
            <div className="ps-m"><span className="pc">02 받을 지원</span><div className="pt">내년에 받을 수 있는 지원금</div><div className="pa">최대 <b>{f0(amt2)}</b>만 원</div>
              <div className="pbar">{J.chosen.map(p => <span key={p.id} style={{ flex: p.amtN, background: PCOL[p.id].fg }} />)}</div>
              {J.chosen.map((p, i) => <div className="prow" key={p.id} style={{ '--d': `${.25 + i * .2}s` }}><div><b>{p.name}</b><small>{p.how}</small></div><em style={{ color: PCOL[p.id].fg }}>{p.amtN}만</em></div>)}
            </div>
            <div className="ps-side"><div className="t">왜 받을 수 있나요?</div>
              <div className="pwhy"><span className="ok">만 19~34세 ✓</span><span className="ok">무주택 ✓</span><span className="ok">서울 입주 ✓</span><span className="q">소득 · 서류 확인</span></div>
              <div className="pbtn">후보 집 비교하기</div></div>
          </div>
          <div className={cls(3)}>
            <div className="ps-m"><span className="pc">03 집 고르기</span><div className="pt">먼저 볼 집</div>
              <ol className="frk">{K.map(rk)}{U.map(uk)}</ol>
              <div className="pcmp">{K.slice(0, 2).map(r => <div key={r.h.key}><span><Tile h={r.h} c="xs" />한 달</span><b>{monthly(r.h)}만 원</b><small>{DEST.name}까지 {r.h.commute}분</small></div>)}</div>
            </div>
            <div className="ps-side"><div className="t">위치</div>
              <MiniMap H={[...K, ...U].map(r => r.h)} />
              <ul className="plg">{[...K, ...U].map(r => <li key={r.h.key}><Tile h={r.h} c="xs" />{r.h.label.replace(' 원룸', '')}<b>{r.h.commute}분</b></li>)}</ul>
              <div className="pbtn">파일 전체<br />복사하기</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { J, R } = useMemo(lpData, []);
  const K = R.filter(r => !r.unk), U = R.filter(r => r.unk);
  const qs = Object.values(QA).map(x => x.q).filter(Boolean);
  const half = Math.ceil(qs.length / 2), rowA = qs.slice(0, half), rowB = qs.slice(half);
  const lp = useRef(null);
  const [scene, setScene] = useState(1), [play, setPlay] = useState(0), [sc, setSc] = useState(false);
  const [amt1, setAmt1] = useState(2000), [tap, setTap] = useState(0), [amt2, setAmt2] = useState(J.total);

  /* 나타나기(.rv → .in) · 스크롤 이야기(가운데 줄을 지나는 단계) · 위 막대 그림자 */
  useEffect(() => {
    const root = lp.current;
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target); }), { threshold: .15 });
    root.querySelectorAll('.rv').forEach(x => io.observe(x));
    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setScene(+e.target.dataset.s); }), { rootMargin: '-45% 0px -45% 0px' });
    root.querySelectorAll('.lp-step').forEach(x => so.observe(x));
    const onSc = () => setSc(window.scrollY > 8); onSc();
    window.addEventListener('scroll', onSc, { passive: true });
    return () => { io.disconnect(); so.disconnect(); window.removeEventListener('scroll', onSc); };
  }, []);

  /* 단계가 바뀌면 그 화면을 다시 재생 (01: 더하기 버튼 누르는 모습 · 02: 금액 올라가기) */
  useEffect(() => {
    setPlay(0);
    const T = []; let stop = () => {};
    const r = requestAnimationFrame(() => T.push(setTimeout(() => setPlay(scene), 30)));
    if (!LP_RM()) {
      if (scene === 1) {
        let v = 0; setAmt1(0);
        [[400, 2, 500], [1050, 3, 1000], [1700, 2, 500]].forEach(([ms, b, d]) => T.push(setTimeout(() => {
          setTap(b); T.push(setTimeout(() => setTap(0), 240)); const from = v; v += d; stop(); stop = countTo(setAmt1, from, v, 380);
        }, ms)));
      }
      if (scene === 2) { setAmt2(0); stop = countTo(setAmt2, 0, J.total, 1100); }
    } else { setAmt1(2000); setAmt2(J.total); }
    return () => { cancelAnimationFrame(r); T.forEach(clearTimeout); stop(); setTap(0); };
  }, [scene, J.total]);

  const mq = (L, cls) => <div className={`mq-row ${cls}`}>{[...L, ...L].map((q, i) => <span key={i} aria-hidden={i >= L.length ? true : undefined}>{q}</span>)}</div>;
  const rk = (r, i) => <li key={r.h.key}><span className="n">{i + 1}</span><Tile h={r.h} c="xs" /><b>{r.h.label.replace(' 원룸', '')}</b><span className="br"><i style={{ '--w': `${r.total}%`, background: r.h.color }} /></span><em>{r.total}점</em></li>;
  return (
    <div className="lp js" ref={lp}>
      <header className={`lp-top ${sc ? 'sc' : ''}`}><div className="lp-top-in"><span className="logo">첫집<b>내비</b></span>
        <button className="toggle" onClick={() => set({ easy: !S.easy })} aria-pressed={!!S.easy} data-act="쉬운 화면 켜기/끄기">쉬운 화면 <span className={`sw ${S.easy ? 'on' : ''}`} /></button>
        <button className="go" onClick={() => startApp()} data-act="시작하기 → 01">시작하기</button></div></header>

      <section className="lp-hero">
        <h1 className="rv">첫 독립,<br />받을 돈부터 챙겨요</h1>
        <p className="rv d1">서울 청년 지원금 계산부터 집 비교, 계약 전 확인까지.<br />질문 몇 개면 내 첫 집 파일이 만들어져요.</p>
        <div className="lp-cta rv d2"><button className="pillb" onClick={() => startApp()} data-act="시작하기 → 01">내 파일 만들기</button><button className="lp-easy" onClick={() => startApp(true)} data-act="쉬운 화면으로 시작">쉬운 화면으로 볼래요 ›</button></div>
        <p className="lp-note rv d2">로그인 없이 바로 써요 · 5분쯤 걸려요</p>
        <div className="lp-float" aria-label="결과 예시">
          <div className="fc a rv d3"><div className="fk">내년에 받을 수 있는 지원금</div><div className="fv">최대 <b id="fc-amt"><Count to={J.total} dur={1500} /></b>만 원</div>
            <div className="fbar">{J.chosen.map(p => <span key={p.id} style={{ flex: p.amtN, background: PCOL[p.id].fg }} />)}</div>
            <ul className="fl">{J.chosen.map(p => <li key={p.id}><i style={{ background: PCOL[p.id].fg }} />{p.name}<b>{p.amtN}만</b></li>)}</ul></div>
          <div className="fc b rv d4"><div className="fk">먼저 볼 집 <span className="ex">예시</span></div><ol className="frk">{K.map(rk)}{U.map(r => <li className="u" key={r.h.key}><span className="n">–</span><Tile h={r.h} c="xs" /><b>{r.h.label.replace(' 원룸', '')}</b><span className="uk">관리비 확인 필요</span></li>)}</ol></div>
        </div>
      </section>

      <section className="lp-story" aria-label="이렇게 써요">
        <div className="lp-steps">{STEPS.map((s, i) => <div key={s[0]} className={`lp-step ${scene === i + 1 ? 'on' : ''}`} data-s={i + 1}><span className="no">{s[0]}</span><h2>{s[1]}</h2><p>{s[2]}</p></div>)}</div>
        <div className="lp-stick"><WebShot scene={scene} play={play} J={J} K={K} U={U} amt1={amt1} tap={tap} amt2={amt2} /></div>
      </section>

      <section className="lp-q"><h2 className="rv">공고문에 이렇게<br />물어볼 수 있어요</h2><p className="rv d1">답은 공고문에 있는 문장으로만 해요.</p>
        <div className="mq rv d2">{mq(rowA, '')}{mq(rowB, 'r')}</div></section>

      <section className="lp-num">{[['지원 판정', 10, '개', '국토부 · 서울시 · 금융위 지원을 내 조건으로'], ['공고문 조각', 1300, '여 개', '질문하면 이 안에서 근거를 찾아요'], ['후보 집 비교', 3, '곳까지', '비용 · 시간 · 동네를 한 표에'], ['로그인', 0, '번', '가입 없이 바로 시작해요']].map((x, i) => (
        <div key={x[0]} className={`rv d${i}`}><small>{x[0]}</small><b><Count to={x[1]} /><i>{x[2]}</i></b><p>{x[3]}</p></div>
      ))}</section>

      <section className="lp-trust"><h2 className="rv">숫자는 코드가 계산하고,<br />AI는 근거를 설명해요</h2>
        <div className="lp-tr">{[['공고문 원문을 같이', '받을 수 있다고 한 지원마다 공고문 문장을 붙여요.'], ["모르면 '확인 필요'", '관리비처럼 모르는 값은 0원으로 치지 않아요.'], ['정해진 규칙으로 계산', '금액 · 점수 · 시간은 매번 같은 규칙으로 계산해요.']].map((t, i) => (
          <div key={t[0]} className={`rv d${i}`}><b>{t[0]}</b><p>{t[1]}</p></div>
        ))}</div></section>

      <section className="lp-end rv"><h2>내 첫 집 파일,<br />지금 만들어 볼까요?</h2><button className="pillb w" onClick={() => startApp()} data-act="시작하기 → 01">내 파일 만들기</button></section>
      <Footer />
    </div>
  );
}
