/* 03 집 고르기 · 후보 집 넣기 → 같은 기준으로 비교(표 · 순위 · 물어보기) → 동네 지도
   계산(scores · reasons · houseSupport · tmpl3 …)은 lib/core.js 그대로예요. 관리비를 모르면 '확인 필요'로 두고 순위와 '가장 싸다'에서 빼요. */
import { Fragment } from 'react';
import { S, set, go } from '../store.js';
import {
  HOMES, FAC, LIFE, SCENES, PRIO, DAYS, MAX_HOMES, ADDR_RESULTS, ADDR_Q, DEST, val, fareMonth, feeOf, feeKnown, monthly, cheapest, r1,
  scores, reasons, weakness, nextSlot, addHome, homeVis, kakaoOn, liveSearch, livePick, addLive, hs, houseSupport, me, walkPre, shortRoute,
  jump, openEdit, saveEdit, cmpChecks, copyChecks, nm3, ja3, askCmp, API_OK,
} from '../lib/core.js';
import { Html, Icon, Tile, BBest, BUnk, ChHead, IcCk, IcX, IcDash, IcPen, IcSwap, IcDown } from '../components/ui.jsx';
import { MapBox, NeighMap, MiniMap } from '../components/Maps.jsx';

const enterKey = (e, f) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) f(e.currentTarget.value); };

