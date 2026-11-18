/* 04 할 일 · 앞 장(01~03)에서 나온 것을 체크리스트로 모아요 (새로 계산하지 않아요)
   토스 방식: 맨 위 '다음에 할 일' 하나 + 가까운 마감 → 진행 막대 → 계약 전 → 이사할 때 → 지원 신청 타임라인
   줄마다 체크 · 할 일 · 기한 · 실행 버튼. 설명과 근거는 모달로, 끝낸 일은 접어 둬요. 달력은 오른쪽 일정 요약에서 모달로 열어요 */
import { S, set, go, focusId } from '../store.js';
import { todoAll, todoFlat, DONE, tdDone, toggleAlarm, moreJ, CH, copyFile, ddayOf, whenDate1 } from '../lib/core.js';
import { Html, Tile, ChHead, Modal, IcCk } from '../components/ui.jsx';
import Calendar from '../components/Calendar.jsx';

const GT = [['before', '계약 전에', '집을 정하기 전에 해 두면 좋아요'], ['move', '이사할 때', '입주하고 14일 안에'], ['apply', '지원 신청', '지금 신청할 것과 내년 공고']];
const groupsOf = G => ({ before: G.before, move: G.move, apply: [...G.apply, ...G.next] });

/* 줄의 실행 버튼 · 앞 장으로 가기 / 알림 받기 / 자세히 */
function Act({ x }) {
  if (x.alarm) { const al = S.alarm.includes(x.alarm);
    return <button className={`tbtn ${al ? 'on' : ''}`} aria-pressed={al} onClick={() => toggleAlarm(x.alarm)} data-act="공고 알림 받기">{al ? '알림 받는 중' : '알림 받기'}</button>; }
  if (x.go) return <button className="tbtn" onClick={() => go(x.go)} data-act="그 장으로">{x.goT || CH[x.go].no + ' ' + CH[x.go].t}</button>;
  return <button className="tbtn gray" onClick={() => set({ tdMd: x.id })} aria-haspopup="dialog" data-act="자세히 보기">자세히</button>;
}

function Item({ x, onToggle }) {
  const on = !!DONE()[x.id];
  const when = x.when?.replace(/ · D-\d+$/, '');
  return (
    <li className={`tdr ${on ? 'done' : ''}`}>
      <label className="tck"><input type="checkbox" id={`tdc-${x.id}`} checked={on} onChange={e => onToggle(x, e.target.checked)} aria-labelledby={`tdt-${x.id}`} /><span aria-hidden="true"><IcCk /></span></label>
      <button className="tdr-m" onClick={() => set({ tdMd: x.id })} aria-haspopup="dialog" data-act="할 일 자세히 보기 모달">
        <b id={`tdt-${x.id}`}>{x.t}</b>{x.sub ? <small>확인할 것 {x.sub.length}개</small> : null}{S.easy ? null : <span className="tdr-chevron" aria-hidden="true" />}</button>
      {S.easy || when ? <span className="tdr-w">{when}</span> : null}
      {S.easy || (!on && (x.alarm || x.go)) ? <div className="tdr-a">{on ? null : <Act x={x} />}</div> : null}
    </li>
  );
}

function Group({ k, t, sub, list }) {
  if (!list.length) return null;
  const open = list.filter(x => !DONE()[x.id]), done = list.filter(x => DONE()[x.id]), show = (S.tdDoneOpen || {})[k];
  const onToggle = (x, checked) => {
    tdDone(x.id, checked);
    if (S.easy || !checked || show) return;
    const i = open.indexOf(x), next = open[i + 1] ?? open[i - 1];
    focusId(next ? `tdc-${next.id}` : `tdg-${k}-toggle`);
  };
  return (
    <section className={`tdg ${open.length ? '' : 'all'}`}>
      <span className="tdg-dot" aria-hidden="true">{open.length ? null : <IcCk />}</span>
      <h2>{t} <span>{done.length} / {list.length}</span><small>{sub}</small></h2>
      {open.length ? <ul className="tdl">{open.map(x => <Item key={x.id} x={x} onToggle={onToggle} />)}</ul> : <p className="tdg-all">모두 끝냈어요</p>}
      {done.length ? <>
        <button id={`tdg-${k}-toggle`} className="tdg-more" aria-expanded={!!show} onClick={() => set({ tdDoneOpen: { ...(S.tdDoneOpen || {}), [k]: !show } })} data-act="완료한 일 펼치기">완료한 일 {done.length}개 {show ? '접기' : '보기'}</button>
        {show ? <ul className="tdl">{done.map(x => <Item key={x.id} x={x} onToggle={onToggle} />)}</ul> : null}
      </> : null}
    </section>
  );
}

