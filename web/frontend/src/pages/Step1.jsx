/* 01 내 조건 · 기본 정보 / 예산 / 이사·이동 조건으로 나눠 9개 항목을 골라요.
   쉬운 화면은 질문 2개만 크게 물어봐요. 고르는 즉시 S.prof에 저장되고, 02·03이 그대로 읽어요. */
import { S, set, go, render, focusId } from '../store.js';
import {
  W1, F1K, GROUPS1, NOW_Y, TODAY1, INC_LIMIT, D1, done1, val1, ageSplit, year1, bd1, placeIn, placeList1, pickPlace1, placeChange, placeKey,
  digits1, numStr1, incMode1, monthly1, save1n, mode1, to1, go1, demo1, addList1, add1, clear1, amtW1, vKey1, Y_RANGE1, yearStep1,
  T_RANGE1, fmtMin, tPct1, pick1, CARD1, DEST, won, all1, jobs1, toggleJob1, whenParts1, setWhenPart1, whenUnknown1,
} from '../lib/core.js';
import { Html, Icon, IcCk, ChHead } from '../components/ui.jsx';

/* ----- 쉬운 화면 ----- */
function Easy() {
  const qs = [
    { k: 'own', q: '내 이름으로 된 집이<br>있나요?', h: '집을 산 적이 없으면 "없어요"를 눌러 주세요.', a: ['없어요', '있어요'] },
    { k: 'sep', q: '지금 부모님과<br>주소가 같나요?', h: '주민등록 주소를 말해요. 모르면 "잘 모르겠어요"를 눌러 주세요.', a: ['네, 같아요', '아니요', '잘 모르겠어요'] },
  ];
  if (S.easyQ >= 2) return (
    <>
      <div className="eyebrow">질문 끝</div><h1>고마워요.<br />회원님 상황을 정리했어요</h1>
      <div className="sec">{[['나이', '27살'], ['자주 가는 곳', '멀티캠퍼스 역삼'], ['모아둔 돈', '2,000만 원'], ['한 달 월급', '230만 원'], ['내 집', '없어요']].map(r => (
        <div className="erow" key={r[0]}><div className="t" style={{ fontWeight: 500, color: '#434C48', width: 220 }}>{r[0]}</div><div className="t">{r[1]}</div></div>
      ))}</div>
      <div className="cta"><button className="btn pri wide" onClick={() => go(2)} data-act="다음 단계">받을 수 있는 돈 보기</button></div>
    </>
  );
  const q = qs[S.easyQ];
  return (
    <>
      <div className="eyebrow">질문 2개 중 {S.easyQ + 1}번째</div><Html as="h1" html={q.q} /><div className="lead">{q.h}</div>
      <div className="big-q">{q.a.map((a, i) => (
        <button key={a} className={`btn ${i === 0 ? 'pri' : 'ghost'} wide`} onClick={() => set({ [q.k]: a, easyQ: S.easyQ + 1 })} data-act="답 선택 → 다음 질문">{a}</button>
      ))}</div>
      <p className="s" style={{ textAlign: 'center', marginTop: 28 }}>글로 쓰기 어렵다면 말로 해도 돼요</p>
    </>
  );
}