/* ----- 후보 집 넣기 ----- */
function Input() {
  const slot = nextSlot(), n = S.homes.length, searching = (n < 2 || S.adding) && n < MAX_HOMES;
  const slots = [0, 1, 2].map(i => {
    const h = HOMES[i], has = S.homes.includes(i);
    if (has) return <div className="slot full" key={i}><span className="pin" style={{ background: h.color }}>{h.key}</span><div><div className="name">{h.label}</div><div className="meta">보증금 {val(h, 'deposit').toLocaleString()} / 월세 {val(h, 'rent')} · {h.station}</div></div><button className="link right" onClick={() => set({ homes: S.homes.filter(x => x !== i) })} data-act="집 빼기">빼기</button></div>;
    if (i === slot && searching) return <div className="slot now" key={i}><span className="pin empty">{h.key}</span><div><div className="name" style={{ color: 'var(--sub)' }}>집 {h.key}</div><div className="meta">지금 넣는 중</div></div></div>;
    if (i === slot && n >= 2) return <button className="slot add" key={i} onClick={() => set({ adding: true })} data-act="후보 하나 더 넣기"><span className="pin empty">+</span><div><div className="name" style={{ color: 'var(--pri)' }}>하나 더 넣기</div><div className="meta">최대 3곳까지</div></div></button>;
    return <div className="slot" key={i}><span className="pin empty">{h.key}</span><div><div className="name" style={{ color: 'var(--sub)' }}>집 {h.key}</div><div className="meta">{i === 2 ? '선택 · 최대 3곳' : '비어 있어요'}</div></div></div>;
  });
  let body = null;
  const parsed = S.parsed !== null && S.parsed !== undefined;
  if (S.liveBusy === 'pick') {
    body = <div className="sec"><div className="note"><div>주변 역·마트·약국 등 8곳과 {DEST.name}까지 오가는 시간을 찾고 있어요…</div></div></div>;
  } else if (S.cand || parsed) {
    const h = S.cand || HOMES[S.parsed], live = !!S.cand;
    body = (
      <div className="sec" key={h.addr}>
        <div className="sec-t"><span className="ico sm"><Icon n="building" /></span>집 {h.key} <small>{h.addr}</small></div>
        <div className="prof" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: '16px 24px' }}>
          <div>가까운 역<b>{h.station}</b></div>
          <div>{DEST.name}까지<b>{h.route === '걸어서' ? '걸어서 ' : ''}{h.commute}분{h.route === '걸어서' ? '' : ' · ' + h.route}</b></div>
          <div>한 달 교통비<b>{fareMonth(h) ? '약 ' + fareMonth(h) + '만 원' : '0원 (걸어서)'}</b></div>
        </div>
        {live ? <div className="prof" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: '10px 18px', marginTop: 14 }}>{FAC.map(f => <div key={f.k}>{f.label}<b style={{ fontSize: 14 }}>{h.life[f.k][0]} {h.life[f.k][1]}분</b></div>)}</div> : null}
        <div className="s" style={{ marginTop: 8 }}>역·주변 시설은 카카오 장소 검색{h.est ? <>, 오가는 시간·요금은 <b>직선거리로 추정</b>했어요 (ODsay 웹 키를 넣으면 실제 길찾기로 바뀌어요)</> : ', 오가는 시간·요금은 ODsay 대중교통 길찾기'}로 자동으로 채웠어요. 교통비 = 편도 요금 × 2 × {DAYS}일.</div>
        <div className="sec-t" style={{ marginTop: 28 }}>계약 조건 <small>매물에 적힌 금액을 넣어 주세요 · 바꾸면 추천도 바뀌어요</small></div>
        <div className="fields">
          <label>보증금<span className="inp"><input id="in-dep" type="number" defaultValue={h.deposit} />만 원</span></label>
          <label>월세<span className="inp"><input id="in-rent" type="number" defaultValue={h.rent} />만 원</span></label>
          <label>관리비<span className="inp"><input id="in-fee" type="number" placeholder="모르면 비워 두기" defaultValue={h.fee ?? ''} />만 원</span></label>
        </div>
        <div className="row" style={{ border: 0, padding: '20px 0 0', gap: 10 }}>
          <button className="btn pri" onClick={() => live ? addLive() : addHome(S.parsed)} data-act="집 추가 → 다음 칸">집 {h.key}로 추가</button>
          <button className="btn ghost" onClick={() => set({ parsed: null, cand: null })} data-act="다시 검색">다시 검색</button>
        </div>
      </div>
    );
  } else if (searching) {
    const search = () => kakaoOn() ? liveSearch() : set({ addrQ: S.addrQ || ADDR_Q[slot] });
    let res;
    if (kakaoOn()) {
      res = S.liveBusy === 'search' ? <p className="s" style={{ marginTop: 12 }}>카카오에서 주소를 찾는 중…</p>
        : S.live ? (S.live.length ? (
          <div className="list" style={{ marginTop: 12 }}>{S.live.map((r, k) => (
            <button key={k} className="row" {...(r.ok ? { onClick: () => livePick(k) } : { style: { opacity: .55, cursor: 'default' } })} data-act="결과 선택 → 주변 시설·시간 계산">
              <span className="ico gray"><Icon n="building" /></span><div><div className="name">{r.name}</div><div className="meta">{r.sub}</div></div>
              {r.ok ? <span className="chev right">›</span> : <span className="pill warn right">건물 번호 필요</span>}</button>
          ))}</div>
        ) : <p className="s" style={{ marginTop: 12 }}>검색 결과가 없어요. 동 이름과 번지까지 넣어 보세요 (예: {ADDR_Q[slot]})</p>)
        : <p className="s" style={{ marginTop: 12 }}>예: {ADDR_Q[slot]} · 실제 주소를 카카오에서 찾아요</p>;
    } else {
      res = S.addrQ ? (
        <div className="list" style={{ marginTop: 12 }}>{ADDR_RESULTS[slot].map((r, k) => (
          <button key={k} className="row" {...(r[2] !== null ? { onClick: () => set({ parsed: r[2] }) } : { style: { opacity: .55, cursor: 'default' } })} data-act="결과 선택 → 집 정보 확인">
            <span className="ico gray"><Icon n="building" /></span><div><div className="name">{r[0]}</div><div className="meta">{r[1]}</div></div>
            {r[2] !== null ? <span className="chev right">›</span> : <span className="pill warn right">건물 번호 필요</span>}</button>
        ))}</div>
      ) : <p className="s" style={{ marginTop: 12 }}>예: {ADDR_Q[slot]} · 검색 버튼만 눌러도 예시 주소로 찾아요</p>;
    }
    body = (
      <div className="sec">
        <div className="compose" style={{ marginTop: 0 }}><span className="ico sm gray"><Icon n="home" /></span>
          <input key={slot} defaultValue={S.addrQ || ''} placeholder={`집 ${HOMES[slot].key} · 도로명 또는 지번 주소 (건물 번호까지)`} onInput={e => { S.addrQ = e.currentTarget.value; }}
            onKeyUp={e => enterKey(e, v => { S.addrQ = v; kakaoOn() ? liveSearch() : set({}); })} />
          <button className="send" onClick={search} data-act="주소 검색 → 결과 목록">⌕</button></div>
        {res}
        {S.adding ? <button className="link" style={{ marginTop: 12 }} onClick={() => set({ adding: false, addrQ: '' })}>취소</button> : null}
      </div>
    );
  }
  const ready = n >= 2 && !searching && !parsed && !S.cand;
  return (
    <>
      <ChHead n={3} h1="비교할 후보 집을 넣어 주세요" lead={<>부동산 앱에서 본 집 주소를 검색해 주세요. 자주 가는 곳(<b>{DEST.name}</b>)까지 시간과 주변 시설은 자동으로 계산해요. 2곳 이상이면 비교할 수 있고, 최대 3곳까지 넣을 수 있어요.</>} />
      {!kakaoOn() && DEST.name !== '멀티캠퍼스 역삼' ? <div className="sec"><div className="note warn"><span className="ic">!</span><div>카카오 키가 없어서 예시 집(성수·역삼·신림)은 <b>멀티캠퍼스 역삼</b> 기준 시간으로 보여줘요. 키를 넣으면 <b>{DEST.name}</b> 기준으로 다시 계산해요.</div></div></div> : null}
      <div className="sec"><MapBox vis={homeVis()} /></div>
      <div className="slots">{slots}</div>
      {body}
      {ready ? <>
        <div className="sec"><div className="note"><div>후보 {n}곳이 준비됐어요. 생활 편의, 한 달 비용, 오가는 시간을 한 번에 비교해 볼게요.</div></div></div>
        <div className="cta"><button className="btn pri wide" onClick={() => set({ homesDone: true })} data-act="비교 시작">{n}곳 비교하기</button></div>
      </> : null}
    </>
  );
}

