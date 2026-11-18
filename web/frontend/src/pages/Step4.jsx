/* 04 할 일 · 앞 장(01~03)에서 나온 것을 체크리스트로 모아요 (새로 계산하지 않아요) */
import { S, set, go } from '../store.js';
import { todoAll, todoFlat, DONE, tdDone, tdOpen, toggleAlarm, moreJ, CH, copyFile } from '../lib/core.js';
import { Html, Tile, ChHead } from '../components/ui.jsx';
import Calendar from '../components/Calendar.jsx';

function tdItem(x) {
  const on = !!DONE()[x.id], op = tdOpen(x), chk = S.chk || (S.chk = {});
  const al = x.alarm && S.alarm.includes(x.alarm);
  return (
    <li className={`td ${on ? 'done' : ''}`} key={x.id}>
      <div className="td-ck"><input type="checkbox" id={`tdc-${x.id}`} checked={on} onChange={e => tdDone(x.id, e.target.checked)} aria-labelledby={`tdt-${x.id}`} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="td-t" id={`tdt-${x.id}`}>{x.t}{x.when ? <span className="td-when">{x.when}</span> : null}</div>
        <div className="td-d">{x.d}</div>
        {x.sub ? <ul className="td-sub">{x.sub.map(it => (
          <li key={it.id}><label><input type="checkbox" defaultChecked={!!chk[it.id]} onChange={e => { (S.chk = S.chk || {})[it.id] = e.target.checked; }} /><span>{it.h ? <Tile h={it.h} c="xs" /> : null}{it.t}</span></label></li>
        ))}</ul> : null}
        {op && x.why ? <div className="td-det"><b>왜 해당되나요?</b> <Html html={x.why} /><div className="np-q">원문 「지원 대상」 "{x.qt}"</div></div> : null}
      </div>
      <div className="td-a">
        {x.go ? <button className="link" onClick={() => go(x.go)} data-act="그 장으로">{x.goT || CH[x.go].no + ' ' + CH[x.go].t + '에서 보기'}</button> : null}
        {x.why ? <button className="link" aria-expanded={op} onClick={() => set({ tdOpen: op ? null : x.id, open: null })} data-act="근거 펼치기">{op ? '근거 닫기' : '근거 보기'}</button> : null}
        {x.alarm ? <button className={`alarm ${al ? 'on' : ''}`} onClick={() => toggleAlarm(x.alarm)} data-act="공고 알림 받기">{al ? '알림 받는 중' : '공고 알림 받기'}</button> : null}
      </div>
    </li>
  );
}

export default function Step4() {
  const G = todoAll(), all = todoFlat(G), left = all.filter(x => !DONE()[x.id]).length, M = moreJ();
  const GT = { before: ['계약 전에', '집을 정하기 전에 해 두면 좋아요'], move: ['이사하면서', '입주하고 14일 안에'], apply: ['지금 신청할 수 있어요', '올해 12월 31일 마감'], next: ['내년에 신청할 지원', '공고가 나오면 알려드려요'] };
  const sec = k => G[k].length ? (
    <section className="td-g" key={k}>
      <h2>{GT[k][0]} <span className="cnt">{G[k].filter(x => !DONE()[x.id]).length} / {G[k].length}</span><span className="s" style={{ fontSize: 13, fontWeight: 500 }}>{GT[k][1]}</span></h2>
      <ol className="td-list">{G[k].map(tdItem)}</ol>
    </section>
  ) : null;
  const groups = ['before', 'move', 'apply', 'next'].map(sec);
  if (S.easy) return (
    <>
      <ChHead n={4} h1={left ? <>할 일이 <em>{left}개</em> 남았어요</> : <>할 일을 <em>모두</em> 끝냈어요</>} lead="하나씩 끝내면 체크해 주세요." />
      {groups}
      <div className="cta"><button className="btn ghost" onClick={() => go(3)}>이전</button></div>
    </>
  );
  return (
    <>
      <ChHead n={4} h1={left ? <>할 일 <em>{left}개</em>가 남았어요</> : <>할 일을 <em>모두</em> 끝냈어요</>}
        lead="01~03에서 나온 신청 마감, 전입신고, 집 보러 가서 확인할 것을 순서대로 모았어요. 체크하면 왼쪽 목차와 파일 요약에 바로 반영돼요." />
      {groups}
      <section className="td-g"><h2>신청 일정 <span className="s" style={{ fontSize: 13, fontWeight: 500 }}>신청 기간을 누르면 그 할 일의 근거가 열려요</span></h2>
        <Calendar M={M} />
        <p className="tl-note">12월 1일에 입주하면 <b>12월 14일까지 전입신고</b>를 꼭 하세요. 서울시 지원은 전입신고를 마친 사람만 신청할 수 있어요.</p></section>
      <div className="cta"><button className="btn ghost" onClick={() => go(3)}>이전</button><button className="btn pri wide" id="file-copy2" onClick={copyFile} data-act="파일 복사">파일 전체 복사하기</button></div>
    </>
  );
}
