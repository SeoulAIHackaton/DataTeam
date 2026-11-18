/* 02 받을 지원 · 내 조건(01)으로 지원을 판정해요 (judge · moreJ · whatifs 는 lib/core.js)
   결과 요약 → 지금 신청할 지원(마감순) → 다음 공고를 기다릴 지원(알림) → 보조: 조건이 바뀌면? · 공고문에 물어보기 · 받기 어려운 지원 */
import { S, set, go, render } from '../store.js';
import { judge, moreJ, whatifs, QA, ddayOf, toggleAlarm, ask3, API_OK, fill } from '../lib/core.js';
import { Html, Icon, ChHead, Modal } from '../components/ui.jsx';
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

/* 지원 한 줄 (토스 목록 방식) · 아이콘 / 이름·한 줄 설명 / 금액·상태 / 버튼. 줄을 누르면 자세히 보기 모달이 떠요 */
function Row({ ic, name, sub, val, valSub, tone, act, dim, onOpen }) {
  return (
    <li className={`tr s2-row ${dim ? 'tr-dim' : ''}`}>
      <button className="tr-m" onClick={onOpen} aria-haspopup="dialog" data-act="자세히 보기 모달">
        <span className="tr-ic" aria-hidden="true"><Icon n={ic} /></span>
        <span className="tr-t"><b>{name}</b><small>{sub}</small></span>
        <span className={`tr-v ${tone || ''}`}><b>{val}</b>{valSub ? <small>{valSub}</small> : null}</span>
        <span className="s2-row-chevron" aria-hidden="true" /><span className="sr">자세히 보기</span>
      </button>
      {act ? <div className="tr-a">{act}</div> : null}
    </li>
  );
}

const KIND = m => m.kd || (m.ic === 'home' ? '계약 상담 · 집보기 동행 무료' : m.ic === 'bank' ? '보증금이 모자랄 때 대출 보증' : '시세보다 저렴한 임대주택');
const LB = { ok: '충족', q: '확인 필요', no: '안 맞음' };
const WIC = { age: 'user', income: 'receipt', jeonse: 'bank' };
const cut = t => t.replace(/ \(.*\)$/, '').replace(/ [\d,]+만 원$/, '');
const short = v => [...v.plus.map(t => '+ ' + cut(t)), ...v.minus.map(t => '− ' + cut(t))].join(' · ') || '달라지는 지원 없음';
const clean = t => String(fill(t)).replace(/[✓✗?]\s*/g, '');
const marks = t => String(fill(t)).split(' · ').map(x => ({ c: /^✗/.test(x) ? 'no' : /^\?/.test(x) ? 'q' : 'ok', t: x.replace(/^[✓✗?]\s*/, '') }));