/* ----- 비교 화면 ----- */
function CmpSummary({ H }) {
  const K = H.filter(feeKnown), unk = H.length - K.length, out = [];
  const A = (id, children) => <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); jump(id); }}>{children}<IcDown /></a>;
  if (K.length >= 2) {
    const s = K.slice().sort((x, y) => monthly(x) - monthly(y)), d = r1(monthly(s[1]) - monthly(s[0]));
    if (d > 0) out.push(A('row-total', K.length === 2
      ? <>{unk ? `관리비까지 확인된 ${K.map(h => h.key).join('·')} 중 ` : ''}<b>{s[0].key}가 한 달 {d}만 원 적어요</b></>
      : <><b>{s[0].key}가 한 달 비용이 가장 적어요</b>{' '}· 다음인 {s[1].key}보다 {d}만 원</>));
  } else if (unk) out.push(A('row-fee', <><b>관리비를 알아야</b>{' '}한 달 비용을 비교할 수 있어요</>));
  const f = H.slice().sort((x, y) => x.commute - y.commute);
  if (f.length > 1 && f[0].commute < f[1].commute) out.push(A('row-commute', <>출퇴근은{' '}<b>{f[0].key}가 {walkPre(f[0])}{f[0].commute}분</b>으로 가장 짧아요</>));
  return out.length ? <div className="cmp-sum"><h2>차이 요약</h2>{out}</div> : null;
}

function LifeCell({ h, ks }) {
  const b = ks.map(k => LIFE[h.key][k]).reduce((a, c) => a[1] <= c[1] ? a : c);
  if (/없음/.test(b[0])) return <td><span className="v">–</span><span className="s2">2km 안에 없어요</span></td>;
  return <td><span className="v">{b[1]}분</span><span className="s2">{b[0]}{b[1] >= 15 ? ' · 조금 멀어요' : ''}</span></td>;
}

function Sup({ x }) {
  if (x.dup) return <td><span className="st no"><IcDash />같이 못 받아요</span><span className="s2">국토부 청년월세와 중복</span></td>;
  return x.ok ? <td><span className="st ok"><IcCk />조건 맞음</span><span className="s2">{x.t}</span></td>
    : <td><span className="st no"><IcX />조건 안 맞음</span><span className="s2">{x.t}</span></td>;
}

