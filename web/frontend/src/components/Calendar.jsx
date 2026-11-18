/* 04 할 일 · 신청 달력 (2026년 11~12월) · 신청 기간 막대를 누르면 그 할 일이 열려요 (onPick)
   입주일은 01에서 월까지만 받아서, 입주·전입신고는 날짜 칸에 그리지 않아요 */
import { S, set } from '../store.js';
import { CAL_EVENTS, PCOL, TODAY, d0, moreJ } from '../lib/core.js';

export default function Calendar({ M, onPick }) {
  M = M || moreJ();
  const m = S.calM, first = d0(m, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const weeks = []; const cur = new Date(start);
  while (true) { const w = []; for (let i = 0; i < 7; i++) { w.push(new Date(cur)); cur.setDate(cur.getDate() + 1); } weeks.push(w); if (cur.getMonth() !== m) break; }
  const evs = CAL_EVENTS.filter(e => e.id !== 'house' || M[1].j === 'ok').filter(e => e.id !== 'safe' || M[0].j === 'ok').filter(e => e.kind !== 'me').map(e => ({ ...e, sd: d0(...e.s), ed: d0(...e.e) }));
  return (
    <div className="cal">
      <div className="cal-h">
        <button className="nav" onClick={() => { if (m !== 10) set({ calM: 10 }); }} aria-label="이전 달" aria-disabled={m === 10} data-act="이전 달">‹</button>
        <b aria-live="polite">2026년 {m + 1}월</b>
        <button className="nav" onClick={() => { if (m !== 11) set({ calM: 11 }); }} aria-label="다음 달" aria-disabled={m === 11} data-act="다음 달">›</button>
        <div className="cal-lg">
          {['safe', 'house'].map(k => <span key={k}><i style={{ background: PCOL[k].bg, border: `1px solid ${PCOL[k].bd}` }} />{PCOL[k].short}</span>)}
        </div>
      </div>
      <div className="dow">{['일', '월', '화', '수', '목', '금', '토'].map(x => <div key={x}>{x}</div>)}</div>
      {weeks.map((w, wi) => {
        const ws = w[0], we = w[6]; const lanes = [];
        const bars = evs.filter(e => e.sd <= we && e.ed >= ws).map((e, ei) => {
          const a = Math.max(0, Math.round((e.sd - ws) / 864e5)), b = Math.min(6, Math.round((e.ed - ws) / 864e5));
          let lane = 0; while (lanes[lane] && lanes[lane].some(([x, y]) => !(b < x || a > y))) lane++; (lanes[lane] = lanes[lane] || []).push([a, b]);
          const label = (b - a < 2 && e.sd < ws) ? `${e.ed.getDate()}일 마감` : e.name;
          const c = PCOL[e.id] || {};
          const st = e.kind === 'me' ? { background: '#fff', color: '#1D2421', border: '1.5px solid #1D2421' }
            : e.kind === 'line' ? { background: '#fff', color: c.fg, border: `1.5px solid ${c.fg}` }
            : { background: c.bg, color: c.fg, border: `1px solid ${c.bd}` };
          const aiId = e.id ? 'ai' + (e.id === 'safe' ? 0 : 1) : null;
          return (
            <button key={ei} className={`bar ${e.id && S.open === aiId ? 'sel' : ''}`} aria-label={`${e.name}, ${e.ed.getMonth() + 1}월 ${e.ed.getDate()}일 마감`} style={{ ...st, gridColumn: `${a + 1}/${b + 2}`, gridRow: lane + 1 }}
              {...(e.id ? { onClick: () => onPick ? onPick(aiId) : set({ open: aiId }), 'data-act': '달력 막대 → 해당 정책 펼침' } : {})}>{label}</button>
          );
        });
        return (
          <div className="wk" key={wi}>
            <div className="days">{w.map((d, di) => {
              const out = d.getMonth() !== m, today = +d === +TODAY;
              return <div key={di} className={`dn ${out ? 'out' : ''} ${today ? 'today' : ''} ${d < TODAY && !out ? 'past' : ''} ${d.getDay() === 0 ? 'sun' : ''}`}><span>{d.getDate()}</span></div>;
            })}</div>
            <div className="bars">{bars}</div>
          </div>
        );
      })}
    </div>
  );
}