/* 자세히 보기 모달 · 내 조건 → 공고 기준 → 확인 결과 */
function S2Modal({ J, now, M, W }) {
  const md = S.md, close = () => set({ md: null });
  if (!md) return null;
  if (md.k === 'what') {
    const v = W[md.id]; if (!v) return null;
    return (
      <Modal title={v.label} sub="지금 조건과 비교해서 받을 수 있는 지원이 이렇게 바뀌어요" onClose={close}
        foot={<><button className="btn ghost" onClick={() => { set({ md: null }); go(1); }}>01 내 조건 고치기</button><button className="btn pri" onClick={close}>확인</button></>}>
        <dl className="md-kv">
          <div><dt>지금</dt><dd>{J.total ? `최대 ${won0(J.total)}만 원` : '없음'}</dd></div>
          <div><dt>바뀌면</dt><dd>{v.total === null ? '계약마다 달라요' : `최대 ${won0(v.total)}만 원`}</dd></div>
        </dl>
        <h3 className="md-st">새로 받을 수 있어요</h3>
        <ul className="md-chk">{v.plus.length ? v.plus.map((t, i) => <li key={i} className="ok">{t}</li>) : <li className="none">없음</li>}</ul>
        <h3 className="md-st">받을 수 없게 돼요</h3>
        <ul className="md-chk">{v.minus.length ? v.minus.map((t, i) => <li key={i} className="no">{t}</li>) : <li className="none">없음</li>}</ul>
      </Modal>
    );
  }
  if (md.k === 'hard') {
    const m = M[md.i]; if (!m) return null;
    return (
      <Modal title={m.n.replace(/^2026 /, '')} sub={m.o} onClose={close} foot={<button className="btn pri" onClick={close}>확인</button>}>
        <dl className="md-kv"><div><dt>지금 판정</dt><dd>{m.j === 'cond' ? '조건부 · 전세로 계약하면 해당돼요' : '지금 조건으로는 받기 어려워요'}</dd></div></dl>
        <h3 className="md-st">내 조건으로 확인했어요</h3>
        <ul className="md-chk">{marks(m.why).map((x, k) => <li key={k} className={m.j === 'cond' && x.c === 'ok' ? 'q' : x.c}>{x.t}</li>)}</ul>
        <h3 className="md-st">공고 기준</h3>
        <p className="md-q">{m.qt}</p>
      </Modal>
    );
  }
  if (md.k === 'now') {
    const x = now.find(z => z.i === md.i); if (!x) return null;
    const m = x.m, d = ddayOf(m.end), parts = String(fill(m.why)).split(' · ');
    return (
      <Modal title={m.n.replace(/^2026 /, '')} sub={m.o} onClose={close}
        foot={<><button className="btn ghost" onClick={close}>닫기</button><button className="btn pri" onClick={() => { set({ md: null }); go(4); }} data-act="04 할 일로">할 일에서 신청 준비하기</button></>}>
        <dl className="md-kv">
          <div><dt>받는 것</dt><dd>{KIND(m)}</dd></div>
          <div><dt>접수</dt><dd>{d === null ? '상시 접수' : `${m.end[0] + 1}월 ${m.end[1]}일 마감 · D-${d}`}</dd></div>
        </dl>
        <h3 className="md-st">내 조건으로 확인했어요 <span className="ai-by">AI가 공고문으로 판정</span></h3>
        <ul className="md-chk">{parts.map((t, k) => <li key={k} className={/^✗/.test(t) ? 'no' : /^\?/.test(t) ? 'q' : 'ok'}>{t.replace(/^[✓✗?]\s*/, '')}</li>)}</ul>
        <h3 className="md-st">공고 기준</h3>
        <p className="md-q">「지원 대상」 {m.qt}</p>
      </Modal>
    );
  }
  const p = J.list.find(z => z.id === md.id); if (!p) return null;
  const al = S.alarm.includes(p.id), bad = p.st === 'no';
  return (
    <Modal title={p.name} sub={p.channel} onClose={close}
      foot={<><button className="btn ghost" onClick={close}>닫기</button>{bad ? null : <button className={`btn ${al ? 'ghost' : 'pri'}`} aria-pressed={al} onClick={() => toggleAlarm(p.id)} data-act="공고 알림 받기">{al ? '✓ 알림 받는 중' : '2027년 공고 알림 받기'}</button>}</>}>
      <dl className="md-kv">
        <div><dt>받는 돈</dt><dd>{p.pay} <span>· 총 {p.amt}</span></dd></div>
        <div><dt>접수</dt><dd>{p.last}</dd></div>
      </dl>
      <h3 className="md-st">내 조건과 공고 기준을 맞춰 봤어요</h3>
      <div className="ev3" role="table" aria-label={`${p.name} 조건 확인`}>
        <div className="ev3-h" role="row"><span role="columnheader">내 조건</span><span role="columnheader">공고 기준</span><span role="columnheader">확인 결과</span></div>
        {p.ev.map((e, i) => <div className="ev3-r" role="row" key={i}><span role="cell">{fill(e[0])}</span><span role="cell">{e[1]}</span><span role="cell" className={`st ${e[2]}`}>{LB[e[2]]}</span></div>)}
      </div>
      <h3 className="md-st">공고 원문</h3>
      <p className="md-q"><Html html={p.quote} /><br /><small>{p.src}</small></p>
    </Modal>
  );
}