function CmpTable({ H, topKey }) {
  const m = me(), cash = m.cash, K = H.filter(feeKnown), cheap = K.length >= 2 ? cheapest(H) : null;
  const fastT = Math.min(...H.map(h => h.commute)), fastN = H.filter(h => h.commute === fastT).length;
  const S3 = Object.fromEntries(H.map(h => [h.key, houseSupport(h)]));
  const wish = S.prof && S.prof.time && S.prof.time < 999 ? S.prof.time : null;
  const cell = f => f;
  const G = ({ t, sub, extra }) => <tr><th scope="rowgroup" colSpan={H.length + 1} className="g">{extra || null}{t}{sub ? <> <span>· {sub}</span></> : null}</th></tr>;
  const Row = ({ label, sub, f, cls, id }) => <tr className={cls || undefined} id={id}><th scope="row">{label}{sub ? <small className="s2">{sub}</small> : null}</th>{H.map(h => <Fragment key={h.key}>{f(h)}</Fragment>)}</tr>;
  return (
    <div className="tblwrap"><table>
      <caption className="sr">후보 집 {H.length}곳 비교표</caption>
      <colgroup><col style={{ width: 168 }} />{H.map(h => <col key={h.key} />)}</colgroup>
      <thead><tr><th scope="col" className="k">항목</th>{H.map(h => (
        <th scope="col" key={h.key}><div className="hd"><Tile h={h} /><span className="hn2"><b>{h.label.replace(/ 원룸$/, '')}</b><small>{/ 원룸$/.test(h.label) ? '원룸' : ''}</small></span>
          <button className="pen" onClick={() => openEdit(h.key)} aria-label={`${h.key} ${h.label} 값 고치기`} title="값 고치기" data-act="값 고치기"><IcPen /></button></div></th>
      ))}</tr></thead>
      <tbody>
        {G({ t: "매달 드는 돈" })}
        {Row({ label: "월세", f: cell(h => <td><span className="v">{val(h, 'rent')}만 원</span></td>) })}
        {Row({ label: "관리비", cls: "pre", id: "row-fee", f: cell(h => feeKnown(h) ? <td><span className="v">{feeOf(h)}만 원</span></td>
          : <td><BUnk>확인 필요</BUnk><span className="s2 ok2"><IcCk />확인할 것에 담았어요</span><button className="link" onClick={() => openEdit(h.key, 'ed-fee')} data-act="관리비 넣기">관리비 알면 넣기</button></td>) })}
        {Row({ label: "한 달 확인된 비용", sub: <>월세 + 확인된 관리비<br />공과금 별도</>, cls: "sum", id: "row-total", f: cell(h => (
          <td><span className="big">{monthly(h)}<small>만 원{feeKnown(h) ? '' : ' +'}</small></span>
            {!feeKnown(h) ? <BUnk>관리비 확인 필요</BUnk> : h === cheap ? <BBest>{K.length < H.length ? '확인된 것 중 가장 적어요' : '가장 적어요'}</BBest> : null}</td>)) })}
      </tbody>
      <tbody>
        {G({ t: "처음 드는 돈" })}
        {Row({ label: "보증금", sub: `모아둔 돈 ${cash.toLocaleString()}만 원과 비교`, f: cell(h => { const d = val(h, 'deposit');
          return <td><span className="v">{d.toLocaleString()}만 원</span>{d > cash ? <span className="bdg unk">{(d - cash).toLocaleString()}만 원 부족</span> : <span className="s2">{(cash - d).toLocaleString()}만 원 남아요</span>}</td>; }) })}
      </tbody>
      <tbody>
        {G({ t: "오가는 시간", sub: `${DEST.name}까지` })}
        {Row({ label: "출퇴근 (편도)", id: "row-commute", f: cell(h => (
          <td><span className="v">{h.commute}분</span><span className="s2">{h.route}</span>{h.commute === fastT && fastN === 1 ? <BBest>가장 짧아요</BBest> : null}
            {wish && h.commute > wish ? <span className="bdg unk">{wish}분 넘음</span> : null}</td>)) })}
        {Row({ label: "교통비 (한 달)", sub: "참고 · 합계에 넣지 않아요", f: cell(h => <td><span className="v">{fareMonth(h) ? '약 ' + fareMonth(h) + '만 원' : '0원'}</span>{fareMonth(h) ? null : <span className="s2">걸어서</span>}</td>) })}
      </tbody>
      <tbody>
        {G({ t: "동네 생활", sub: "가장 가까운 곳까지 걸어서", extra: <button className="link gl" onClick={() => set({ detail: { home: topKey, scene: 'shop' } })} data-act="동네 생활 지도 열기">동네 지도로 보기 ›</button> })}
        {Row({ label: "지하철역", f: cell(h => <LifeCell h={h} ks={['station']} />) })}
        {Row({ label: "장보기", sub: "마트·슈퍼", f: cell(h => <LifeCell h={h} ks={['mart', 'super']} />) })}
        {Row({ label: "병원", sub: "내과", f: cell(h => <LifeCell h={h} ks={['clinic']} />) })}
        {Row({ label: "공원", f: cell(h => <LifeCell h={h} ks={['park']} />) })}
      </tbody>
      <tbody>
        {G({ t: "이 집에서 받을 수 있는 지원" })}
        <tr><td colSpan={H.length + 1} className="note2">내 조건(만 {m.age}세 · 월 소득 {m.inc}만 원 · {m.own ? '집 있음' : '무주택'})과 이 집의 보증금·월세로 코드가 대조했어요. 소득·재산은 신청할 때 서류로 확인해요.</td></tr>
        {Row({ label: "국토부 청년월세", f: cell(h => <Sup x={S3[h.key].molit} />) })}
        {Row({ label: "서울시 청년월세", f: cell(h => <Sup x={S3[h.key].seoul} />) })}
        {Row({ label: "중개보수·이사비", f: cell(h => <Sup x={S3[h.key].move} />) })}
        {Row({ label: <>지원 확정 시<span className="tagass">가정</span></>, sub: "월세 지원을 받는 동안", cls: "ass", f: cell(h => { const s = S3[h.key], a = r1(monthly(h) - s.monthSup);
          return <td><span className="v">월 {a}만 원{feeKnown(h) ? '' : ' +'}</span><span className="s2">{s.monthSup ? `${monthly(h)}만 원 − ${s.monthSup}만 원 · ${s.molit.ok ? 24 : 12}개월` : '지원 없음'}{feeKnown(h) ? '' : ' · 관리비 별도'}</span></td>; }) })}
      </tbody>
    </table></div>
  );
}

