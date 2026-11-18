/* 03 집 고르기 · 후보 집 넣기 → 같은 기준으로 비교(표 · 순위 · 물어보기) → 동네 지도
   계산(scores · reasons · houseSupport · tmpl3 …)은 lib/core.js 그대로예요. 관리비를 모르면 '확인 필요'로 두고 순위와 '가장 싸다'에서 빼요. */
import { Fragment } from 'react';
import { S, set, go, focusId } from '../store.js';
import {
  HOMES, FAC, LIFE, SCENES, PRIO, MAX_HOMES, ADDR_RESULTS, ADDR_Q, DEST, val, fareMonth, feeOf, feeKnown, monthly, cheapest, r1,
  scores, reasons, weakness, nextSlot, addHome, homeVis, kakaoOn, liveSearch, livePick, addLive, hs, houseSupport, me, walkPre, shortRoute, lifeScore,
  jump, openEdit, saveEdit, nm3, ja3, askCmp, API_OK, copyFile,
} from '../lib/core.js';
import { Html, Icon, Tile, BBest, BUnk, ChHead, Modal, IcCk, IcX, IcDash, IcPen, IcDown } from '../components/ui.jsx';
import { MapBox, NeighMap, MiniMap } from '../components/Maps.jsx';

const enterKey = (e, f) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) f(e.currentTarget.value); };

/* ----- 후보 집 넣기 · 토스 방식 ----- */
/* 주소를 찾고 계약 조건을 확인한 뒤 후보 목록에 추가해요. */
function showComparison(on) {
  set({ homesDone: on, editKey: null });
  if (S.easy) return;
  window.scrollTo(0, 0);
  focusId(on ? 's3-compare' : 's3-input');
}

function CandModal() {
  const parsed = S.parsed !== null && S.parsed !== undefined;
  if (!S.cand && !parsed) return null;
  const h = S.cand || HOMES[S.parsed], live = !!S.cand, close = () => set({ parsed: null, cand: null });
  const add = () => {
    if (live) addLive(); else addHome(S.parsed);
    if (!S.easy) focusId(S.homes.length < 2 ? 's3-address' : 's3-compare-start');
  };
  return (
    <Modal title={`집 ${h.key}`} sub={h.addr} onClose={close}
      foot={<><button className="btn ghost" onClick={close} data-act="다시 검색">다시 검색</button>
        <button className="btn pri" onClick={add} data-act="집 추가 → 다음 칸">집 {h.key}로 추가</button></>}>
      <dl className="tz-sum s3-kv">
        <div><dt>가까운 역</dt><dd>{h.station}</dd></div>
        <div><dt>{DEST.name}까지</dt><dd>{h.commute}분</dd><small>{h.route}</small></div>
        <div><dt>한 달 교통비</dt><dd>{fareMonth(h) ? `${fareMonth(h)}만 원` : '0원'}</dd></div>
      </dl>
      {live ? <ul className="s3-fac">{FAC.map(f => <li key={f.k}><span>{f.label}</span><b>{h.life[f.k][0]} {h.life[f.k][1]}분</b></li>)}</ul> : null}
      <h3 className="md-st">계약 조건</h3>
      <div className="fields s3-fields">
        <label>보증금<span className="inp"><input id="in-dep" type="number" defaultValue={h.deposit} />만 원</span></label>
        <label>월세<span className="inp"><input id="in-rent" type="number" defaultValue={h.rent} />만 원</span></label>
        <label>관리비<span className="inp"><input id="in-fee" type="number" placeholder="모르면 비워 두기" defaultValue={h.fee ?? ''} />만 원</span></label>
      </div>
    </Modal>
  );
}

