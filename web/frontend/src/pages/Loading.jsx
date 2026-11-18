/* 01 → 02 넘어갈 때 3초 동안 보여주는 로딩 화면
   진행 막대가 0 → 100%로 차고, 판정 순서(나이 → 소득 → 무주택·세대 → 공고문 근거)를 내 값과 함께 하나씩 체크해요.
   3초가 지나면 02 받을 지원으로 넘어가요. 움직임 줄이기 설정이면 막대·체크는 바뀌지만 움직이는 효과는 빼요. */
import { useEffect, useRef, useState } from 'react';
import { finishLoading } from '../store.js';
import { me, MED1, POL, MORE } from '../lib/core.js';
import { IcCk } from '../components/ui.jsx';

export const LOADING_MS = 3000;

export default function Loading() {
  const [t, setT] = useState(0);                       // 지난 시간 (ms)
  const done = useRef(false);
  const m = me(), pct = Math.round(m.inc / MED1 * 100);
  const steps = [
    ['나이 조건 확인', `만 ${m.age}세`],
    ['소득 기준 비교', `월 ${m.inc.toLocaleString()}만 원 · 중위 ${pct}%`],
    ['무주택 · 세대 확인', `${m.own ? '집 있음' : '무주택'}${m.sep ? (m.sepQ ? ' · 주소 확인 필요' : ' · 세대 분리 예정') : ''}`],
    ['공고문 근거 맞춰 보기', `지원 ${POL.length + MORE.length}개`],
  ];
  const each = LOADING_MS / (steps.length + .3);     // 한 줄씩 차례로, 마지막 줄은 3초 전에 끝나요

  useEffect(() => {
    // 화면 그리기 주기(rAF)는 탭이 뒤에 있으면 멈춰서, 시계로 50ms마다 지난 시간을 다시 재요
    const t0 = performance.now();
    const iv = setInterval(() => setT(Math.max(0, Math.min(LOADING_MS, performance.now() - t0))), 50);
    const end = setTimeout(() => { if (!done.current) { done.current = true; finishLoading(); } }, LOADING_MS);
    return () => { clearInterval(iv); clearTimeout(end); };
  }, []);

  const p = Math.round(t / LOADING_MS * 100);
  const okN = Math.max(0, Math.min(steps.length, Math.floor(t / each)));
  const now = okN < steps.length ? steps[okN][0] : '다 됐어요';
  return (
    <div className="ld">
      <div className="ld-top"><span className="logo">첫집<b>내비</b></span></div>
      <main className="ld-in">
        <section className="ld-card" aria-labelledby="ld-t">
          <div className="ld-house" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path className="roof" d="M3.5 11.5L12 4l8.5 7.5" /><path className="wall" d="M6 10v10h12V10" /><path className="door" d="M10 20v-5h4v5" />
            </svg>
          </div>
          <div className="ld-o"><span className="ch-no">02</span>받을 지원</div>
          <h1 id="ld-t">내 조건으로 받을 수 있는<br />지원을 찾고 있어요</h1>
          <div className="ld-bar" role="progressbar" aria-label="지원 찾는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}><i style={{ width: `${p}%` }} /></div>
          <div className="ld-pct"><span>공고문 조건과 내 조건을 한 줄씩 맞춰 보는 중</span><b>{p}%</b></div>
          <ol className="ld-list">
            {steps.map(([k, v], i) => (
              <li key={k} className={i < okN ? 'ok' : i === okN ? 'run' : ''}>
                <i aria-hidden="true">{i < okN ? <IcCk /> : null}</i><b>{k}</b><span>{v}</span>
              </li>
            ))}
          </ol>
          <p className="sr" role="status" aria-live="polite">{now}</p>
          <p className="ld-foot">숫자는 코드가 정해진 규칙으로 계산해요. 잠시 뒤 02 받을 지원으로 넘어가요.</p>
        </section>
      </main>
    </div>
  );
}