function CmpEdit() {
  const h = hs().find(x => x.key === S.editKey); if (!h) return null;
  return (
    <div className="cmp-edit" id="cmp-edit" key={h.key}>
      <div className="cmp-edit-t"><Tile h={h} c="sm" /><b>{h.label} 값 고치기</b><span className="s">매물에 적힌 금액을 넣어 주세요 · 관리비를 모르면 비워 두세요</span></div>
      <div className="fields">
        <label>보증금<span className="inp"><input id="ed-dep" type="number" defaultValue={val(h, 'deposit')} />만 원</span></label>
        <label>월세<span className="inp"><input id="ed-rent" type="number" defaultValue={val(h, 'rent')} />만 원</span></label>
        <label>관리비<span className="inp"><input id="ed-fee" type="number" placeholder="모르면 비워 두기" defaultValue={feeOf(h) ?? ''} />만 원</span></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn pri" style={{ height: 44 }} onClick={() => saveEdit(h.key)} data-act="값 저장 → 다시 계산">저장하고 다시 계산</button>
        <button className="btn ghost" style={{ height: 44 }} onClick={() => set({ editKey: null })}>취소</button>
      </div>
    </div>
  );
}

function PrioChips() {
  return <div className="chips">{Object.entries(PRIO).map(([k, p]) => (
    <button key={k} className={`chip ${S.prio === k ? 'on' : ''}`} onClick={() => set({ prio: k, cmpQ: [] })} data-act="우선순위 바꾸기 → 종합 점수 다시 계산">{p.name}</button>
  ))}</div>;
}

function CmpRank({ H, rank }) {
  const w = PRIO[S.prio].w, K = rank.filter(r => !r.unk), U = rank.filter(r => r.unk);
  const cheap = K.length >= 2 ? cheapest(H) : null, fast = H.slice().sort((a, b) => a.commute - b.commute)[0];
  const minK = K.length ? Math.min(...K.map(r => monthly(r.h))) : Infinity;
  const why = h => {
    const a = [];
    if (cheap) { const d = r1(monthly(h) - monthly(cheap)); a.push(h === cheap ? '한 달 비용이 확인된 집 중 가장 적어요.' : d > 0 ? `${cheap.key}보다 한 달 ${d}만 원 더 들어요.` : `한 달 비용은 ${cheap.key}와 같아요.`); }
    const t = h.commute - fast.commute;
    a.push(h === fast ? `출퇴근이 ${walkPre(h)}${h.commute}분으로 가장 짧아요.` : t > 0 ? `출퇴근은 ${fast.key}보다 ${t}분 길어요.` : `출퇴근 시간은 ${fast.key}와 같아요.`);
    return a.join(' ');
  };
  const rs = K.length ? reasons(rank) : [], wk = K.length ? weakness(K[0].h) : '';
  return (
    <section className="cmp-rank" aria-labelledby="rank-t">
      <div className="cmp-rank-h"><div><h2 id="rank-t">무엇을 먼저 볼지 고르면 순서를 정리해요</h2><p className="s">{PRIO[S.prio].name} 기준 · 비용 {Math.round(w.cost * 100)}% · 시간 {Math.round(w.time * 100)}% · 동네 {Math.round(w.life * 100)}%</p></div><PrioChips /></div>
      <ol className="rk2">
        {K.map((r, i) => <li key={r.h.key}><span className="no">{i + 1}위</span><span className="nm"><Tile h={r.h} c="xs" />{r.h.label}</span><span className="bar" aria-hidden="true"><span style={{ width: `${r.total}%`, background: r.h.color }} /></span><span className="t">{r.total}점</span><span className="d">{why(r.h)}</span></li>)}
        {U.map(r => <li className="unk" key={r.h.key}><span className="no">–</span><span className="nm"><Tile h={r.h} c="xs" />{r.h.label}</span><span className="u"><BUnk>관리비 확인 필요</BUnk></span><span className="d">관리비를 알면 순위에 넣어요.{monthly(r.h) < minK ? ' 월세만 보면 가장 싸지만, 관리비를 더하면 달라질 수 있어요.' : ''}</span></li>)}
      </ol>
      {K.length ? (
        <details className="rk-more"><summary>이렇게 정리했어요</summary>
          <ul className="why-list">{rs.map((t, i) => <Html as="li" key={i} html={t} />)}</ul>
          {wk ? <p className="s" style={{ marginTop: 8 }}>아쉬운 점 · {K[0].h.label}은 {wk}</p> : null}
          <p className="s" style={{ marginTop: 8, lineHeight: 1.8 }}>점수 계산: 비용은 관리비까지 확인된 집 중 가장 싼 집 100점, 월 10만 원 비쌀 때마다 −15점 · 시간은 15분 이하 100점, 그 뒤 1분마다 −2점 · 동네는 시설마다 걸어서 5분 이하 100점, 20분 이상 0점 → 8곳 평균. 점수와 숫자는 코드가 계산하고, AI는 이 근거로만 설명해요.</p>
        </details>
      ) : null}
    </section>
  );
}