function Input() {
  const slot = nextSlot(), n = S.homes.length, full = n >= MAX_HOMES, hk = full ? null : HOMES[slot].key;
  const findingDetails = S.liveBusy === 'pick';
  const search = () => kakaoOn() ? liveSearch() : set({ addrQ: S.addrQ || ADDR_Q[slot] });
  const rows = kakaoOn() ? (S.live || []).map((r, k) => ({ name: r.name, sub: r.sub, ok: r.ok, pick: () => livePick(k) }))
    : S.addrQ ? ADDR_RESULTS[slot].map(r => ({ name: r[0], sub: r[1], ok: r[2] !== null, pick: () => set({ parsed: r[2] }) })) : [];
  let res = null;
  if (S.liveBusy === 'search') res = <p className="tz-sub" role="status">카카오에서 주소를 찾는 중…</p>;
  else if (findingDetails) res = <p className="tz-sub" role="status">주변 역·마트·약국과 {DEST.name}까지 오가는 시간을 찾고 있어요…</p>;
  else if (rows.length) res = <ul className="tl2">{rows.map((r, k) => (
    <li className={`tr ${r.ok ? '' : 'tr-dim'}`} key={k}>
      <button className="tr-m" disabled={!r.ok} onClick={r.pick} aria-haspopup="dialog" data-act="결과 선택 → 집 정보 모달">
        <span className="tr-ic"><Icon n="building" /></span><span className="tr-t"><b>{r.name}</b><small>{r.sub}</small></span>
        {r.ok ? <span className="chev">›</span> : <span className="tr-v cond"><b>건물 번호 필요</b></span>}</button></li>))}</ul>;
  else if (kakaoOn() && S.live) res = <p className="tz-sub">검색 결과가 없어요. 동 이름과 번지까지 넣어 보세요 (예: {ADDR_Q[slot]})</p>;
  const ready = n >= 2;
  const map = <section className="s3-map" aria-label="후보 집 위치">{S.easy ? null : <h2>후보 집 위치</h2>}<MapBox vis={homeVis()} /></section>;
  return (
    <div className="tz s3in" id="s3-input" role={S.easy ? undefined : 'region'} tabIndex={S.easy ? undefined : -1} aria-label={S.easy ? undefined : '후보 집 넣기'}>
      <ChHead n={3} h1="비교할 후보 집을 넣어 주세요" lead={<>부동산 앱에서 본 집 주소를 찾으면 <b>{DEST.name}</b>까지 거리와 시간을 지도에 그려 드려요.</>} />
      {!kakaoOn() && DEST.name !== '멀티캠퍼스 역삼' ? <p className="tz-note">카카오 키가 없어서 예시 집(성수·역삼·신림)은 <b>멀티캠퍼스 역삼</b> 기준 시간으로 보여줘요.</p> : null}

      {full ? null : (
        <section className="tz-ask s3-search" aria-label="주소 찾기">
          <div className="ask-in"><input id="s3-address" key={S.homes.join(',')} aria-label={`집 ${hk} 주소`} defaultValue={S.addrQ || ''} placeholder={`집 ${hk} 주소 · 도로명 또는 지번 (건물 번호까지)`} onInput={e => { S.addrQ = e.currentTarget.value; }}
            onKeyUp={e => enterKey(e, () => { if (!S.liveBusy) search(); })} />
            <button onClick={search} disabled={!!S.liveBusy} data-act="주소 검색 → 결과 목록">찾기</button></div>
          {res || <p className="tz-sub">예: {ADDR_Q[slot]}{kakaoOn() ? '' : ' · 찾기만 눌러도 예시 주소로 찾아요'}</p>}
        </section>
      )}

      {S.easy ? map : null}

      <section className="tz-sec sm s3-candidates" aria-labelledby="s3-candidates-title">
        <h2 id="s3-candidates-title">{S.easy ? '후보 집' : '추가한 후보 집'} <span aria-live="polite">{n} / {MAX_HOMES}{S.easy ? ' · 2곳부터 비교할 수 있어요' : ''}</span></h2>
        {!n && !S.easy ? <p className="s3-empty">주소를 찾고 계약 조건을 입력하면 여기에 후보 집이 추가돼요.</p> : null}
        <ul className="tl2">
          {S.homes.map(i => { const h = HOMES[i]; return (
            <li className="tr" key={i}>
              <div className="tr-m static"><span className="tr-ic pin" style={{ background: h.color }}>{h.key}</span>
                <span className="tr-t"><b>{h.label}</b><small>{h.station} · {DEST.name}까지 {h.commute}분</small></span>
                <span className="tr-v"><b>{val(h, 'deposit').toLocaleString()} / {val(h, 'rent')}</b><small>보증금 / 월세</small></span></div>
              <div className="tr-a"><button className="tbtn gray" disabled={findingDetails} aria-label={`${h.label} 빼기`} onClick={() => {
                set({ homes: S.homes.filter(x => x !== i), addrQ: '', live: null });
                if (!S.easy) focusId('s3-address');
              }} data-act="집 빼기">빼기</button></div>
            </li>); })}
          {full || !S.easy ? null : <li className="tr tr-dim"><div className="tr-m static"><span className="tr-ic pin empty">{hk}</span>
            <span className="tr-t"><b>집 {hk}{n >= 2 ? ' (선택)' : ''}</b><small>위에서 주소를 찾아 넣어 주세요</small></span></div></li>}
        </ul>
      </section>

      {!S.easy ? <p className="s3-compare-hint" role="status">{n === 0 ? '후보 집을 2곳 이상 넣으면 비교할 수 있어요.' : n === 1 ? '1곳 더 넣으면 비교할 수 있어요.' : ''}</p> : null}
      <div className="cta s3-candidate-actions"><button className="btn ghost" onClick={() => go(2)}>이전</button>
        <button id="s3-compare-start" className="btn pri wide" disabled={!ready || findingDetails} onClick={() => showComparison(true)} data-act="비교 시작">{ready ? `${n}곳 비교하기` : S.easy ? `${2 - n}곳 더 넣으면 비교할 수 있어요` : '후보 집 비교하기'}</button></div>
      {S.easy ? null : map}
      <CandModal />
    </div>
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

function LifeCell({ h, ks, best }) {
  const b = ks.map(k => LIFE[h.key][k]).reduce((a, c) => a[1] <= c[1] ? a : c);
  if (/없음/.test(b[0])) return <td><span className="v">–</span><span className="s2">2km 안에 없어요</span></td>;
  return <td className={best != null && b[1] === best ? 'best' : ''}>
    <b className="v">{b[1]}분{b[1] >= 15 ? <> <span className="pill warn">멀어요</span></> : null}</b>
    <span className="s2">{b[0]}</span></td>;
}

function Sup({ x }) {
  if (x.dup) return <td><span className="st no"><IcDash />같이 못 받아요</span><span className="s2">국토부 청년월세와 중복</span></td>;
  return x.ok ? <td><span className="st ok"><IcCk />조건 맞음</span><span className="s2">{x.t}</span></td>
    : <td><span className="st no"><IcX />조건 안 맞음</span><span className="s2">{x.t}</span></td>;
}

function CmpTable({ H, part = 'core' }) {
  const m = me(), cash = m.cash, K = H.filter(feeKnown), cheap = K.length >= 2 ? cheapest(H) : null;
  const fastT = Math.min(...H.map(h => h.commute)), fastN = H.filter(h => h.commute === fastT).length;
  const S3 = Object.fromEntries(H.map(h => [h.key, houseSupport(h)]));
  const wish = S.prof && S.prof.time && S.prof.time < 999 ? S.prof.time : null;
  const cell = f => f;
  const core = part === 'core';
  const G = ({ t, sub }) => <tr><th scope="rowgroup" colSpan={H.length + 1} className="g">{t}{sub ? <> <span>· {sub}</span></> : null}</th></tr>;
  const Row = ({ label, sub, f, cls, id }) => <tr className={cls || undefined} id={id}><th scope="row">{label}{sub ? <small className="s2">{sub}</small> : null}</th>{H.map(h => <Fragment key={h.key}>{f(h)}</Fragment>)}</tr>;
  return (
    <div className="tblwrap s3-scroll" role="region" tabIndex={0} aria-label={part === 'core' ? '후보 집 비교표' : part === 'life' ? '주변 시설 비교표' : '집별 지원 비교표'} style={{ '--home-count': H.length }}><table>
      <caption className="sr">후보 집 {H.length}곳 비교표</caption>
      <colgroup><col className="s3-item-col" />{H.map(h => <col key={h.key} />)}</colgroup>
      <thead><tr><th scope="col" className="k">{part === 'life' ? '시설' : '항목'}</th>{H.map(h => (
        <th scope="col" key={h.key}><div className="hd"><Tile h={h} /><span className="hn2"><b>{h.label.replace(/ 원룸$/, '')}</b><small>{/ 원룸$/.test(h.label) ? '원룸' : ''}</small></span>
          {core ? <button className="pen" onClick={() => openEdit(h.key)} aria-label={`${h.key} ${h.label} 값 고치기`} title="값 고치기" data-act="값 고치기"><IcPen /></button> : null}</div></th>
      ))}</tr></thead>
      {core ? <>
      <tbody>
        {G({ t: "처음 드는 돈" })}
        {Row({ label: "보증금", sub: `모아둔 돈 ${cash.toLocaleString()}만 원과 비교`, f: cell(h => { const d = val(h, 'deposit');
          return <td><span className="v">{d.toLocaleString()}만 원</span>{d > cash ? <span className="bdg unk">{(d - cash).toLocaleString()}만 원 부족</span> : <span className="s2">{(cash - d).toLocaleString()}만 원 남아요</span>}</td>; }) })}
      </tbody>
      <tbody>
        {G({ t: "매달 드는 돈" })}
        {Row({ label: "월세", f: cell(h => <td><span className="v">{val(h, 'rent')}만 원</span></td>) })}
        {Row({ label: "관리비", cls: "pre", id: "row-fee", f: cell(h => feeKnown(h) ? <td><span className="v">{feeOf(h)}만 원</span></td>
          : <td><BUnk>확인 필요</BUnk><button className="link" onClick={() => openEdit(h.key, 'ed-fee')} data-act="관리비 넣기">관리비 알면 넣기</button></td>) })}
        {Row({ label: "한 달 확인된 비용", sub: <>월세 + 확인된 관리비<br />공과금 별도</>, cls: "sum", id: "row-total", f: cell(h => (
          <td><span className="big">{monthly(h)}<small>만 원{feeKnown(h) ? '' : ' +'}</small></span>
            {!feeKnown(h) ? <BUnk>관리비 확인 필요</BUnk> : h === cheap ? <BBest>{K.length < H.length ? '확인된 것 중 가장 적어요' : '가장 적어요'}</BBest> : null}</td>)) })}
      </tbody>
      <tbody>
        {G({ t: "오가는 시간", sub: `${DEST.name}까지` })}
        {Row({ label: "출퇴근 (편도)", id: "row-commute", f: cell(h => (
          <td><span className="v">{h.commute}분</span><span className="s2">{h.route}</span>{h.commute === fastT && fastN === 1 ? <BBest>가장 짧아요</BBest> : null}
            {wish && h.commute > wish ? <span className="bdg unk">{wish}분 넘음</span> : null}</td>)) })}
        {Row({ label: "교통비 (한 달)", sub: "참고 · 합계에 넣지 않아요", f: cell(h => <td><span className="v">{fareMonth(h) ? '약 ' + fareMonth(h) + '만 원' : '0원'}</span>{fareMonth(h) ? null : <span className="s2">걸어서</span>}</td>) })}
      </tbody>
      </> : null}
      {part === 'life' ? <tbody>
        {FAC.map(fac => { const best = Math.min(...H.map(h => LIFE[h.key][fac.k][1]));
          return <Fragment key={fac.k}>{Row({ label: fac.label, f: cell(h => <LifeCell h={h} ks={[fac.k]} best={best} />) })}</Fragment>; })}
        {Row({ label: "생활 점수", cls: "sum", f: (() => { const top = Math.max(...H.map(lifeScore)); return cell(h => { const sc = lifeScore(h); return <td className={sc === top ? 'best' : ''}><b className="big">{sc}<small>점</small></b></td>; }); })() })}
      </tbody> : null}
      {part === 'sup' ? <tbody>
        {Row({ label: "국토부 청년월세", f: cell(h => <Sup x={S3[h.key].molit} />) })}
        {Row({ label: "서울시 청년월세", f: cell(h => <Sup x={S3[h.key].seoul} />) })}
        {Row({ label: "중개보수·이사비", f: cell(h => <Sup x={S3[h.key].move} />) })}
        {Row({ label: <>지원 확정 시<span className="tagass">가정</span></>, sub: "월세 지원을 받는 동안", cls: "ass", f: cell(h => { const s = S3[h.key], a = r1(monthly(h) - s.monthSup);
          return <td><span className="v">월 {a}만 원{feeKnown(h) ? '' : ' +'}</span><span className="s2">{s.monthSup ? `${monthly(h)}만 원 − ${s.monthSup}만 원 · ${s.molit.ok ? 24 : 12}개월` : '지원 없음'}{feeKnown(h) ? '' : ' · 관리비 별도'}</span></td>; }) })}
      </tbody> : null}
    </table></div>
  );
}

function CmpEdit() {
  const h = hs().find(x => x.key === S.editKey); if (!h) return null;
  const close = () => set({ editKey: null });
  return (
    <Modal title={`${h.label} 값 고치기`} sub="매물에 적힌 금액을 넣어 주세요 · 관리비를 모르면 비워 두세요" onClose={close}
      foot={<><button className="btn ghost" onClick={close}>취소</button><button className="btn pri" onClick={() => saveEdit(h.key)} data-act="값 저장 → 다시 계산">저장하고 다시 계산</button></>}>
      <div className="fields md-fields" id="cmp-edit" key={h.key}>
        <label>보증금<span className="inp"><input id="ed-dep" type="number" defaultValue={val(h, 'deposit')} />만 원</span></label>
        <label>월세<span className="inp"><input id="ed-rent" type="number" defaultValue={val(h, 'rent')} />만 원</span></label>
        <label>관리비<span className="inp"><input id="ed-fee" type="number" placeholder="모르면 비워 두기" defaultValue={feeOf(h) ?? ''} />만 원</span></label>
      </div>
    </Modal>
  );
}

/* 1 · 무엇을 먼저 볼까요 (탭) */
function CmpPrio() {
  return (
    <div className="tz-tabs" role="group" aria-label="무엇을 먼저 볼까요">{Object.entries(PRIO).map(([k, p]) => (
      <button key={k} className={S.prio === k ? 'on' : ''} aria-pressed={S.prio === k} onClick={() => set({ prio: k, cmpQ: [] })} data-act="우선순위 바꾸기 → 종합 점수 다시 계산">{p.name}</button>
    ))}</div>
  );
}

/* 2 · 먼저 살펴볼 집과 이유 · 순위 목록 */
function CmpRank({ H, rank }) {
  const K = rank.filter(r => !r.unk), U = rank.filter(r => r.unk);
  const cheap = K.length >= 2 ? cheapest(H) : null, fast = H.slice().sort((a, b) => a.commute - b.commute)[0];
  const minK = K.length ? Math.min(...K.map(r => monthly(r.h))) : Infinity;
  const why = h => {
    const a = [];
    if (cheap) { const d = r1(monthly(h) - monthly(cheap)); a.push(h === cheap ? '한 달 비용이 가장 적어요' : d > 0 ? `${cheap.key}보다 한 달 ${d}만 원 더 들어요` : `한 달 비용은 ${cheap.key}와 같아요`); }
    const t = h.commute - fast.commute;
    a.push(h === fast ? `출퇴근이 ${walkPre(h)}${h.commute}분으로 가장 짧아요` : t > 0 ? `출퇴근은 ${fast.key}보다 ${t}분 길어요` : `출퇴근 시간은 ${fast.key}와 같아요`);
    return a.join(' · ');
  };
  const wk = K.length ? weakness(K[0].h) : '', top = K[0] && K[0].h;
  return (
    <section className="tz-pick" aria-labelledby="rank-t">
      {top ? <>
        <p className="tz-o">{PRIO[S.prio].name} 기준으로 보면</p>
        <h2 id="rank-t"><span style={{ color: top.color }}>{top.key} {top.label}</span>을<br />먼저 살펴보세요</h2>
        <p className="tz-why">{why(top)}{wk ? <><br />아쉬운 점 · {wk}</> : null}</p>
        <dl className="tz-sum">
          <div><dt>한 달 비용</dt><dd>{monthly(top)}만 원</dd></div>
          <div><dt>보증금</dt><dd>{val(top, 'deposit').toLocaleString()}만 원</dd></div>
          <div><dt>{DEST.name}까지</dt><dd>{top.commute}분</dd></div>
        </dl>
      </> : <h2 id="rank-t">관리비를 알아야<br />먼저 볼 집을 정할 수 있어요</h2>}
      <ol className="tl2 rk3">
        {K.map((r, i) => <li className="tr" key={r.h.key}><div className="tr-m static"><span className="rk-no">{i + 1}</span><Tile h={r.h} c="sm" /><span className="tr-t"><b>{r.h.label}</b><small>{why(r.h)}</small></span><span className="tr-v"><b>{r.total}점</b></span></div></li>)}
        {U.map(r => <li className="tr tr-dim" key={r.h.key}><div className="tr-m static"><span className="rk-no">–</span><Tile h={r.h} c="sm" /><span className="tr-t"><b>{r.h.label}</b><small>관리비를 알면 순위에 넣어요{monthly(r.h) < minK ? ' · 월세만 보면 가장 싸요' : ''}</small></span>
          <span className="tr-v"><button className="tbtn" onClick={() => openEdit(r.h.key, 'ed-fee')} data-act="관리비 넣기">관리비 넣기</button></span></div></li>)}
      </ol>
      {K.length ? <button className="link tz-more" onClick={() => set({ md3: 'why' })} aria-haspopup="dialog" data-act="점수 설명 모달">점수는 이렇게 매겼어요 ›</button> : null}
    </section>
  );
}

/* 자세히 보기 모달 · 위치 / 주변 시설 / 지원 / 점수 설명 */
function CmpModal({ H, rank, top }) {
  const k = S.md3, close = () => set({ md3: null }), m = me();
  if (!k) return null;
  if (k === 'map') return (
    <Modal wide title="후보 집 위치" sub={`★ ${DEST.name}까지 오가는 시간`} onClose={close}
      foot={<button className="btn ghost" onClick={() => set({ md3: null, detail: { home: top.key, scene: 'go' } })} data-act="동네 생활 지도 열기">동네 지도로 자세히 보기</button>}>
      <div className="md-map">{kakaoOn() ? <MapBox /> : <MiniMap H={H} />}</div>
      <ul className="tl2">{H.map(h => <li className="tr" key={h.key}><div className="tr-m static"><Tile h={h} c="sm" /><span className="tr-t"><b>{h.label}</b><small>{shortRoute(h)}</small></span><span className="tr-v"><b>{h.commute}분</b></span></div></li>)}</ul>
    </Modal>
  );
  if (k === 'life') return (
    <Modal wide title="주변 시설 비교" sub="집에서 가장 가까운 곳까지 걸어서 걸리는 시간" onClose={close}
      foot={<button className="btn ghost" onClick={() => set({ md3: null, detail: { home: top.key, scene: 'shop' } })} data-act="동네 생활 지도 열기">동네 지도로 보기</button>}>
      <div className="cmp md-tbl"><CmpTable H={H} part="life" /></div>
    </Modal>
  );
  if (k === 'sup') return (
    <Modal wide title="이 집에서 받을 수 있는 지원" sub={`만 ${m.age}세 · 월 소득 ${m.inc}만 원 · ${m.own ? '집 있음' : '무주택'} 조건과 집의 보증금·월세로 확인했어요. 소득·재산은 신청할 때 서류로 확인해요.`} onClose={close}>
      <div className="cmp md-tbl"><CmpTable H={H} part="sup" /></div>
    </Modal>
  );
  const rs = reasons(rank);
  return (
    <Modal title="점수는 이렇게 매겼어요" sub={`${PRIO[S.prio].name} 기준 · 비용 ${Math.round(PRIO[S.prio].w.cost * 100)}% · 시간 ${Math.round(PRIO[S.prio].w.time * 100)}% · 동네 ${Math.round(PRIO[S.prio].w.life * 100)}%`} onClose={close}>
      <ul className="why-list">{rs.map((t, i) => <Html as="li" key={i} html={t} />)}</ul>
      <h3 className="md-st">계산 방법</h3>
      <ul className="md-chk plain">
        <li>비용 · 관리비까지 확인된 집 중 가장 싼 집 100점, 월 10만 원 비쌀 때마다 −15점</li>
        <li>시간 · 15분 이하 100점, 그 뒤 1분마다 −2점</li>
        <li>동네 · 시설마다 걸어서 5분 이하 100점, 20분 이상 0점 → 8곳 평균</li>
      </ul>
      <p className="md-q" style={{ marginTop: 16 }}>점수와 숫자는 코드가 계산하고, AI는 이 근거로만 설명해요.</p>
    </Modal>
  );
}

/* 비교에서 더 볼 수 있는 것 (주변 시설 · 집마다 지원) */
function CmpChecks() {
  return (
    <ul className="tl2 tz-links">
      <li className="tr"><button className="tr-m" onClick={() => set({ md3: 'life' })} aria-haspopup="dialog" data-act="주변 시설 모달"><span className="tr-ic"><Icon n="cart" /></span><span className="tr-t"><b>주변 시설 비교</b><small>지하철역 · 장보기 · 병원 · 공원까지 걸어서</small></span><span className="chev">›</span></button></li>
      <li className="tr"><button className="tr-m" onClick={() => set({ md3: 'sup' })} aria-haspopup="dialog" data-act="지원 모달"><span className="tr-ic"><Icon n="receipt" /></span><span className="tr-t"><b>집마다 받을 수 있는 지원</b><small>보증금·월세에 따라 달라지는 청년월세 조건</small></span><span className="chev">›</span></button></li>
    </ul>
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
    <section className="tz-sec sm cmp3" id="cmp3">
      <div className="cmp3-box">
        <h2>이 비교에 대해 물어보기 <span className="ai-by">{off ? 'AI 꺼짐 · 계산 결과 문장으로 답해요' : '계산된 비교 결과로만 답해요'}</span></h2>
        <div className="cmp3-ex">{ex.map(q => <button key={q} onClick={() => askCmp(q)} data-act="예시 질문 → 답 카드">{q}</button>)}</div>
        <div className="cmp3-in"><input id="cmp3q" placeholder="궁금한 걸 물어보세요" onKeyUp={e => enterKey(e, askCmp)} />
          <button onClick={() => askCmp(document.getElementById('cmp3q').value)} data-act="묻기 → 답 카드">묻기</button></div>
      </div>
      {(S.cmpQ || []).map((it, i) => <CmpCard key={i} it={it} />)}
    </section>
  );
}

function CmpPage({ H, rank }) {
  const m = me(), top = rank[0].h, ex = H.some(h => !h.live);
  return (
    <div className="tz s3-compare" id="s3-compare" role="region" tabIndex={-1} aria-label="후보 집 비교">
      <ChHead n={3} h1={<>후보 집 {H.length}곳 비교{ex ? <span className="cmp-tag">예시 집</span> : null}</>}
        lead={<>{DEST.name} 기준 · 모아둔 돈 {m.cash.toLocaleString()}만 원 · 월 소득 {m.inc}만 원<button className="link" onClick={() => go(1)} data-act="01로">조건 고치기</button></>}
        right={<div className="ch-btns">
          <button className="tbtn gray" onClick={() => set({ md3: 'map' })} aria-haspopup="dialog" data-act="위치 보기">위치 보기</button>
          <button className="tbtn gray" onClick={() => showComparison(false)} data-act="집 바꾸기">집 바꾸기</button></div>} />
      <CmpPrio />
      <CmpRank H={H} rank={rank} />
      <section className="tz-sec" aria-labelledby="tbl-t"><h2 id="tbl-t">한눈에 비교</h2>
        <p className="s3-table-hint">표를 옆으로 움직여 다른 집도 비교해 보세요.</p>
        <div className="cmp tz-tbl"><CmpSummary H={H} /><CmpTable H={H} /></div>
      </section>
      <section className="tz-sec" aria-label="더 보기"><CmpChecks /></section>
      <div className="cta s3-advance"><button className="btn ghost" onClick={() => go(2)}>이전</button><button className="btn pri wide" id="file-copy2" onClick={copyFile} data-act="파일 복사">파일 전체 복사하기</button></div>
      <CmpSec rank={rank} />
      <p className="cmp-src">주변 시설 거리 · 카카오 로컬 · 오가는 시간과 요금 · ODsay{ex ? ' · 예시 집의 보증금·월세·관리비는 화면 설명용 값이에요' : ''}</p>
      {S.editKey ? <CmpEdit /> : null}
      <CmpModal H={H} rank={rank} top={top} />
    </div>
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
    <div className="s3-detail">
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
      <div className="sec"><div className="sec-t">{SCENES[sc].name} · {H.length}곳 비교</div>
        <div className="s3-scroll" role="region" aria-label="동네 시설 비교표" tabIndex={0} style={{ '--home-count': H.length }}><table><thead>
          <tr><th scope="col">시설</th>{H.map(x => <th scope="col" key={x.key}>{tag(x)}</th>)}</tr>
        </thead><tbody>
          {fs.map(f => { const F = FAC.find(z => z.k === f); return (
            <tr key={f}><th scope="row"><span className="s3-fac-label">{F.label}</span></th>
              {H.map(x => { const v = LIFE[x.key][f]; return <td key={x.key} className={v[1] === best(f) ? 'best' : ''}><b className="v">{v[1]}분</b>{v[1] >= 15 ? <> <span className="pill warn">멀어요</span></> : null}<span className="w">{v[0]}</span></td>; })}</tr>
          ); })}
        </tbody></table></div></div>
      <div className="sec"><div className="note"><span className="ic">!</span><div><b>직접 가봐야 할 부분</b> · 지도 데이터로는 알 수 없어요<br />영업시간 · 주말·야간 진료 여부 · 역까지 경사와 계단 · 소음과 채광</div></div></div>
    </div>
  );
}

export default function Step3() {
  if (!S.homesDone) return <Input />;
  const H = hs(), rank = scores(), top = rank[0];
  if (S.easy) return <Easy H={H} top={top} />;
  if (S.detail) return <Detail H={H} />;
  return <CmpPage H={H} rank={rank} />;
}
