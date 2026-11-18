/* 02 받을 지원 · 내 조건(01)으로 지원을 판정해요 (judge · moreJ · whatifs 는 lib/core.js)
   내년에 신청할 지원 · 지금 신청할 수 있는 지원 · 공고문에 물어보기 · 조건이 바뀌면? · 받기 어려운 지원 */
import { Fragment } from 'react';
import { S, set, go, render } from '../store.js';
import { judge, moreJ, whatifs, PCOL, QA, JB, ddayOf, toggleAlarm, ask3, API_OK, fill } from '../lib/core.js';
import { Html, Icon, ChHead } from '../components/ui.jsx';
import { AnsCard, ApiCard, LoadCard } from '../components/Ask.jsx';

const won0 = n => n.toLocaleString();

function Easy({ J }) {
  return (
    <>
      <div className="eyebrow">2단계</div>
      <h1>{J.total ? <>내년에 받을 수 있는 돈이<br /><span style={{ color: 'var(--pri)' }}>최대 {won0(J.total)}만 원</span> 있어요</> : <>지금 조건으로는<br />받을 수 있는 지원금이 없어요</>}</h1>
      <div className="lead">{J.total ? '올해 신청은 끝났어요. 내년 공고가 나오면 알려드릴게요.' : (J.fail[0] ? J.fail[0].why[0] : '') + ' 조건이 바뀌면 다시 확인해 보세요.'}</div>
      <div className="sec">{J.chosen.map(p => (
        <button key={p.id} className="erow" onClick={() => toggleAlarm(p.id)} data-act="알림 받기">
          <span className="ico lg"><Icon n={p.icon} /></span><div><div className="t">{p.name}</div><div className="d">{p.easy || p.how}</div></div>
          <div className="m">{p.amtN}만 원<div className="d" style={{ textAlign: 'right' }}>{S.alarm.includes(p.id) ? '✓ 알림 받는 중' : '눌러서 알림 받기'}</div></div>
        </button>
      ))}</div>
      <div className="sec"><div className="note"><span className="ic">!</span><div><b>지금 할 일</b><br />이사하고 14일 안에 전입신고를 해요. 그래야 내년에 받을 수 있어요.{J.m.sep ? <><br />부모님과 주소가 같으면 세대 분리도 같이 해요.</> : null}</div></div></div>
      <div className="cta"><button className="btn pri wide" onClick={() => go(3)} data-act="다음 단계">어느 집이 맞을지 보기</button></div>
    </>
  );
}

/* 지금 신청할 수 있어요 · 카드 + 누르면 AI 판정 근거 */
function S2Now({ M }) {
  const now = M.map((m, i) => ({ m, i })).filter(x => x.m.j === 'ok');
  const sel = now.find(x => S.open === 'ai' + x.i);
  const kind = m => m.kd || (m.ic === 'home' ? '계약 상담 · 집보기 동행 무료' : m.ic === 'bank' ? '전월세 대출 보증' : '시세보다 저렴한 임대주택');
  return (
    <>
      <div className="ncards">{now.map(({ m, i }) => {
        const d = ddayOf(m.end), on = S.open === 'ai' + i, c = PCOL[{ home: 'safe', building: 'house', bank: 'loan' }[m.ic]];
        return (
          <button key={i} className={`ncard ${on ? 'on' : ''}`} style={{ borderTop: `4px solid ${c.fg}`, ...(on ? { borderColor: c.fg, boxShadow: `0 0 0 1px ${c.fg}` } : {}) }}
            onClick={() => set({ open: on ? null : 'ai' + i })} data-act="카드 → AI 판정 근거">
            <div className="dd" style={{ color: c.fg }}>{d === null ? '상시' : 'D-' + d}</div>
            <div className="nn">{m.n.replace(/^2026 /, '')}</div><div className="nb">{kind(m)}</div>
            <div className="no">{m.o} · {m.end ? `${m.end[0] + 1}월 ${m.end[1]}일 마감` : '언제든 신청'}</div>
          </button>
        );
      })}</div>
      {sel ? (
        <div className="npanel ragmark"><div className="np-h"><b>왜 해당되나요?</b><button className="np-x" onClick={() => set({ open: null })}>닫기</button></div>
          <Html as="p" className="np-why" html={sel.m.why} /><div className="np-q">원문 「지원 대상」 "{sel.m.qt}"</div></div>
      ) : null}
    </>
  );
}