/* 할 일 자세히 보기 */
function TdModal({ all }) {
  const x = all.find(z => z.id === S.tdMd); if (!x) return null;
  const on = !!DONE()[x.id], chk = S.chk || (S.chk = {}), close = () => set({ tdMd: null });
  return (
    <Modal title={x.t} sub={x.when || ''} onClose={close}
      foot={<><button className="btn ghost" onClick={() => { tdDone(x.id, !on); close(); }} data-act="완료 표시">{on ? '아직 안 했어요' : '다 했어요'}</button>
        {x.go ? <button className="btn pri" onClick={() => { close(); go(x.go); }}>{x.goT || CH[x.go].no + ' ' + CH[x.go].t + '에서 보기'}</button>
          : x.alarm ? <button className="btn pri" onClick={() => toggleAlarm(x.alarm)}>{S.alarm.includes(x.alarm) ? '✓ 알림 받는 중' : '공고 알림 받기'}</button>
          : <button className="btn pri" onClick={close}>확인</button>}</>}>
      <p className="md-p">{x.d}</p>
      {x.sub ? <><h3 className="md-st">확인할 것</h3>
        <ul className="md-ck s4-checks">{x.sub.map(it => (
          <li key={it.id}><label className="tck sm"><input type="checkbox" defaultChecked={!!chk[it.id]} aria-labelledby={`td-sub-${it.id}`} onChange={e => { (S.chk = S.chk || {})[it.id] = e.target.checked; }} /><span aria-hidden="true"><IcCk /></span></label>
            <span id={`td-sub-${it.id}`}>{it.h ? <Tile h={it.h} c="xs" /> : null}{it.t}</span></li>
        ))}</ul></> : null}
      {x.why ? <><h3 className="md-st">왜 해당되나요?</h3><p className="md-p"><Html html={x.why} /></p><p className="md-q">「지원 대상」 {x.qt}</p></> : null}
    </Modal>
  );
}

export default function Step4() {
  const G = todoAll(), all = todoFlat(G), left = all.filter(x => !DONE()[x.id]).length, M = moreJ(), GG = groupsOf(G);
  const next = all.find(x => !DONE()[x.id]);
  const deads = M.filter(m => m.j === 'ok' && m.end).sort((a, b) => ddayOf(a.end) - ddayOf(b.end)), near = deads[0];
  const pct = all.length ? Math.round((all.length - left) / all.length * 100) : 0;
  const pick = aiId => { const x = all.find(z => z.open === aiId); set({ calMd: false, tdMd: x ? x.id : null }); };
  const body = (
    <div className="tdt">{GT.map(([k, t, sub]) => <Group key={k} k={k} t={t} sub={sub} list={GG[k]} />)}</div>
  );
  if (S.easy) return (
    <div className="tz">
      <ChHead n={4} h1={left ? <>할 일이 <em>{left}개</em> 남았어요</> : <>할 일을 <em>모두</em> 끝냈어요</>} lead="하나씩 끝내면 체크해 주세요." />
      {body}
      <TdModal all={all} />
      <div className="cta"><button className="btn ghost" onClick={() => go(3)}>이전</button></div>
    </div>
  );
  return (
    <div className="tz s4">
      <ChHead n={4} h1={left ? <>할 일 <em>{left}개</em>가 남았어요</> : <>할 일을 <em>모두</em> 끝냈어요</>}
        lead="01~03에서 나온 마감과 확인할 것을 순서대로 모았어요" />

      {/* 다음에 할 일 하나 + 가까운 마감 */}
      {next ? (
        <section className="tz-next" aria-labelledby="next-t">
          <p className="tz-o">다음에 할 일</p>
          <h2 id="next-t">{next.t}</h2>
          <p className="tz-why">{next.d}</p>
          <div className="tz-next-a">
            <button className="btn pri" onClick={() => set({ tdMd: next.id })} aria-haspopup="dialog">자세히 보고 시작하기</button>
            <button className="btn ghost" onClick={() => {
              tdDone(next.id, true);
              if (left === 1) focusId('s4-progress');
            }} data-act="완료 표시">다 했어요</button>
          </div>
        </section>
      ) : null}
      <div className="s4-overview">
        <dl className="tz-sum" id="s4-progress" tabIndex={-1} aria-label="할 일 진행과 가까운 마감">
          <div><dt>완료한 할 일</dt><dd>{all.length - left} / {all.length}<span className="tz-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span></dd></div>
          <div><dt>가까운 마감</dt><dd>{near ? `D-${ddayOf(near.end)}` : '없음'}</dd>{near ? <small>{near.end[0] + 1}월 {near.end[1]}일 · {near.n.replace(/^2026 /, '')}</small> : null}</div>
        </dl>
        <button className="tbtn gray s4-calendar" onClick={() => set({ calMd: true })} aria-haspopup="dialog" data-act="전체 달력 모달">일정 보기 <span aria-hidden="true">›</span></button>
      </div>

      {body}

      <div className="cta"><button className="btn ghost" onClick={() => go(3)}>이전</button><button className="btn pri wide" id="file-copy2" onClick={copyFile} data-act="파일 복사">파일 전체 복사하기</button></div>
      <TdModal all={all} />
      {S.calMd ? (
        <Modal wide title="신청 일정" sub="신청 기간을 누르면 그 할 일이 열려요 · 입주일은 월까지만 정해서 달력에 넣지 않았어요" onClose={() => set({ calMd: false })}>
          <Calendar M={M} onPick={pick} />
        </Modal>
      ) : null}
    </div>
  );
}

/* 오른쪽 · 다가오는 일정 요약 */
export function SchedPanel() {
  const M = moreJ(), mv = whenDate1();
  const deads = M.filter(m => m.j === 'ok' && m.end).sort((a, b) => ddayOf(a.end) - ddayOf(b.end));
  return (
    <div className="panel sched"><div className="panel-t">다가오는 일정</div>
      <ul>
        {deads.map((m, i) => <li key={i}><span className="sd">{m.end[0] + 1}/{m.end[1]}</span><span className="sn">{m.n.replace(/^2026 /, '')} 마감</span><b>D-{ddayOf(m.end)}</b></li>)}
        <li><span className="sd">{mv ? `${mv.month}월` : '미정'}</span><span className="sn">입주 · 날짜는 아직 몰라요</span></li>
        <li><span className="sd">+14일</span><span className="sn">전입신고 · 입주한 날부터</span></li>
      </ul>
    </div>
  );
}