/* ----- 이 비교에 대해 물어보기 (AI · 계산된 비교 결과로만) ----- */
function CmpCard({ it }) {
  const b = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/(\d[\d,.]*\s*(?:만 원|분|점|시간|곳|위))/g, '<b>$1</b>');
  if (it.load) return <div className="cmp3-card"><span className="cmp3-q">{it.q}</span><div className="cmp3-a" style={{ color: 'var(--sub)' }}>비교 결과를 읽는 중…</div></div>;
  const gray = it.mode === 'out' || it.mode === 'step2' || it.mode === 'miss';
  const why = it.mode === 'code' ? (it.why === 'number' ? ' · AI 답에 없는 숫자가 있어서 계산 결과 문장으로 바꿨어요' : it.why === 'conclusion' ? ' · AI 답이 추천과 달라서 계산 결과 문장으로 바꿨어요' : ' · AI 꺼짐 · 계산 결과 문장') : it.mode === 'AI' ? ' · AI 답변 (숫자·결론 검사 통과)' : '';
  return (
    <div className={`cmp3-card ${gray ? 'gray' : ''}`}><span className="cmp3-q">{it.q}</span><Html as="div" className="cmp3-a" html={b(it.a)} />
      {it.mode === 'step2' ? <button className="link" style={{ marginTop: 6 }} onClick={() => go(2)} data-act="2단계 공고문에 물어보기로">2단계 [공고문에 물어보기] ›</button> : null}
      <div className="cmp3-f">이 답은 위 비교 결과로만 만들었어요{why}</div></div>
  );
}
function CmpSec({ rank }) {
  if (S.easy || !rank.length) return null;
  const top = rank[0].h, sec = rank[1] && rank[1].h, n = nm3;
  const ex = [`왜 ${ja3(n(top), '이야', '야')}?`];
  if (sec) ex.push(`${ja3(n(sec), '이랑', '랑')} ${n(top)} 차이는?`);
  ex.push('가장 가까운 집은?');
  const off = API_OK === false || S.cmpAiOff || !location.protocol.startsWith('http');
  return (
    <div className="sec cmp3" id="cmp3">
      <div className="cmp3-box">
        <div className="cmp3-h">이 비교에 대해 물어보기 <span className="pill">AI</span>{off ? <small>AI 꺼짐 · 계산 결과 문장으로 답해요</small> : null}</div>
        <p className="s" style={{ marginTop: 4 }}>계산된 비교 결과(실부담·출퇴근·생활·지원·점수)로만 답해요. 검색하지 않고, 추천을 바꾸지 않아요.</p>
        <div className="cmp3-ex">{ex.map(q => <button key={q} onClick={() => askCmp(q)} data-act="예시 질문 → 답 카드">{q}</button>)}</div>
        <div className="cmp3-in"><input id="cmp3q" placeholder="궁금한 걸 물어보세요" onKeyUp={e => enterKey(e, askCmp)} />
          <button onClick={() => askCmp(document.getElementById('cmp3q').value)} data-act="묻기 → 답 카드">묻기</button></div>
      </div>
      {(S.cmpQ || []).map((it, i) => <CmpCard key={i} it={it} />)}
    </div>
  );
}

