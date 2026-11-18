/* 여러 화면이 같이 쓰는 작은 조각 */
import { useEffect, useRef } from 'react';
import { ICONS, CH, fill } from '../lib/core.js';

/* 공고문 인용(<mark>) · 계산 문장(<b>)처럼 데이터 안에 글자 꾸밈이 들어 있는 문장. {NM}·{AGE} 같은 자리는 fill()로 채워요 */
export function Html({ html, as: Tag = 'span', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: fill(String(html ?? '')) }} />;
}

export function Icon({ n }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />;
}

const P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', 'aria-hidden': true };
export const IcCk = () => <svg {...P} strokeWidth="3" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IcQ = () => <svg {...P} strokeWidth="2.2" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" /><path d="M12 17.2h.01" /></svg>;
export const IcX = () => <svg {...P} strokeWidth="2.6"><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IcDash = () => <svg {...P} strokeWidth="2.6"><path d="M6 12h12" /></svg>;
export const IcPen = () => <svg {...P} strokeWidth="2" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>;
export const IcSwap = () => <svg {...P} strokeWidth="2" strokeLinejoin="round"><path d="M4 8h14l-3.5-3.5" /><path d="M20 16H6l3.5 3.5" /></svg>;
export const IcDown = () => <svg {...P} strokeWidth="2.4" strokeLinejoin="round"><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></svg>;

export const BBest = ({ children }) => <span className="bdg best"><IcCk />{children}</span>;
export const BUnk = ({ children }) => <span className="bdg unk"><IcQ />{children}</span>;

/* 집 표시 칸 (A·B·C) · 작은 칸은 옆에 집 이름이 있어서 읽지 않아요 */
export const Tile = ({ h, c }) => <span className={`tile ${c || ''}`} style={{ background: h.color }} aria-hidden={c ? true : undefined}>{h.key}</span>;

/* 장 머리: 01 내 조건 · 큰 제목 · 설명 */
export function ChHead({ n, h1, lead, right }) {
  const c = CH[n];
  return (
    <div className="ch-h">
      <div className="ch-o"><span className="ch-no">{c.no}</span>{c.t}</div>
      <div className="ch-row"><h1>{h1}</h1>{right || null}</div>
      {lead ? <p className="ch-lead">{lead}</p> : null}
    </div>
  );
}

/* 자세히 보기 모달 · Esc·바깥 누르면 닫혀요. 열 때 대화상자로, 닫으면 연 버튼으로 포커스가 돌아가요 */
export function Modal({ title, sub, onClose, children, foot, wide }) {
  const box = useRef(null), back = useRef(null);
  useEffect(() => {
    back.current = document.activeElement;
    box.current && box.current.focus();
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', key);
    const ov = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ov; back.current && back.current.focus && back.current.focus({ preventScroll: true }); };
  }, []);
  return (
    <div className="md-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`md ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="md-t" tabIndex={-1} ref={box}>
        <div className="md-h"><div><h2 id="md-t">{title}</h2>{sub ? <p>{sub}</p> : null}</div>
          <button className="md-x" onClick={onClose} aria-label="닫기"><IcX /></button></div>
        <div className="md-b">{children}</div>
        {foot ? <div className="md-f">{foot}</div> : null}
      </div>
    </div>
  );
}