/* ----- 금액 (보증금 · 한 달 수입) ----- */
function num1(k, raw) { D1()[vKey1(k)] = digits1(raw); save1n(k); render(); }
function Read1({ k }) {
  const v = numStr1(k); if (v === '' || +v < 10000) return null;
  return <>{k === 'income' ? (incMode1() === '연' ? '연 ' : '월 ') : ''}<b>{won(+v)}</b></>;
}
function Note1({ k }) {
  const v = numStr1(k), f = F1K[k];
  if (k === 'cash') return v !== '' && +v > f.range[1] ? <div className="f1over">{won(f.range[1])}까지</div> : null;
  const m = monthly1(); if (m == null) return null;
  if (m > f.range[1]) return <div className="f1over">월 {won(f.range[1])}까지</div>;
  const lim = Math.round(INC_LIMIT);
  return m <= INC_LIMIT ? <div className="f1ok" data-inc="in">✓ 지원 소득 기준({lim}만 원) 안</div> : <div className="f1ok over" data-inc="over">지원 소득 기준({lim}만 원) 넘음</div>;
}
function MoneyBox({ k, unit }) {
  const v = numStr1(k);
  return (
    <div className="f1money">
      <div className="f1amt-row">
        <label className="f1amt"><span className="sr">{F1K[k].panel} (만 원)</span>
          <input id={`f1-${k}-n`} inputMode="numeric" autoComplete="off" placeholder="0" value={v ? (+v).toLocaleString() : ''} style={{ width: amtW1(v) }} onChange={e => num1(k, e.target.value)} />
          <span className="u" id={`f1-${k}-u`}>{unit}</span></label>
        <span className="f1read" id={`f1-${k}-r`}><Read1 k={k} /></span>
      </div>
      <div className="f1add" role="group" aria-label={`${F1K[k].panel} 더하기`}>
        {addList1(k).map(([n, t], j) => <button key={t} id={`f1-${k}-a${j}`} className="addb" onClick={() => add1(k, n, j)} data-act="금액 더하기">{t}</button>)}
        <button id={`f1-${k}-clr`} className="addb clr" onClick={() => clear1(k)} disabled={v === ''} data-act="금액 지우기">지우기</button>
      </div>
    </div>
  );
}
/* 한 달 수입 막대: 지원 소득 기준(기준 중위소득 150%)이 어디쯤인지 */
function Gauge1() {
  const m = monthly1(), top = Math.max(INC_LIMIT * 1.6, (m || 0) * 1.1), pct = x => Math.min(100, x / top * 100);
  return (
    <div className={`f1gauge ${m != null && m > INC_LIMIT ? 'over' : ''}`} id="f1-inc-g" aria-hidden="true">
      <div className="tr"><span className="fill" style={{ width: `${m == null ? 0 : pct(m)}%` }} /><i className="lim" style={{ left: `${pct(INC_LIMIT)}%` }} /></div>
      <div className="lb"><span style={{ left: `${pct(INC_LIMIT)}%` }}>지원 소득 기준 월 {Math.round(INC_LIMIT)}만</span></div>
    </div>
  );
}

/* ----- 출생연도: −/+ 또는 바로 적기 (4자리가 되면 저장) ----- */
function yearIn(raw) {
  const d = D1(), v = String(raw).replace(/[^\d]/g, '').slice(0, 4); d.yv = v; d.yx = '';
  if (v === '') { d.yv = null; if (S.prof.birthYear) year1('', 'f1-year'); else render(); return; }
  if (v.length < 4) { render(); return; }
  if (+v < Y_RANGE1[0] || +v > Y_RANGE1[1]) { d.yx = `${Y_RANGE1[0]}~${Y_RANGE1[1]}년 사이로 넣어 주세요`; render(); return; }
  d.yv = null; year1(+v, 'f1-year');
}
const yearBtn = dlt => { const d = D1(); d.yv = null; d.yx = ''; yearStep1(dlt); };
function timeAny1() { const on = S.prof.time >= 999; S.prof = { ...S.prof, time: on ? 45 : 999 }; render(); focusId('f1-time-any'); }
function TimeTxt() {
  const t = S.prof.time;
  return t == null ? '밀어서 정해 주세요' : t >= 999 ? <b>상관없어요</b> : <>편도 <b>{fmtMin(t)}</b>까지 괜찮아요</>;
}