export default function Step2() {
  const J = judge(), M = moreJ(), W = whatifs();
  if (S.easy) return <Easy J={J} />;
  const dd = m => { const d = ddayOf(m.end); return d === null ? Infinity : d; };
  const now = M.map((m, i) => ({ m, i })).filter(x => x.m.j === 'ok').sort((a, b) => dd(a.m) - dd(b.m));
  const nowN = now.length, hard = M.filter(m => m.j !== 'ok');
  const near = now.find(x => x.m.end), nearD = near ? ddayOf(near.m.end) : null;
  const ask = v => ask3(v);
  const why = () => { set({ md: null }); S.q3 = 'dupRent'; S.q3t = null; S.q3res = null; S.q3k = null; render(); document.getElementById('q3in').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  return (
    <div className="s2 tz">
      <ChHead n={2}
        h1={J.total ? <>내년에 지원금<br /><em>최대 {won0(J.total)}만 원</em>을 받을 수 있어요</> : <>내년에 받을 수 있는 지원금은<br /><em>지금 조건으론 없어요</em></>}
        lead={`만 ${J.m.age}세 · 월 소득 ${J.m.inc}만 원 기준 · 실제 지급은 신청할 때 서류로 정해져요`} />

      {/* 1 · 결과 요약 */}
      <dl className="tz-sum s2-overview">
        <div><dt>내 조건에 맞는 지원</dt><dd>{J.chosen.length + nowN}개</dd></div>
        <div><dt>지금 신청할 수 있어요</dt><dd>{nowN}개</dd></div>
        <div><dt>가장 가까운 마감</dt><dd>{nearD !== null ? `D-${nearD}` : '없음'}</dd></div>
      </dl>

      <section className="tz-sec"><h2>지금 신청할 수 있어요 <span>마감 가까운 순</span></h2>
        {nowN ? <ul className="tl2">{now.map(({ m, i }) => { const d = ddayOf(m.end); return (
          <Row key={i} ic={m.ic || 'home'} name={m.n.replace(/^2026 /, '')} sub={KIND(m)}
            val={d === null ? '상시' : `D-${d}`} valSub={m.end ? `${m.end[0] + 1}월 ${m.end[1]}일 마감` : '언제든 신청'} tone={d !== null && d <= 14 ? 'urg' : ''}
            onOpen={() => set({ md: { k: 'now', i } })}
            act={<button className="tbtn" onClick={() => go(4)} aria-label={`${m.n.replace(/^2026 /, '')} 할 일 보기`} data-act="04 할 일로">할 일 보기</button>} />
        ); })}</ul> : <p className="whint">지금 조건으로 바로 신청할 수 있는 지원이 없어요.</p>}
      </section>

      <section className="tz-sec"><h2>내년 공고를 기다려요 <span>올해 접수는 끝났어요</span></h2>
        <ul className="tl2">
          {J.chosen.map(p => { const al = S.alarm.includes(p.id); return (
            <Row key={p.id} ic={p.icon} name={p.name} sub={p.pay}
              val={`${p.amtN}만 원`} valSub="2027년 공고" tone="money"
              onOpen={() => set({ md: { k: 'pol', id: p.id } })}
              act={<button className={`tbtn ${al ? 'on' : ''}`} aria-pressed={al} aria-label={`${p.name} ${al ? '알림 받는 중' : '알림 받기'}`} onClick={() => toggleAlarm(p.id)} data-act="공고 알림 받기">{al ? '알림 받는 중' : '알림 받기'}</button>} />
          ); })}
          {J.fail.map(p => <Row key={p.id} dim ic={p.icon} name={p.name} sub={p.why.join(', ')} val="받기 어려워요" onOpen={() => set({ md: { k: 'pol', id: p.id } })} act={null} />)}
        </ul>
        {J.ex ? <p className="tz-note">{J.ex.name}({J.ex.amt.replace('최대 ', '')})도 조건은 맞지만 국토부 청년월세와 같이 받을 수 없어서 금액이 큰 쪽만 넣었어요. <button className="link" onClick={why}>원문 근거</button></p> : null}
        {J.m.sep ? <p className="tz-note">부모님과 같은 주소라면 <b>이사하면서 세대 분리</b>도 같이 하세요. 국토부 청년월세는 부모님과 따로 사는 청년만 받아요.</p> : null}
      </section>

      <div className="cta s2-cta"><button className="btn ghost" onClick={() => go(1)}>이전</button><button className="btn pri wide" onClick={() => go(3)} data-act="다음 단계">후보 집 비교하기</button></div>

      <S2Modal J={J} now={now} M={M} W={W} />

      <div className="tz-aux">
        <section className="tz-sec sm"><h2>조건이 바뀌면 이렇게 달라져요</h2>
          {Object.keys(W).length ? <ul className="tl2">{Object.entries(W).map(([k, v]) => {
            const d = v.total === null ? null : v.total - J.total;
            return <Row key={k} ic={WIC[k] || 'user'} name={v.label} sub={short(v)}
              val={v.total === null ? '계약마다 달라요' : `${won0(v.total)}만 원`} valSub={d === null ? '' : d === 0 ? '변화 없음' : `${d > 0 ? '+' : '−'}${won0(Math.abs(d))}만 원`}
              tone={d === null ? '' : d < 0 ? 'down' : d > 0 ? 'up' : ''} onOpen={() => set({ md: { k: 'what', id: k } })} act={null} />;
          })}</ul> : <p className="whint">지금 조건에서는 나이나 계약 방식이 바뀌어도 달라지는 게 없어요.</p>}
        </section>

        {hard.length ? <section className="tz-sec sm ragmark"><h2>지금은 받기 어려운 지원 <span>{hard.length}개</span></h2>
          <ul className="tl2">{(S.moreOpen ? hard : hard.slice(0, 2)).map(m => { const i = M.indexOf(m), cond = m.j === 'cond';
            return <Row key={i} dim={!cond} ic={cond ? 'bank' : 'home'} name={m.n.replace(/^2026 /, '')} sub={clean(m.why)}
              val={cond ? '전세라면 가능' : '조건 안 맞음'} tone={cond ? 'cond' : ''} onOpen={() => set({ md: { k: 'hard', i } })} act={null} />; })}</ul>
          {hard.length > 2 ? <button className="tz-morebtn" aria-expanded={!!S.moreOpen} onClick={() => set({ moreOpen: !S.moreOpen })} data-act="받기 어려운 지원 더 보기">{S.moreOpen ? '접기' : `${hard.length - 2}개 더 보기`}</button> : null}
        </section> : null}

        <section className="tz-sec sm tz-ask ragmark"><h2>공고문에 물어보기</h2>
          <p className="tz-sub">공고문에 있는 문장으로만 답하고, 근거 문장을 같이 보여드려요{API_OK === false ? ' · 지금은 미리 준비한 답으로 보여드려요' : ''}</p>
          <div className="ask-in"><input id="q3in" aria-label="공고문에 물어볼 내용" placeholder="예: 직장 다닌 지 1년 안 됐는데 받을 수 있어요?" onKeyUp={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) ask(e.currentTarget.value); }} />
            <button onClick={() => ask(document.getElementById('q3in').value)}>질문하기</button></div>
          <ul className="tz-faq" aria-label="자주 묻는 질문">{['when', 'dupRent', 'age35'].map(k => (
            <li key={k}><button className={(S.q3 === k || S.q3k === k) ? 'on' : ''} onClick={() => ask3(QA[k].q, k)} data-act="예시 질문 → 답변"><i>Q</i>{QA[k].q}<span className="chev">›</span></button></li>
          ))}</ul>
          {S.q3load ? <LoadCard /> : S.q3res ? <ApiCard r={S.q3res} q={S.q3t} /> : S.q3 ? <AnsCard k={S.q3} q={S.q3t || undefined} /> : null}
        </section>
      </div>

    </div>
  );
}
