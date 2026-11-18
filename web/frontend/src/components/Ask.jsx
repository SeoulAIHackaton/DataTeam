/* 공고문 질문 답 카드 · 서버(/api/ask)가 있으면 RAG 답(apiCard), 없으면 미리 넣어 둔 답(QA) */
import { QA } from '../lib/core.js';
import { Html } from './ui.jsx';

const sup = t => t.replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');

export function AnsCard({ k, q }) {
  const v = QA[k];
  return (
    <>
      {q !== false ? <div className="qb">{q || v.q}</div> : null}
      <div className="ab">
        <div className="who">주거 상담 AI {v.miss ? <span className="jb q" style={{ margin: 0 }}>근거 없음 → 상담 연결</span> : <span className="aitag">공고문 {v.src.length}건 근거</span>}</div>
        <Html html={sup(v.a)} />
        {v.calc ? <span className="calc">{v.calc}</span> : null}
        <div className="src">{v.src.map((s, i) => (
          <span key={i}>[{i + 1}] {s[0]} · <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--pri)' }}>원문 보기</a><span className="qt">"{s[1]}"</span></span>
        ))}</div>
      </div>
    </>
  );
}

export function ApiCard({ r, q }) {
  const a = sup(String(r.answer || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/\n/g, '<br>'));
  return (
    <>
      {q ? <div className="qb">{q}</div> : null}
      <div className="ab">
        <div className="who">주거 상담 AI {r.found === false
          ? <span className="jb q" style={{ margin: 0 }}>근거 없음 → 상담 연결</span>
          : <span className="aitag">{r.mode === 'AI' ? 'AI 답변' : '공고문 원문'} · 근거 {r.sources.length}건</span>}</div>
        <Html html={a} />
        <div className="src">{r.sources.map((s, i) => (
          <span key={i}>[{s.n}] {s.name} · {s.section}{s.url && /^https?:/.test(s.url) ? <> · <a href={s.url} target="_blank" rel="noopener" style={{ color: 'var(--pri)' }}>원문 보기</a></> : null}
            <span className="qt">"{(s.text || '').slice(0, 160)}{(s.text || '').length > 160 ? '…' : ''}"</span></span>
        ))}</div>
      </div>
    </>
  );
}

export const LoadCard = () => <div className="ab load"><div className="who">주거 상담 AI</div>공고문 1,300여 개 조각에서 찾는 중…</div>;