function CmpPage({ H, rank }) {
  const m = me(), top = rank[0].h, ex = H.some(h => !h.live);
  return (
    <>
      <ChHead n={3} h1={<>후보 집 {H.length}곳을 같은 기준으로 비교해요{ex ? <span className="cmp-tag">예시 집</span> : null}</>}
        lead={<>{DEST.name} 기준 · 만 {m.age}세 · 모아둔 돈 {m.cash.toLocaleString()}만 원 · 월 소득 {m.inc}만 원<button className="link" onClick={() => go(1)} data-act="01로">조건 고치기</button></>}
        right={<button className="btn-line" onClick={() => set({ homesDone: false, editKey: null })} data-act="집 바꾸기"><IcSwap />집 바꾸기</button>} />
      {S.editKey ? <CmpEdit /> : null}
      <section className="cmp-card cmp" aria-label="후보 집 비교">
        <CmpSummary H={H} />
        <CmpTable H={H} topKey={top.key} />
      </section>
      <CmpRank H={H} rank={rank} />
      <CmpSec rank={rank} />
      <p className="cmp-src">주변 시설 거리 · 카카오 로컬 · 오가는 시간과 요금 · ODsay{ex ? ' · 예시 집의 보증금·월세·관리비는 화면 설명용 값이에요' : ''}</p>
      <div className="cta"><button className="btn ghost" onClick={() => go(2)}>이전</button><button className="btn pri wide" onClick={() => go(4)} data-act="다음 장">할 일 정리하기</button></div>
    </>
  );
}

/* ----- 쉬운 화면 ----- */
function Easy({ H, top }) {
  const t = top.h, cheap = H.filter(feeKnown).length >= 2 ? cheapest(H) : null, wk = weakness(t);
  if (top.unk) return (
    <>
      <div className="eyebrow">3단계</div><h1>관리비를 알면<br />어느 집이 맞을지 알려드려요</h1>
      <div className="lead">넣은 집 모두 관리비를 몰라서 한 달에 드는 돈을 비교할 수 없어요. 집주인이나 중개사에게 관리비를 물어보세요.</div>
      <div className="cta"><button className="btn pri wide" onClick={() => set({ easy: false })} data-act="일반 화면으로 자세히">자세히 보기</button></div>
    </>
  );
  return (
    <>
      <div className="eyebrow">3단계</div><h1>회원님에게는<br /><span style={{ color: 'var(--pri)' }}>{t.key} 집</span>을 추천해요</h1>
      <div className="lead">돈, 오가는 시간, 동네 생활을 모두 따져 봤어요.</div>
      <div className="sec"><MapBox /></div>
      <div className="sec" style={{ marginTop: 12 }}>
        <div className="erow"><span className="ico lg"><Icon n="receipt" /></span><div><div className="t">{t === cheap ? (H.some(h => !feeKnown(h)) ? '관리비를 아는 집 중 한 달 비용이 가장 적어요' : '한 달에 드는 돈이 가장 적어요') : `한 달에 ${monthly(t)}만 원이 들어요`}</div><div className="d">월세와 관리비를 합쳐 한 달 {monthly(t)}만 원이에요.</div></div></div>
        <div className="erow"><span className="ico lg"><Icon n="train" /></span><div><div className="t">{DEST.name}까지 {t.commute}분이에요</div><div className="d">{t.route === '걸어서' ? '걸어서 갈 수 있어요.' : '지하철 ' + t.route.split(' · ')[0] + ' 한 번이면 가요.'}</div></div></div>
        {wk ? <div className="erow"><span className="ico lg warn"><Icon n="cart" /></span><div><div className="t">조금 먼 곳도 있어요</div><div className="d">{wk}</div></div></div> : null}
        {H.filter(h => !feeKnown(h)).map(h => <div className="erow" key={h.key}><span className="ico lg warn"><Icon n="receipt" /></span><div><div className="t">{h.key} 집은 관리비를 몰라서 빼고 골랐어요</div><div className="d">관리비를 알면 넣어 주세요. 다시 비교해 드려요.</div></div></div>)}
      </div>
      <div className="cta"><button className="btn pri wide" onClick={() => set({ easy: false })} data-act="일반 화면으로 자세히">자세히 비교하기</button></div>
    </>
  );
}

