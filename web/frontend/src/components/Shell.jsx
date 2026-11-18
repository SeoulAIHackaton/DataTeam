/* 앱 틀: 위 막대 · 왼쪽 목차(01~03) · 오른쪽 패널 · 아래 막대 */
import { S, set, go, showToast } from '../store.js';
import { CH, chDone, chSum, val1, POL, PCOL, judge, topRank, hs, monthly, copyFile, all1 } from '../lib/core.js';
import { IcCk, IcLock } from './ui.jsx';

export function Header() {
  const ez = ['내 상황', '받을 수 있는 돈', '어느 집이 맞을까'];
  return (
    <header className="top"><div className="top-in">
      <button className="logo" onClick={() => { set({ home: true }); window.scrollTo(0, 0); }} data-act="홈으로">첫집<b>내비</b></button>
      {S.easy
        ? <ol className="ez-steps" aria-label="단계">{ez.map((n, i) => { const locked = i > 0 && !all1();
            return (
            <li key={n} className={`${S.step === i + 1 ? 'on' : S.step > i + 1 ? 'done' : ''} ${locked ? 'locked' : ''}`}>
              <button onClick={() => locked ? showToast('내 상황을 모두 채우면 넘어갈 수 있어요') : go(i + 1)} aria-current={S.step === i + 1 ? 'step' : undefined} aria-disabled={locked || undefined} data-act="단계 이동">{locked ? '🔒 ' : S.step > i + 1 ? '✓ ' : ''}{n}</button>
            </li>); })}</ol>
        : <span className="top-file">내 첫 집 파일 · {CH[S.step].no} {CH[S.step].t}</span>}
      <button className="toggle" onClick={() => set({ easy: !S.easy })} aria-pressed={!!S.easy} data-act="쉬운 화면 켜기/끄기">쉬운 화면 <span className={`sw ${S.easy ? 'on' : ''}`} /></button>
    </div></header>
  );
}

export function Footer() {
  return (
    <footer className="ft"><div className="ft-in">
      <b>첫집 <span style={{ color: 'var(--pri)' }}>내비</span></b><span>처음 독립하는 서울 청년을 위한 주거 도우미</span>
    </div></footer>
  );
}

export function Rail() {
  return (
    <nav className="rail" aria-label="내 첫 집 파일 목차">
      <div className="rail-t">내 첫 집 파일<small>2026년 11월 21일 기준</small></div>
      <ol>{(() => { const ready = all1(); return [1, 2, 3].map(n => {
        const on = S.step === n, dn = !on && chDone(n), locked = n > 1 && !ready;
        return (
          <li key={n}><button className={`rl ${on ? 'on' : dn ? 'done' : ''} ${locked ? 'locked' : ''}`} aria-current={on ? 'step' : undefined} aria-disabled={locked || undefined}
            onClick={() => locked ? showToast('01 내 조건을 모두 채우면 넘어갈 수 있어요') : go(n)} data-act="장 이동">
            <span className="rl-no">{locked ? <IcLock /> : dn ? <IcCk /> : CH[n].no}</span><span className="rl-tx"><b>{CH[n].t}</b><small>{locked ? '01을 먼저 끝내요' : chSum(n)}</small></span>
          </button></li>
        );
      }); })()}</ol>
      <div className="rail-f">정책 · 온통청년 · 정부24 · 서울시 · SH<br />집 · 카카오 로컬 · ODsay</div>
    </nav>
  );
}

/* ----- 오른쪽 패널 ----- */
export function ProfileMini() {
  const R = [['age', '나이'], ['income', '월 소득'], ['cash', '모아둔 돈'], ['place', '자주 가는 곳'], ['own', '내 집']];
  return (
    <div className="panel">
      <div className="panel-t">내 조건<button className="link" onClick={() => go(1)} data-act="1단계로">고치기</button></div>
      {R.map(([k, l]) => { const v = val1(k); return <div className="kv" key={k}><span>{l}</span><b className={v ? '' : 'nil'}>{v || '—'}</b></div>; })}
    </div>
  );
}

export function AlarmPanel() {
  const al = POL.filter(p => S.alarm.includes(p.id));
  return (
    <div className="panel">
      <div className="panel-t">공고 알림 <span className="cnt">{al.length}</span></div>
      {al.length
        ? <><ul className="tray">{al.map(p => <li key={p.id}><span className="dot" style={{ background: PCOL[p.id].fg }} />{p.name}</li>)}</ul><p className="s">2027년 공고가 나오면 알려드려요.</p></>
        : <p className="s">내년에 신청할 지원의 [공고 알림 받기]를 누르면 여기에 모여요.</p>}
    </div>
  );
}

export function TipsPanel() {
  return (
    <div className="panel soft"><div className="panel-t">이렇게 넣어 보세요</div>
      <p className="s" style={{ lineHeight: 1.9 }}>부동산 앱에서 본 집 주소를 건물 번호까지 검색해요.<br />보증금과 월세는 매물에 적힌 금액을 넣어요.<br />관리비를 모르면 비워 두세요. 0원으로 치지 않아요.<br />2곳 이상이면 비교할 수 있어요 (최대 3곳).</p>
    </div>
  );
}

export function FileSummary() {
  const J = judge(), t = topRank(), H = S.homesDone ? hs() : [];
  return (
    <>
      <div className="panel"><div className="panel-t">파일 요약</div>
        <div className="kv"><span>받을 지원</span><b>{J.total ? `최대 ${J.total.toLocaleString()}만 원` : '없음'}</b></div>
        <div className="kv"><span>먼저 볼 집</span>{t ? <b>{t.key} {t.label}</b> : H.length >= 2 ? <b>관리비 확인 필요</b> : <b className="nil">아직 없음</b>}</div>
        <div className="kv"><span>한 달 확인된 비용</span>{t ? <b>{monthly(t)}만 원</b> : <b className="nil">—</b>}</div>
        <button className="btn-line full" id="file-copy" onClick={copyFile} data-act="파일 복사">파일 전체 복사하기</button>
      </div>
      <ProfileMini />
    </>
  );
}