function Page1() {
  const P = S.prof || {}, d = D1(), ctl = {};
  { const y = P.birthYear, split = y && ageSplit(y);
    ctl.age = (
      <>
        <div className="f1yr">
          <button className="stp" id="f1-year-m" onClick={() => yearBtn(-1)} aria-label="한 해 앞으로" data-act="연도 빼기">−</button>
          <label className="f1yin"><span className="sr">출생연도</span>
            <input id="f1-year" inputMode="numeric" autoComplete="off" maxLength={4} placeholder={String(NOW_Y - 27)} value={d.yv != null ? d.yv : (y || '')} onChange={e => yearIn(e.target.value)} /><span>년생</span></label>
          <button className="stp" id="f1-year-p" onClick={() => yearBtn(1)} aria-label="한 해 뒤로" data-act="연도 더하기">+</button>
          {!y ? <span className="f1hint">−, + 로 고르거나 바로 적어요</span> : split ? null : <span className="agep">만 {P.age}세</span>}
        </div>
        <div className="f1x" id="f1-year-x" role="status">{d.yx || ''}</div>
        {y && split ? (
          <div className="f1line mt"><span className="f1bd" id="f1-bdq">올해 생일 지났어요?</span>
            <span className="chips" role="radiogroup" aria-labelledby="f1-bdq">{[['after', `지났어요 · 만 ${NOW_Y - y}세`], ['before', `아직이에요 · 만 ${NOW_Y - y - 1}세`]].map(([v, t]) => (
              <button key={v} role="radio" aria-checked={P.bday === v} id={`f1-bd-${v}`} className={`chip sm ${P.bday === v ? 'on' : ''}`} onClick={() => bd1(v)} data-act="생일 고르기">{t}</button>
            ))}</span></div>
        ) : null}
      </>
    ); }
  if (done1('place') && !d.pedit) {
    ctl.place = (
      <div className="f1pick"><span className="s1-place-icon"><Icon n="train" /></span><div className="q"><b>{P.place}</b><small>{DEST.addr}</small></div>
        <button id="f1-place-chg" className="link" onClick={placeChange} data-act="장소 바꾸기">변경</button></div>
    );
  } else {
    const L = placeList1(), searching = !!d.pq?.trim(), results = searching ? L : L.slice(0, 4);
    ctl.place = (
      <>
        <label className="sr" htmlFor="f1-pin">통근·통학 기준 장소 검색</label>
        <div className="f1search"><span className="ico sm"><Icon n="building" /></span>
          <input id="f1-pin" type="search" autoComplete="off" placeholder="회사·학교 이름 또는 가까운 역 검색" aria-describedby="s1-place-help" value={d.pq || ''} onChange={e => placeIn(e.target.value)} onKeyDown={e => placeKey(e.nativeEvent)} /></div>
        <div className="s1-results-label" aria-live="polite">{searching ? `검색 결과 ${results.length}곳` : '예시 장소로 선택해도 좋아요'}</div>
        {results.length ? <ul className="s1-results" id="f1-plist" aria-label="장소 검색 결과">
          {results.map((p, j) => (
            <li key={p.name}><button onClick={() => pickPlace1(j)} data-act="장소 고르기">
              <span className="s1-result-icon"><Icon n={p.name.includes('역') ? 'train' : 'building'} /></span>
              <span className="s1-result-text"><b>{p.name}</b><small>{p.live ? p.area || p.query : [...new Set([p.area,p.query].filter(Boolean))].join(' · ')}</small></span>
              <span className="s1-result-pick">선택 <span aria-hidden="true">›</span></span>
            </button></li>
          ))}
        </ul> : <p className="s1-no-results" id="f1-plist">검색 결과가 없어요. 장소 이름이나 가까운 역으로 다시 찾아보세요.</p>}
        <p className="s1-help" id="s1-place-help">회사·학교 등 가장 자주 오가는 곳 한 곳을 골라 주세요.</p>
      </>
    );
  }
  ctl.cash = <><MoneyBox k="cash" unit="만 원" /><div id="f1-cash-x"><Note1 k="cash" /></div></>;
  const md = incMode1(), m = monthly1();
  ctl.income = (
    <>
      <div className="f1tog" role="radiogroup" aria-label="월급 또는 연봉">{[['월', '월급'], ['연', '연봉']].map(([mm, t]) => (
        <button key={mm} role="radio" aria-checked={md === mm} id={`f1-mode-${mm}`} className={md === mm ? 'on' : ''} onClick={() => mode1(mm)} data-act="월급·연봉 전환">{t}</button>
      ))}</div>
      <div className="mt"><MoneyBox k="income" unit={md === '연' ? '만 원 / 년' : '만 원 / 월'} /></div>
      <div className="f1conv" id="f1-inc-v">{md === '연' && m != null ? <>= 월 <b>{won(m)}</b></> : null}</div>
      <Gauge1 /><div id="f1-income-x"><Note1 k="income" /></div>
    </>
  );
  const selectedJobs = jobs1();
  ctl.job = <div className="s1-jobs" role="group" aria-labelledby="f1l-job" aria-describedby="s1-job-help">
    {F1K.job.opts.map(([label, value], j) => <label className={`s1-job ${selectedJobs.includes(value) ? 'selected' : ''}`} key={value}>
      <input id={`f1-job-${j}`} type="checkbox" checked={selectedJobs.includes(value)} onChange={() => toggleJob1(value)} />
      <span>{label}</span>
    </label>)}
    <p className="s1-help" id="s1-job-help">일하면서 학교에 다닌다면 둘 다 선택해 주세요.</p>
  </div>;
  { const t = P.time, v = t == null || t >= 999 ? 45 : t;
    ctl.time = (
      <div className="f1time">
        <div className="f1tv" id="f1-time-v" aria-live="polite"><TimeTxt /></div>
        <label className="sr" htmlFor="f1-time-r">허용 이동 시간 (편도)</label>
        <input type="range" id="f1-time-r" className={`f1rng ${t == null ? 'unset' : t >= 999 ? 'off' : ''}`} min={T_RANGE1[0]} max={T_RANGE1[1]} step="5" value={v}
          style={{ '--p': `${tPct1(v)}%` }} aria-valuetext={t == null ? '정하지 않음' : fmtMin(t)} onChange={e => { S.prof = { ...S.prof, time: +e.target.value }; render(); }} />
        <div className="f1tk" aria-hidden="true">{[10, 30, 45, 60, 90].map(mm => <span key={mm} style={{ left: `${tPct1(mm)}%` }}>{fmtMin(mm)}</span>)}</div>
        <button id="f1-time-any" className={`chip sm f1any ${t >= 999 ? 'on' : ''}`} aria-pressed={t >= 999} onClick={timeAny1} data-act="상관없어요">상관없어요</button>
      </div>
    ); }
  const when = whenParts1(), unknown = P.when === '아직 몰라요';
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter(month => when.year !== String(NOW_Y) || month >= +TODAY1.slice(5, 7));
  ctl.when = <>
    <div className="s1-date">
      <label><span className="sr">입주 연도</span><select id="f1-when-year" value={when.year} disabled={unknown} onChange={e => setWhenPart1('year', e.target.value)}>
        <option value="">연도 선택</option>{[NOW_Y, NOW_Y + 1, NOW_Y + 2, NOW_Y + 3].map(year => <option key={year} value={year}>{year}년</option>)}
      </select></label>
      <label><span className="sr">입주 월</span><select id="f1-when-month" value={when.month} disabled={unknown || !when.year} onChange={e => setWhenPart1('month', e.target.value)}>
        <option value="">월 선택</option>{months.map(month => <option key={month} value={month}>{month}월</option>)}
      </select></label>
      <label className="s1-unknown"><input type="checkbox" checked={unknown} onChange={e => whenUnknown1(e.target.checked)} />아직 미정</label>
    </div>
    <p className="s1-help">정확한 날짜는 나중에 정해도 괜찮아요.</p>
  </>;
  const cards = (k, cur) => (
    <div className="ocards" role="radiogroup" aria-labelledby={`f1l-${k}`}>{CARD1[k].map(([t, v, s], j) => {
      const on = cur === v;
      return <button key={v} role="radio" aria-checked={on} id={`f1-${k}-${j}`} className={`ocard ${on ? 'on' : ''}`} onClick={() => pick1(k, v, `f1-${k}-${j}`)} data-act="고르기">
        <span className="ck" aria-hidden="true">{on ? <IcCk /> : null}</span><b>{t}</b><small>{s}</small></button>;
    })}</div>
  );
  ctl.own = cards('own', S.own); ctl.sep = cards('sep', S.sep);
  return (
    <div className="s1">
      <ChHead n={1} h1="어떤 집을 찾고 있나요?" lead="내 상황과 예산을 알려 주세요. 받을 지원과 나에게 맞는 집을 함께 찾아드릴게요."
        right={<button className="f1ex" onClick={demo1} data-act="예시로 채우기">예시로 채우기</button>} />
      {GROUPS1.map((group, i) => <section className="s1-group" aria-labelledby={`s1-${group.id}`} key={group.id}>
        <div className="s1-group-head"><span className="s1-group-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <div><h2 id={`s1-${group.id}`}>{group.title}</h2><p>{group.desc}</p></div>
          <span className="s1-group-count">{group.fields.filter(done1).length} / {group.fields.length}</span>
        </div>
        <div className="f1card">{group.fields.map(k => { const f = F1K[k]; return (
          <div className={`f1 s1-field-${k}`} id={`f1-${k}`} role="group" aria-labelledby={`f1l-${k}`} key={k}>
            <div className="lab"><b id={`f1l-${k}`}>{f.panel}</b>{f.h ? <small>{f.h}</small> : null}</div>
            <div className="ctl">{ctl[k]}</div>
          </div>
        ); })}</div>
      </section>)}
    </div>
  );
}