/* ----- 동네 지도 (집 주변 시설) ----- */
function Detail({ H }) {
  const h = HOMES.find(x => x.key === S.detail.home) || H[0], sc = S.detail.scene || 'sick';
  const fs = SCENES[sc].f, best = f => Math.min(...H.map(x => LIFE[x.key][f][1]));
  const tag = x => <span className="htag"><i style={{ background: x.color }}>{x.key}</i>{x.label.replace(' 원룸', '')}</span>;
  return (
    <>
      <button className="link back" onClick={() => set({ detail: null })} data-act="뒤로">‹ 집 비교로 돌아가기</button>
      <div style={{ height: 18 }} />
      <ChHead n={3} h1={<><Tile h={h} />{h.label} 주변</>} lead="집을 중심으로 가장 가까운 시설을 보여줘요. 상황을 고르면 그 시설이 강조돼요." />
      <div className="sec"><div className="sec-t">어느 집?</div><div className="chips">{H.map(x => (
        <button key={x.key} className="hchip" style={x === h ? { borderColor: x.color, color: x.color } : undefined} onClick={() => set({ detail: { home: x.key, scene: sc } })} data-act="집 바꾸기"><i style={{ background: x.color }}>{x.key}</i>{x.label}</button>
      ))}</div></div>
      <div className="sec" style={{ marginTop: 20 }}><div className="sec-t">어떤 상황?</div><div className="chips">{Object.entries(SCENES).map(([k, x]) => (
        <button key={k} className={`chip ${sc === k ? 'on' : ''}`} onClick={() => set({ detail: { home: h.key, scene: k } })} data-act="장면 바꾸기 → 지도 강조 변경">{x.name}</button>
      ))}</div></div>
      <div className="sec" style={{ marginTop: 20 }}><NeighMap h={h} scene={sc} /></div>
      <div className="sec"><div className="sec-t">{SCENES[sc].name} · 3곳 비교</div>
        <table><tbody>
          <tr><th style={{ width: '22%' }}>시설</th>{H.map(x => <th key={x.key}>{tag(x)}</th>)}</tr>
          {fs.map(f => { const F = FAC.find(z => z.k === f); return (
            <tr key={f}><td><div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}><span className="ico sm"><Icon n={F.icon} /></span>{F.label}</div></td>
              {H.map(x => { const v = LIFE[x.key][f]; return <td key={x.key} className={v[1] === best(f) ? 'best' : ''}><b className="v">{v[1]}분</b>{v[1] >= 15 ? <> <span className="pill warn">멀어요</span></> : null}<span className="w">{v[0]}</span></td>; })}</tr>
          ); })}
        </tbody></table></div>
      <div className="sec"><div className="note"><span className="ic">!</span><div><b>직접 가봐야 할 부분</b> · 지도 데이터로는 알 수 없어요<br />영업시간 · 주말·야간 진료 여부 · 역까지 경사와 계단 · 소음과 채광</div></div></div>
    </>
  );
}

export default function Step3() {
  if (!S.homesDone) return <Input />;
  const H = hs(), rank = scores(), top = rank[0];
  if (S.easy) return <Easy H={H} top={top} />;
  if (S.detail) return <Detail H={H} />;
  return <CmpPage H={H} rank={rank} />;
}

/* 오른쪽 패널 (비교 화면): 작은 지도 + 확인할 것 */
export function CmpAside({ H, top }) {
  if (S.easy) return null;      // 쉬운 화면은 오른쪽 패널을 숨겨요 (본문 지도와 #kmap이 겹치지 않게)
  const { ask, visit } = cmpChecks(H), chk = S.chk || (S.chk = {});
  const item = it => <li key={it.id}><label><input type="checkbox" defaultChecked={!!chk[it.id]} onChange={e => { S.chk[it.id] = e.target.checked; }} /><span>{it.h ? <Tile h={it.h} c="xs" /> : null}{it.t}</span></label></li>;
  return (
    <>
      <div className="panel cmp-side"><div className="panel-t">위치<button className="link" onClick={() => set({ detail: { home: top.key, scene: 'go' } })} data-act="동네 생활 지도 열기">동네 지도 ›</button></div>
        {kakaoOn() ? <MapBox /> : <MiniMap H={H} />}
        <ul className="lg">{H.map(h => <li key={h.key}><Tile h={h} c="xs" /><span className="f">{h.label.replace(' 원룸', '')}</span><b>{h.commute}분</b><span className="r">{shortRoute(h)}</span></li>)}
          <li className="dest"><span className="star" aria-hidden="true">★</span>{DEST.name} · 자주 가는 곳</li></ul></div>
      <div className="panel cmp-side chk"><div className="panel-t">확인할 것 <span className="cnt">{ask.length + visit.length}</span></div>
        <h3>중개사에게 물어볼 것</h3><ul>{ask.map(item)}</ul>
        <h3>집 보러 가서 볼 것 · 후보 집 공통</h3><ul>{visit.map(item)}</ul>
        <button className="btn-line full" id="chk-copy" onClick={copyChecks} data-act="확인할 것 복사">목록 복사하기</button></div>
    </>
  );
}