/* 내년에 신청할 지원 · 줄을 누르면 내 조건 → 공고 조건 근거 */
function S2Year({ J }) {
  const LB = { ok: '충족', q: '확인 필요', no: '안 맞음' };
  const row = p => {
    const open = S.open === p.id, al = S.alarm.includes(p.id), bad = p.st === 'no';
    return (
      <Fragment key={p.id}>
        <div className="yrow" style={bad ? { opacity: .6 } : undefined}>
          <button className="yrow-b" onClick={() => set({ open: open ? null : p.id })} data-act="정책 펼치기 → 추천 근거">
            <div style={{ minWidth: 0 }}><div className="yn">{p.name}<span className={`chev ${open ? 'open' : ''}`}>›</span></div><div className="yd">{bad ? '조건이 안 맞아요 · ' + p.why.join(', ') : p.how}</div></div>
            {bad ? <div className="ya" style={{ color: 'var(--sub)', fontSize: 15 }}>해당 안 돼요</div> : <div className="ya" style={{ color: PCOL[p.id].fg }}>{p.amtN}<small>만 원</small></div>}
          </button>
          {bad ? <span className="alarm-sp" /> : <button className={`alarm ${al ? 'on' : ''}`} onClick={() => toggleAlarm(p.id)} data-act="공고 알림 받기">{al ? '알림 받는 중' : '공고 알림 받기'}</button>}
        </div>
        {open ? (
          <div className="ydet">
            <div className="ev">{p.ev.map((e, i) => (
              <span key={i} style={{ display: 'contents' }}><span className="k">{fill(e[0])}</span><span className="ar">→</span><span className="v">{e[1]}</span>
                <span className={`st ${e[2]}`} style={e[2] === 'no' ? { color: '#A6392C' } : undefined}>{LB[e[2]]}</span></span>
            ))}</div>
            <div className="np-q">{p.src}<br /><Html html={p.quote} /></div><p className="ylast">{p.last} · {p.channel}</p>
          </div>
        ) : null}
      </Fragment>
    );
  };
  const ex = J.ex;
  const why = () => { S.q3 = 'dupRent'; S.q3t = null; S.q3res = null; S.q3k = null; render(); document.getElementById('q3in').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return (
    <>
      <div className="yl">{J.chosen.map(row)}{J.fail.map(row)}
        <div className="ysum"><span>합계</span><b>{J.total.toLocaleString()}<small>만 원</small></b><span className="alarm-sp" /></div></div>
      {ex ? <p className="yfoot"><b>!</b><span>{ex.name}({ex.amt.replace('최대 ', '')})도 조건은 맞지만 국토부 청년월세와 같이 받을 수 없어서, 금액이 큰 쪽만 넣었어요. <button className="why" onClick={why}>원문 근거</button></span></p> : null}
    </>
  );
}

export default function Step2() {
  const J = judge(), M = moreJ(), W = whatifs();
  if (S.easy) return <Easy J={J} />;
  if (S.whatif && !W[S.whatif]) S.whatif = null;
  const w = S.whatif ? W[S.whatif] : null;
  const nowN = M.filter(m => m.j === 'ok').length, hard = M.filter(m => m.j !== 'ok');
  const ask = v => ask3(v);
  return (
    <div className="s2">
      <ChHead n={2}
        h1={J.total ? <>회원님은 내년에 지원금<br /><em>최대 {won0(J.total)}만 원</em>을 받을 수 있어요</> : <>회원님이 내년에 받을 수 있는<br />지원금은 <em>지금 조건으론 없어요</em></>}
        lead={`만 ${J.m.age}세 · 월 소득 ${J.m.inc}만 원 기준이에요. 공고 조건을 내 조건에 맞춰 본 금액이고, 실제 지급은 신청할 때 서류로 정해져요.`} />
      {J.total ? (
        <>
          <div className="mbar">{J.chosen.map(p => <span key={p.id} style={{ flex: p.amtN, background: PCOL[p.id].fg }} />)}</div>
          <div className="mleg">{J.chosen.map(p => <span key={p.id}><i style={{ background: PCOL[p.id].fg }} />{PCOL[p.id].short.replace(' 월세', ' 청년월세')}<b>{p.amtN}만 원</b></span>)}</div>
        </>
      ) : <p className="lead" style={{ marginTop: 12 }}>{J.fail.map((p, i) => <span key={p.id}>{i ? <br /> : null}{p.name}: {p.why.join(', ')}</span>)}</p>}

      <section className="s2-sec"><div className="s2-h"><h2>내년에 신청할 지원</h2><span className="r">올해 접수는 끝났어요 · 공고 알림을 받아 두세요</span></div>
        <S2Year J={J} />
        {J.m.sep ? <p className="yfoot" style={{ marginTop: 12 }}><b>!</b><span>지금 부모님과 같은 주소라면 <b>이사하면서 세대 분리</b>도 같이 하세요. 국토부 청년월세는 부모님과 따로 사는 청년만 받아요.</span></p> : null}
      </section>

      <section className="s2-sec"><div className="s2-h"><h2>지금 신청할 수 있어요</h2><span className="n">{nowN}</span><span className="ai-by r">AI가 공고문으로 판정했어요</span></div>
        {nowN ? <><S2Now M={M} /><div className="note" style={{ marginTop: 14 }}><span className="ic">i</span><div>신청 마감일과 전입신고 일정은 <button className="link" onClick={() => go(4)} data-act="04 할 일로">04 할 일</button>에 달력으로 모아 뒀어요.</div></div></>
          : <p className="whint">지금 조건으로 바로 신청할 수 있는 지원이 없어요.</p>}
      </section>

      <section className="s2-ask ragmark"><div className="s2-h"><h2>공고문에 물어보기</h2><span className="ai-by r">공고문 근거로만 답해요{API_OK ? ' · AI 연결됨' : API_OK === false ? ' · 서버 꺼짐 (미리 넣은 답)' : ''}</span></div>
        <div className="ask-in"><input id="q3in" placeholder="궁금한 조건을 물어보세요" onKeyUp={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) ask(e.currentTarget.value); }} />
          <button onClick={() => ask(document.getElementById('q3in').value)}>질문</button></div>
        <div className="ask-sg">{['when', 'dupRent', 'age35'].map(k => (
          <button key={k} className={(S.q3 === k || S.q3k === k) ? 'on' : ''} onClick={() => ask3(QA[k].q, k)} data-act="예시 질문 → 답변">{QA[k].q}</button>
        ))}</div>
        {S.q3load ? <LoadCard /> : S.q3res ? <ApiCard r={S.q3res} q={S.q3t} /> : S.q3 ? <AnsCard k={S.q3} q={S.q3t || undefined} /> : null}
      </section>

      <section className="s2-sec"><div className="s2-h"><h2>조건이 바뀌면?</h2></div>
        {Object.keys(W).length ? null : <p className="whint">지금 조건에서는 나이나 계약 방식이 바뀌어도 달라지는 게 없어요.</p>}
        <div className="seg3">{Object.entries(W).map(([k, v]) => (
          <button key={k} className={S.whatif === k ? 'on' : ''} onClick={() => set({ whatif: S.whatif === k ? null : k })} data-act="조건 바꾸기 → 생긴 것/사라진 것">{v.label}</button>
        ))}</div>
        {w ? (
          <div className="wres">
            <div><div className="wl">받을 수 있는 금액</div>{w.total !== null
              ? <><div className="from">{won0(J.total)}만 원</div><div className="big">{won0(w.total)}<small>만 원</small></div></>
              : <div className="big" style={{ fontSize: 20, marginTop: 6 }}>계약마다 달라요</div>}</div>
            <div><h4 className="plus">새로 생겨요</h4><p>{w.plus.length ? w.plus.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>) : '없음'}</p></div>
            <div><h4 className="minus">빠져요</h4><p>{w.minus.length ? w.minus.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>) : '없음'}</p></div>
          </div>
        ) : <p className="whint">하나를 고르면 받을 수 있는 금액이 어떻게 바뀌는지 보여드려요.</p>}
      </section>

      <section className="s2-sec ragmark">
        <button className="more-t" onClick={() => set({ moreOpen: !S.moreOpen })} data-act="받기 어려운 지원 펼치기">지금은 받기 어려운 지원 <span className="c">{hard.length}개</span><span className={`chev ${S.moreOpen ? 'open' : ''}`}>›</span></button>
        {S.moreOpen ? hard.map((m, i) => <div className="mrow" key={i}><div className="nm">{m.n}</div><div className={`st ${m.j}`}>{JB[m.j][1]}</div><Html as="div" className="rs" html={m.why} /></div>) : null}
      </section>

      <div className="cta"><button className="btn ghost" onClick={() => go(1)}>이전</button><button className="btn pri wide" onClick={() => go(3)} data-act="다음 단계">후보 집 비교하기</button></div>
    </div>
  );
}