export default function Step1() { return S.easy ? <Easy /> : <Page1 />; }

/* 오른쪽: 내 조건 패널(누르면 그 항목으로) · 세대 분리 한 줄 · [받을 수 있는 지원 보기] */
export function Side1() {
  const n = W1.filter(f => done1(f.k)).length, ok = n === W1.length, next = W1.find(f => !done1(f.k));
  return (
    <div id="p1side">
      <div className="panel f1panel s1-panel">
        <div className="panel-t">내 조건<span className="f1cnt">{n} / {W1.length}</span></div>
        <div className="prog" role="progressbar" aria-label="내 조건 입력 진행" aria-valuemin={0} aria-valuemax={W1.length} aria-valuenow={n}><span style={{ width: `${n / W1.length * 100}%` }} /></div>
        {GROUPS1.map(group => <div className="s1-summary-group" key={group.id}><h3>{group.title}</h3>{group.fields.map(k => { const f = F1K[k], v = val1(k); return (
          <button key={k} className="kv f1kv" onClick={() => to1(k)} data-act="그 항목으로"><span>{f.label}</span><b className={v ? '' : 'nil'}>{v || '입력 전'}</b></button>
        ); })}</div>)}
      </div>
      {S.sep === '네' ? <div className="f1note">세대 분리 후 전입신고가 필요할 수 있어요</div> : null}
      <button id="f1go" className={`btn pri wide ${ok ? '' : 'off'}`} aria-disabled={!ok} onClick={go1} data-act="다음 단계">받을 수 있는 지원 보기</button>
      <p className="s1-next" aria-live="polite">{ok ? '준비됐어요. 내 조건에 맞는 지원을 확인해 보세요.' : `${next.panel}부터 이어서 입력해 주세요.`}</p>
    </div>
  );
}

/* 1단계가 덜 끝난 채 2·3단계로 가면 예시 값 배너 (me()가 빈 값을 예시 값으로 채우니까) */
export function Banner1() {
  if (S.step === 1 || S.easy || all1()) return null;
  return (
    <div className="sec" data-banner="step1"><div className="note warn"><span className="ic">!</span>
      <div>아직 안 채운 항목은 예시 값으로 보고 있어요 · <button className="link" onClick={() => go(1)} data-act="1단계로">1단계로</button></div></div></div>
  );
}
