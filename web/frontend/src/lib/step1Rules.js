/*
 * 첫집 내비 · 1단계(내 상황) 입력 규칙  (PRD R1, 3.4절 #2 — 규칙 기반, LLM 안 씀)
 *
 * 사용자가 챗봇에 직접 적은 문장을 조건 값으로 바꿔요. 버튼으로 고른 값은 이 파일을 거치지 않아도 돼요.
 * DOM이나 화면 상태(S)에 손대지 않는 순수 함수만 있어요.
 *
 *   브라우저:  <script src="step1_rules.js"></script>  →  window.Step1Rules
 *   React: import SR from './step1Rules.js'
 *
 *   Step1Rules.interpretAnswer('income', '연봉 3600', {today: '2026-11-21'})
 *     → {field, status: 'ok'|'confirm'|'ask_back', value, display, explain, ask, options, evidence}
 *   Step1Rules.interpretUpdate('집을 샀어요', profile, {today: '2026-11-21'})
 *     → {kind: 'change'|'question'|'none', changes: [...interpretAnswer 형식...], message}
 *
 * 값 형식 (web/index.html 과 같아요)
 *   age 만 나이 · job '직장인'|'대학생'|'취업 준비'|'기타' · place {name, query} · cash 만 원 · income 만 원(세전 월)
 *   time 분(상관없음 999) · when '이번 달'|'다음 달'|'N월'|'3개월 안'|'아직 몰라요' · own '없어요'|'있어요' · sep '네'|'아니요'|'모름'
 */
const Step1Rules = (function () {
  'use strict';
  const TODAY = '2026-11-21';   // 본선 시연일

  /* ---------------- 장소 ---------------- */
  const KNOWN_PLACES = {
    '강남': [['강남역', '강남역 2호선'], ['역삼역', '역삼역 2호선'], ['선릉역', '선릉역 2호선'], ['멀티캠퍼스 역삼', '서울 강남구 테헤란로 212']],
    '홍대': [['홍대입구역', '홍대입구역 2호선'], ['홍익대학교', '홍익대학교 서울캠퍼스']],
    '신촌': [['신촌역', '신촌역 2호선'], ['연세대학교', '연세대학교 신촌캠퍼스']],
    '판교': [['판교역', '판교역 신분당선'], ['판교테크노밸리', '판교테크노밸리']],
    '여의도': [['여의도역', '여의도역 5호선'], ['국회의사당역', '국회의사당역 9호선']],
    '종로': [['종각역', '종각역 1호선'], ['광화문역', '광화문역 5호선']],
    '성수': [['성수역', '성수역 2호선'], ['뚝섬역', '뚝섬역 2호선']]
  };
  const PLACE_QUERY = { '홍대입구역': '홍대입구역 2호선', '판교역': '판교역 신분당선' };
  Object.values(KNOWN_PLACES).forEach(v => v.forEach(([n, q]) => { PLACE_QUERY[n] = q; }));
  const pl = name => ({ name, query: PLACE_QUERY[name] || name });
  function placeOpts(p) {
    const k = Object.keys(KNOWN_PLACES).find(k => String(p || '').includes(k));
    return k ? KNOWN_PLACES[k] : [[p + '역', p + '역']];
  }

  /* ---------------- 필드 (web/index.html 1단계 한 화면 선택형 입력이 그대로 써요, 2026-11-17) ----------------
   * panel 항목 이름 · h 짧은 보조 문구 · input 입력 도구 · opts 버튼 [보이는 글자, 저장 값] · q 예전 채팅 질문 문장
   * input: 'year'(출생연도 선택 상자) · 'choice'(버튼) · 'place'(장소 검색) · 'money'(빠른 선택 + 숫자) · 'income'(월급/연봉 전환 + 숫자)
   * ph 는 글자 입력 규칙(interpretAnswer)의 다시 묻기 문구에만 써요 */
  const FIELDS = [
    { k: 'age', label: '나이', panel: '출생연도', input: 'year', q: '몇 년생이에요?', h: null, ph: '예: 27', unit: '세 (만 나이)', range: [14, 99],
      years: [1960, 2010], opts: [] },
    { k: 'job', label: '직업·학업 상태', panel: '직업·학업 상태', input: 'multichoice', q: '현재 어떤 일을 하고 있나요?', h: '해당하는 항목을 모두 골라 주세요', ph: '예: 직장인', allowed: ['직장인', '대학생', '취업 준비', '기타'],
      opts: [['직장인', '직장인'], ['대학(원)생', '대학생'], ['구직 중', '취업 준비'], ['프리랜서·기타', '기타']] },
    { k: 'place', label: '기준 장소', panel: '통근·통학 기준 장소', input: 'place', q: '어디까지의 이동 시간을 비교할까요?', h: '이곳까지 걸리는 시간으로 집을 비교해요', ph: '예: 역삼역 멀티캠퍼스', unit: '{name, query}',
      opts: [['멀티캠퍼스 역삼', pl('멀티캠퍼스 역삼')], ['강남역', pl('강남역')], ['홍대입구역', pl('홍대입구역')], ['판교역', pl('판교역')]] },
    { k: 'cash', label: '보증금', panel: '보증금으로 쓸 돈', input: 'money', q: '보증금으로 쓸 수 있는 돈은 얼마예요?', h: '부모님 도움 포함', ph: '예: 2천만 원', unit: '만 원', range: [0, 100000], confirmOver: 50000,
      opts: [['500만', 500], ['1,000만', 1000], ['2,000만', 2000], ['3,000만', 3000], ['5,000만', 5000], ['1억', 10000]] },
    { k: 'income', label: '한 달 수입', panel: '한 달 수입', input: 'income', q: '한 달 수입은 얼마예요?', h: '세전, 알바 포함', ph: '예: 230', unit: '만 원 (월, 세전)', range: [0, 2000], confirmOver: 1000,
      opts: [['150만', 150], ['200만', 200], ['230만', 230], ['300만', 300], ['400만', 400]],
      optsYear: [['2,000만', 2000], ['2,400만', 2400], ['2,760만', 2760], ['3,000만', 3000], ['3,600만', 3600], ['4,800만', 4800]] },
    { k: 'time', label: '이동 시간', panel: '허용 이동 시간', input: 'choice', q: '이동 시간은 편도 몇 분까지 괜찮아요?', h: '선택한 장소까지, 편도 기준', ph: '예: 40분', unit: '분 (편도, 상관없음 = 999)', range: [5, 180],
      opts: [['30분', 30], ['45분', 45], ['1시간', 60], ['1시간 30분', 90], ['상관없어요', 999]] },
    { k: 'when', label: '입주 시기', panel: '입주 시기', input: 'choice', q: '언제쯤 이사하고 싶어요?', h: null, ph: '예: 다음 달', allowed: ['이번 달', '다음 달', 'N월', '3개월 안', '아직 몰라요'],
      opts: [['이번 달', '이번 달'], ['다음 달', '다음 달'], ['3개월 안', '3개월 안'], ['아직 몰라요', '아직 몰라요']] },
    { k: 'own', label: '내 집', panel: '본인 명의 집', input: 'choice', q: '지금 본인 명의로 된 집이 있나요?', h: '부모님 집 제외', ph: '없어요 / 있어요', allowed: ['없어요', '있어요'],
      opts: [['없어요', '없어요'], ['있어요', '있어요']] },
    { k: 'sep', label: '부모님과 주소', panel: '부모님과 같은 주소', input: 'choice', q: '지금 부모님과 같은 주소에 전입되어 있나요?', h: '주민등록 기준', ph: '네 / 아니요', allowed: ['네', '아니요', '모름'],
      opts: [['네, 같아요', '네'], ['아니요', '아니요'], ['잘 모르겠어요', '모름']] }
  ];
  const F = Object.fromEntries(FIELDS.map(f => [f.k, f]));
  const KEYS = FIELDS.map(f => f.k);

  /* ---------------- 숫자 읽기 (아라비아 숫자 + 한글 수사) ---------------- */
  const SINO = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9 };
  const SMALL_U = { '십': 10, '백': 100, '천': 1000 };
  const TENS = { '열': 10, '스물': 20, '스무': 20, '서른': 30, '마흔': 40, '쉰': 50, '예순': 60, '일흔': 70, '여든': 80, '아흔': 90 };
  const ONES = { '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '하나': 1, '한': 1, '둘': 2, '두': 2, '셋': 3, '세': 3, '넷': 4, '네': 4 };
  const NATIVE_RE = new RegExp(`(${Object.keys(TENS).join('|')})(${Object.keys(ONES).join('|')})?`);
  const HOUR_RE = /(한|두|세|네|다섯|여섯)\s*시간/;

  function numTokens(text) {
    const out = [];
    const re = /[0-9.,일이삼사오육칠팔구십백천만억]+/g;
    let m;
    while ((m = re.exec(text))) {
      let s = m[0].replace(/[.,]+$/, '');
      if (/\d/.test(s)) s = s.replace(/[일이삼사오육칠팔구]+$/, '');      // '4천이' '250이면'의 '이'는 조사
      if (!s) continue;
      // 한글만 있는 덩어리는 단위(십·백·천·만·억)가 있어야 수사로 봐요 ('이요' '삼성동' '사이' 제외). '만' 하나는 '만 27세'의 만
      if (!/\d/.test(s) && (!/[십백천만억]/.test(s) || s === '만')) continue;
      const a = m.index, b = a + s.length;
      const prev = out[out.length - 1];
      if (prev && /[억만]$/.test(prev.s) && /^\s+$/.test(text.slice(prev.b, a))) { prev.s += s; prev.b = b; }   // '1억 5천'
      else out.push({ s, a, b });
    }
    return out;
  }
  function parseKor(tok) {
    const s = tok.replace(/,/g, '');
    let eok = 0, man = 0, sec = 0, cur = null, hasEok = false, hasMan = false, any = false, m;
    const re = /(\d+(?:\.\d+)?)|([일이삼사오육칠팔구])|([십백천])|([만억])/g;
    while ((m = re.exec(s))) {
      if (m[1]) { cur = parseFloat(m[1]); any = true; }
      else if (m[2]) { cur = SINO[m[2]]; any = true; }
      else if (m[3]) { sec += (cur != null ? cur : 1) * SMALL_U[m[3]]; cur = null; any = true; }
      else if (m[4] === '만') { man = (sec + (cur || 0)) || 1; sec = 0; cur = null; hasMan = true; }
      else { eok = (sec + (cur || 0)) || 1; sec = 0; cur = null; hasEok = true; }
    }
    if (!any) return null;
    return { eok, man, rest: sec + (cur || 0), hasEok, hasMan };
  }
  // → [만 원 값, 단위가 적혀 있었는지]. '1억 5천' = 15000 (억 뒤의 천은 천만), '3천5백' = 3500
  function toMan(p) {
    if (p.hasEok || p.hasMan) return [p.eok * 10000 + p.man + (p.hasMan ? p.rest / 10000 : p.rest), true];
    return [p.rest, false];
  }
  function nativeNum(text) {
    const m = NATIVE_RE.exec(text);
    return m ? TENS[m[1]] + (m[2] ? ONES[m[2]] : 0) : null;
  }
  // "2천" "2천만" "2,000만" "1억 5천" "3천5백" "오백만원" "230" → 만 원 (원 단위 큰 숫자는 그대로 숫자만 돌려줘요. 단위 판단은 interpretAnswer)
  function money(text) {
    const t = String(text || '');
    if (/없/.test(t) && !/\d/.test(t)) return 0;
    const tk = numTokens(t)[0];
    if (!tk) return null;
    const p = parseKor(tk.s);
    return p ? Math.round(toMan(p)[0]) : null;
  }

  /* ---------------- 표시 ---------------- */
  const fmt = v => Math.round(v).toLocaleString('en-US');
  const won = v => { v = Math.round(v); return v >= 10000 ? `${Math.floor(v / 10000)}억${v % 10000 ? ' ' + fmt(v % 10000) + '만' : ''} 원` : `${fmt(v)}만 원`; };
  function display(field, v) {
    if (v == null) return null;
    switch (field) {
      case 'age': return `만 ${v}세`;
      case 'place': return typeof v === 'object' ? v.name : String(v);
      case 'cash': return won(v);
      case 'income': return '월 ' + won(v);
      case 'time': return v >= 999 ? '상관없어요' : `${v}분까지`;
      case 'sep': return { '네': '네, 같아요', '아니요': '아니요', '모름': '잘 모르겠어요' }[v];
      default: return String(v);
    }
  }
  // 받침에 맞는 조사: josa('나이', '을를') → '나이를', josa('만 32세', '으로') → '만 32세로'
  function josa(word, pair) {
    const w = String(word || '').replace(/['" )]+$/, '') || ' ';
    const ch = w[w.length - 1], code = ch.charCodeAt(0) - 0xAC00;
    const jong = code >= 0 && code < 11172 ? code % 28 : ({ '1': 8, '3': 17, '6': 1, '7': 8, '8': 8 }[ch] || 0);
    if (pair === '으로') return word + (jong === 0 || jong === 8 ? '로' : '으로');
    return word + (jong ? pair[0] : pair[1]);
  }

  function res(field, status, value, o) {
    o = o || {};
    const r = { field, status, value: status === 'ask_back' ? null : value, display: status === 'ask_back' ? null : display(field, value),
      explain: o.explain || null, ask: o.ask || null, options: o.options || [], evidence: o.evidence || null };
    if (status === 'confirm' && !o.options) {
      r.ask = o.ask || `${josa(display(field, value), '으로')} 이해했어요. 맞아요?`;
      r.options = [['맞아요', value], ['다시 입력', null]];
    }
    if (o.note) r.note = o.note;
    if (o.vague) r.vague = true;
    return r;
  }
  function askBack(field, o) {
    o = o || {};
    return res(field, 'ask_back', null, { ...o, ask: o.ask || `잘 못 알아들었어요. "${F[field].ph.replace(/^예:\s*/, '')}"처럼 적거나 위 버튼을 눌러 주세요`,
      options: o.options != null ? o.options : F[field].opts });
  }
  // web/index.html typed1() 규칙: 빈 입력, 자음·모음만, 한/영 전환 실수 (영어 소문자만 — 나이·금액·시간 질문은 제외)
  function typoCheck(field, text) {
    const t = String(text || '').trim();
    if (!t) return askBack(field, { ask: '입력이 비어 있어요. ' + F[field].q, explain: '빈 입력' });
    if (/[ㄱ-ㅎㅏ-ㅣ]/.test(t)) return askBack(field, { explain: '자음·모음만 있는 입력' });
    if (/^[a-z]{2,}$/.test(t) && !['age', 'cash', 'income', 'time'].includes(field))
      return askBack(field, { ask: '영어로 입력됐어요. 한/영 키를 바꿔서 다시 적어 주세요', explain: '한/영 전환 실수로 보임' });
    return null;
  }

  /* ---------------- 구조 → 값 (계산·범위 검사는 전부 여기) ---------------- */
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

  function fromStruct(field, s, text, today) {
    const ev = s.evidence || null;
    if (field === 'age') {
      if (s.number == null) return askBack(field, { evidence: ev });
      const n = Math.round(s.number), ty = D(today).getUTCFullYear();
      if (s.type === 'birth_year') {
        const y = n < 100 ? n + (n <= ty % 100 ? 2000 : 1900) : n, after = ty - y;
        if (!(after >= 14 && after <= 100)) return askBack(field, { ask: '출생연도를 다시 확인해 주세요. 만 나이로 적어 주셔도 돼요.', evidence: ev });
        return res(field, 'confirm', after, { evidence: ev, explain: `${y}년생`,
          ask: `${y}년생이면 올해 생일이 지났는지에 따라 만 ${after}세 또는 만 ${after - 1}세예요. 올해 생일 지났어요?`,
          options: [['생일 지났어요', after], ['아직이에요', after - 1]] });
      }
      if (n < 14 || n > 99) return askBack(field, { ask: '만 나이를 숫자로 다시 알려 주세요 (예: 27).', evidence: ev, explain: `${n}세는 범위(14~99) 밖` });
      return res(field, 'ok', n, { evidence: ev });
    }
    if (field === 'job') {
      if (!s.category) return askBack(field, { ask: '지금 상황을 아래 버튼에서 골라 주세요.', evidence: ev });
      return res(field, 'ok', s.category, { evidence: ev, explain: s.category !== String(text).trim() ? `'${String(text).trim()}' → ${s.category}` : null });
    }
    if (field === 'place') {
      if (s.remote) return askBack(field, { ask: '재택이시군요. 그래도 주로 가는 곳(사무실·학교·자주 가는 역)이 있나요? 없으면 자주 가는 동네를 적어 주세요.', options: [], evidence: ev, explain: '재택 근무' });
      const name = String(s.name || '').trim();
      if (!name || !/^[가-힣A-Za-z0-9 .\-]{2,40}$/.test(name)) return askBack(field, { ask: '회사나 학교 이름, 가까운 역 이름을 적어 주세요.', evidence: ev });
      const key = name.replace(/\s/g, '');
      if (KNOWN_PLACES[key] || /^(서울|서울시|[가-힣]{1,3}구)$/.test(key)) {
        const c = KNOWN_PLACES[key] || [[name + '역', name + '역']];
        return askBack(field, { ask: `${name}는 넓어서 출퇴근 시간을 정확히 계산하기 어려워요. 어디쯤인지 골라 주시거나 역·건물 이름을 적어 주세요.`,
          options: c.map(([n, q]) => [n, { name: n, query: q }]), evidence: name, explain: '넓은 지명 → 후보 제시', vague: true });
      }
      return res(field, 'ok', pl(name), { evidence: ev, explain: name !== String(text).trim() ? `'${String(text).trim()}' → ${name}` : null });
    }
    if (field === 'cash' || field === 'income') {
      const sp = F[field];
      if (s.range) {
        if (field === 'income') return askBack(field, { ask: `${s.range[0]}~${s.range[1]}처럼 범위면 지원 자격이 갈릴 수 있어요. 세전 기준 한 달 수입을 한 숫자로 알려 주세요.`, evidence: ev, explain: '범위로 답함' });
        const v = Math.round(s.range[1]);
        return res(field, 'confirm', v, { evidence: ev, explain: `범위 '${ev}' → 위쪽 값 ${won(v)}`, ask: `보증금으로 ${won(v)}까지 쓸 수 있다고 이해했어요. 맞아요?` });
      }
      if (s.amount == null) return askBack(field, { evidence: ev });
      let a = s.amount, status = 'ok', heard = null;
      const steps = [], notes = [];
      if (s.unit === '원' || (s.unit !== '만원' && a > sp.range[1] && a >= 10000)) {
        steps.push(`${fmt(a)}원 ÷ 10,000 = ${fmt(a / 10000)}만 원` + (s.unit === '원' ? '' : ' (단위가 없어서 원으로 봤어요)'));
        heard = `${fmt(a)}원`; a = a / 10000; status = 'confirm';
      }
      if (field === 'income') {
        if (s.period === '연') {
          steps.push(`연봉 ${won(a)} ÷ 12`);
          heard = `연봉 ${won(a)}`; a = a / 12; status = 'confirm';
        }
        if (s.tax === '세후') {
          heard = heard || `세후 ${won(a)}`; status = 'confirm';
          notes.push('지원 자격은 세전 기준이라, 세전 금액을 알면 그 값으로 바꿔 주세요.');
        }
      }
      const v = Math.round(a);
      if (v < 0 || v > sp.range[1]) return askBack(field, { ask: `${won(v)}은 너무 커서 다시 확인할게요. 만 원 단위로 다시 적어 주세요.`, evidence: ev, explain: '범위 밖' });
      if (v > sp.confirmOver) { status = 'confirm'; notes.push(`${won(sp.confirmOver)}을 넘는 큰 금액이라 한 번 더 확인해요.`); }
      let ask = null;
      if (status === 'confirm') {
        const src = heard ? josa(heard, '을를') : `'${ev || text}' →`;
        ask = `${src} ${josa(display(field, v), '으로')} 이해했어요. ${notes.length ? notes.join(' ') + ' ' : ''}맞아요?`;
      }
      return res(field, status, v, { evidence: ev, ask, explain: steps.length ? steps.join(' → ') : null, note: notes.join(' ') || null });
    }
    if (field === 'time') {
      if (s.any) return res(field, 'ok', 999, { evidence: ev, explain: '상관없음 = 999' });
      let v, explain = null;
      if (s.range) { v = Math.round(s.range[1]); explain = `범위 ${s.range[0]}~${s.range[1]}분 → 위쪽 값 ${v}분`; }
      else {
        if (s.hours == null && s.minutes == null) return askBack(field, { evidence: ev });
        v = Math.round((s.hours || 0) * 60 + (s.minutes || 0));
        if (s.hours) explain = `${s.hours}시간${s.minutes ? ' ' + s.minutes + '분' : ''} = ${v}분`;
      }
      if (v < 5 || v > 180) return askBack(field, { ask: `${v}분은 범위(5~180분) 밖이에요. 편도 기준으로 몇 분까지 괜찮은지 다시 알려 주세요.`, evidence: ev, explain: '범위 밖' });
      return res(field, 'ok', v, { evidence: ev, explain });
    }
    if (field === 'when') {
      const d = D(today), t = s.type;
      let v;
      if (t === 'this_month') v = '이번 달';
      else if (t === 'next_month') v = '다음 달';
      else if (t === 'month') { const m = Math.round(s.month || 0); if (m < 1 || m > 12) return askBack(field, { evidence: ev }); v = `${m}월`; }
      else if (t === 'in_months' || t === 'in_weeks') {
        const n = Math.round((t === 'in_months' ? s.months : s.weeks) || 0);
        let diff = n;
        if (t === 'in_weeks') { const g = new Date(d.getTime() + n * 7 * 86400000); diff = (g.getUTCFullYear() - d.getUTCFullYear()) * 12 + g.getUTCMonth() - d.getUTCMonth(); }
        const m = (d.getUTCMonth() + diff) % 12 + 1;
        v = diff === 0 ? '이번 달' : diff === 1 ? '다음 달' : `${m}월`;
        return res(field, 'ok', v, { evidence: ev, explain: `${n}${t === 'in_weeks' ? '주' : '개월'} 뒤 → ${v} (${today} 기준)` });
      }
      else if (t === 'within_months') {
        const n = Math.round(s.months || 0);
        if (n < 1 || n > 3) return askBack(field, { ask: '정확한 달을 알려 주시거나 아래에서 골라 주세요.', evidence: ev });
        v = '3개월 안';
      }
      else if (t === 'unknown') v = '아직 몰라요';
      else return askBack(field, { ask: '몇 월쯤인지 알려 주시거나 아래에서 골라 주세요.', evidence: ev });
      return res(field, 'ok', v, { evidence: ev });
    }
    if (field === 'own') {
      if (s.own == null) return askBack(field, { ask: "본인 명의로 된 집이 있는지 '없어요' 또는 '있어요'로 알려 주세요.", evidence: ev });
      return res(field, 'ok', s.own ? '있어요' : '없어요', { evidence: ev, explain: s.family ? '가족 명의 집은 본인 명의가 아니에요 → 없어요' : null });
    }
    if (field === 'sep') {
      if (s.same === undefined) return askBack(field);
      const v = s.same === true ? '네' : s.same === false ? '아니요' : '모름';
      return res(field, 'ok', v, { evidence: ev, note: v === '모름' ? "'모름'은 지원 판정에서 '확인 필요'로 다뤄요." : null });
    }
    throw new Error('unknown field ' + field);
  }

  /* ---------------- 규칙: 문장 → 구조 ---------------- */
  function moneyStruct(t, field) {
    if (/없|안\s*벌|무소득/.test(t) && !/[1-9]/.test(t)) return { amount: 0, unit: '만원', evidence: (t.match(/\S*없\S*/) || [t])[0] };
    if (/^\s*0\s*(원|만\s*원)?\s*$/.test(t)) return { amount: 0, unit: '만원', evidence: '0' };
    const toks = numTokens(t);
    if (!toks.length) return { amount: null };
    const period = /연봉|연\s*소득|연\s*수입|1년에|일년에|^연\s/.test(t) ? '연' : '월';
    const tax = /세후|실수령|손에 쥐|통장에 들어오/.test(t) ? '세후' : /세전/.test(t) ? '세전' : '모름';
    if (toks.length >= 2 && /[~\-]|에서|부터|사이/.test(t.slice(toks[0].b, toks[1].a)))
      return { range: [toMan(parseKor(toks[0].s))[0], toMan(parseKor(toks[1].s))[0]], evidence: t.slice(toks[0].a, toks[1].b) };
    const tk = toks[0], p = parseKor(tk.s), [v, marked] = toMan(p);
    let a = tk.a;
    const km = /(연봉|월급|세후|세전|실수령|월|연)\s*(?:은|는|이|가)?\s*$/.exec(t.slice(0, tk.a));
    if (km) a = km.index;
    const ev = t.slice(a, tk.b);
    if (marked) return { amount: v, unit: '만원', period, tax, evidence: ev };
    if (/^\s*원/.test(t.slice(tk.b))) return { amount: v, unit: '원', period, tax, evidence: ev };
    return { amount: v, unit: '없음', period, tax, evidence: ev };
  }

  function ruleStruct(field, text) {
    const t = String(text).trim();
    let m;
    if (field === 'age') {
      if ((m = /(\d{4}|\d{2})\s*년\s*(도\s*)?생|(\d{4})\s*년(?!\s*\d)/.exec(t))) return { type: 'birth_year', number: +(m[1] || m[3]), evidence: m[0] };
      if ((m = /\d+/.exec(t))) return { type: 'age', number: +m[0], evidence: m[0] };
      const n = nativeNum(t);
      if (n) return { type: 'age', number: n, evidence: NATIVE_RE.exec(t)[0] };
      for (const tk of numTokens(t)) { const p = parseKor(tk.s); if (p && !p.hasMan && !p.hasEok) return { type: 'age', number: p.rest, evidence: tk.s }; }
      return { number: null };
    }
    if (field === 'job') {
      let c = null;
      if (/취준|취업\s*준비|취업\s*중|구직|쉬고|쉬는|쉬어|그만두|그만뒀|퇴사|백수|무직|실직|이직\s*준비|놀고/.test(t)) c = '취업 준비';
      else if (/대학|학생|휴학|재학|복학|졸업반|학교\s*다/.test(t) && !/회사|직장|입사|들어갔|취직|취업했/.test(t)) c = '대학생';
      else if (/직장|회사|근무|재직|사원|직원|공무원|정규직|계약직|프리랜서|자영업|사업|가게|일해|일하|다녀|다닙|출근|월급|입사|들어갔|취직|취업했|개발자|간호사|디자이너|교사|선생님|엔지니어|연구원|요리사|기자|의사|약사|변호사|회계사|마케터|기획자|상담사|미용사|강사|창업|사장/.test(t)) c = '직장인';
      else if (/알바|아르바이트|군인|군대|복무|입대|주부|육아|기타|인턴/.test(t)) c = '기타';
      return { category: c, evidence: t };
    }
    if (field === 'place') {
      if (/재택|원격|집에서\s*(일|근무)|리모트/.test(t)) return { remote: true, evidence: t };
      const drop = /^(근처|부근|쪽|앞|주변|인근|회사|사무실|직장|학교|건물|다녀요|다녀|다닙니다|있어요|있는|이에요|예요|에요|입니다|요|이요|에|저는|제|회사는|학교는|직장은|회사가|학교가|사무실은|일해요|근무해요|가요|바뀌었어요|바꿨어요|옮겼어요|됐어요)$/;
      let w = t.split(/\s+/).filter(x => !drop.test(x));
      if (w.length) w[w.length - 1] = w[w.length - 1].replace(/(이에요|예요|에요|이요|입니다|에\s*있어요|에서|으로|로|에|요)$/, '') || w[w.length - 1];
      if (w.length >= 2 && /[가-힣](동|구)$/.test(w[0]) && !/역$/.test(w[0])) w = w.slice(1);
      const name = w.join(' ').trim();
      return { name: name || null, evidence: name || t };
    }
    if (field === 'cash' || field === 'income') return moneyStruct(t, field);
    if (field === 'time') {
      if (!/\d|한|두|세|반|시간/.test(t) && /상관|아무|괜찮|무관|멀어도|오래 걸려도/.test(t)) return { any: true, evidence: t };   // 숫자가 있으면 숫자 우선
      if ((m = /(\d+)\s*분?\s*(?:~|-|에서)\s*(\d+)\s*분/.exec(t))) return { range: [+m[1], +m[2]], evidence: m[0] };
      let h = null, mi = null;
      const mh = /(\d+(?:\.\d+)?)\s*시간/.exec(t) || HOUR_RE.exec(t);
      if (mh) { h = /\d/.test(mh[1]) ? parseFloat(mh[1]) : ONES[mh[1]]; if (/시간\s*반/.test(t)) mi = 30; }
      const mm = /(\d+)\s*분/.exec(t);
      if (mm) mi = +mm[1];
      if (h == null && mi == null) { const tk = numTokens(t)[0]; if (tk) { const p = parseKor(tk.s); if (p) mi = p.rest; } }
      if (h == null && mi == null) return {};
      return { hours: h, minutes: mi, evidence: ((mh ? mh[0] : '') + (mm ? ' ' + mm[0] : '')).trim() || t };
    }
    if (field === 'when') {
      if (/이번\s*달|이달|당장|바로|빨리|지금|즉시|이번\s*주/.test(t)) return { type: 'this_month', evidence: t };
      if ((m = /(\d+)\s*주\s*(뒤|후|안|있다가)/.exec(t))) return { type: 'in_weeks', weeks: +m[1], evidence: m[0] };
      if (/다음\s*달|담달|한\s*달\s*(뒤|후)/.test(t)) return { type: 'next_month', evidence: t };
      if ((m = /(\d+)\s*개월\s*(안|이내|내)/.exec(t))) return { type: 'within_months', months: +m[1], evidence: m[0] };
      if ((m = /(\d+)\s*개월\s*(뒤|후|있다가)/.exec(t))) return { type: 'in_months', months: +m[1], evidence: m[0] };
      if ((m = /(\d{1,2})\s*월/.exec(t))) return { type: 'month', month: +m[1], evidence: m[0] };
      if (/석\s*달|분기/.test(t)) return { type: 'within_months', months: 3, evidence: t };
      if (/모르|미정|아직|글쎄|정해지지|안\s*정했/.test(t)) return { type: 'unknown', evidence: t };
      return { type: 'vague', evidence: t };      // 봄·연말·내년 등 → 다시 묻기
    }
    if (field === 'own') {
      if (/없|무주택|아니|아뇨|^노$/.test(t)) return { own: false, evidence: t };
      if (/부모|엄마|아빠|어머니|아버지|가족|형|누나|언니|오빠|동생|배우자/.test(t) && !/제\s*(명의|이름)|저도|제 거|본인/.test(t)) return { own: false, family: true, evidence: t };   // 본인 명의만
      if (/있|^네|^예|^응|샀|매수|보유|소유|분양\s*받|한\s*채|생겼/.test(t)) return { own: true, evidence: t };
      return { own: null };
    }
    if (field === 'sep') {
      if (/모르|글쎄|기억|확인\s*안|헷갈/.test(t)) return { same: null, evidence: t };
      if (/따로|분리|혼자|나와|독립|다른\s*주소|안\s*살|달라요|다르/.test(t)) return { same: false, evidence: t };
      if (/같|함께|같이|부모님\s*(이랑|하고|과|와)|본가/.test(t)) return { same: true, evidence: t };   // '아니 같아요' → 뒤쪽 정정을 따라요
      if (/아니|아뇨|^노$/.test(t)) return { same: false, evidence: t };
      if (/^(네|예|응|맞|ㅇㅇ)|그래요|돼\s*있/.test(t)) return { same: true, evidence: t };
      return {};
    }
    throw new Error('unknown field ' + field);
  }

  function interpretAnswer(field, text, opt) {
    if (!F[field]) throw new Error('field 는 ' + KEYS.join(', ') + ' 중 하나여야 해요');
    const today = (opt && opt.today) || TODAY;
    const t = String(text || '').trim().slice(0, 200);
    return typoCheck(field, t) || fromStruct(field, ruleStruct(field, t), t, today);
  }

  /* ---------------- 9개 질문이 끝난 뒤 ---------------- */
  const QUESTION_RE = new RegExp('[?？]\\s*$|(나요|까요|되나|있나|되나요|달라지|어때요|뭐예요|뭔가요|인가요|알려\\s*주|궁금|도\\s*(돼|되)요?)\\s*[.!]?\\s*$|' +
    '면\\s*.{0,20}(달라|받을\\s*수|받나|되나|돼요|될까|가능|어떻|못\\s*받|안\\s*돼)|인데\\s*.*(받|되|돼|가능|신청)');
  const TRIG = {   // 이 말이 있으면 그 항목이 바뀐 걸로 보고 해당 항목 규칙으로 값을 읽어요
    age: /\d{2}\s*(살|세)|[가-힣]+\s*살\s*(됐|이에요|이야|입니다)|\d{2,4}\s*년\s*생/,
    job: /입사|취직|취업했|들어갔|퇴사|그만뒀|그만두|졸업하고|복학|입학|휴학했|백수|이직했|프리랜서|창업/,
    place: /(회사|직장|학교|사무실|근무지|출근하는\s*곳)\s*(이|가|은|는)?\s*.+?(으로|로)\s*(바뀌|옮|이전|이사|변경|발령)|(회사|직장|학교|사무실|근무지)\s*(이|가|은|는)\s*[가-힣A-Za-z0-9 ]+?\s*(이에요|예요|이야|쪽이에요|으로\s*됐)/,
    cash: /보증금|모은\s*돈|모아둔\s*돈|목돈|예금|적금/,
    income: /월급|연봉|월\s*소득|월\s*수입|한\s*달\s*수입|소득|수입|급여|실수령/,
    time: /출퇴근|통근|출근\s*시간|등교\s*시간|통학/,
    when: /이사|입주/,
    own: /집을?\s*(샀|구매|구입|매수|팔|팔았)|집이\s*생겼|분양\s*받|무주택|내\s*집/,
    sep: /전입|세대\s*분리|세대분리|주소\s*(를|가)?\s*(옮|바꾸|바뀌|이전)|따로\s*살|독립/
  };
  const NONE_HINT = /월세|전세|관리비|동네|역세권|방\s*구조|평수|층|원룸|투룸|오피스텔|반려|주차|옵션|쪽이\s*좋|살고\s*싶|좋겠/;

  function span(f, text) {
    const parts = text.split(/\s*(?:,|그리고|이고|하고\s|고\s|\.)\s*/);
    return parts.find(p => TRIG[f].test(p)) || text;
  }
  function interpretUpdate(text, profile, opt) {
    const today = (opt && opt.today) || TODAY;
    const t = String(text || '').trim().slice(0, 300);
    if (!t || /^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(t) || /^[a-z ]{2,}$/.test(t)) return { kind: 'none', changes: [], message: '잘 못 알아들었어요. 다시 적어 주세요.' };
    if (QUESTION_RE.test(t)) return { kind: 'question', changes: [], message: '조건은 그대로 두고, 공고문에서 찾아볼게요.' };
    const changes = [];
    for (const f of KEYS) {
      if (!TRIG[f].test(t)) continue;
      let seg = span(f, t), m;
      if (f === 'income' && /월세|관리비/.test(seg) && !/월급|연봉|소득|수입|급여/.test(seg)) continue;
      if (f === 'place' && (m = /(?:회사|직장|학교|사무실|근무지|출근하는\s*곳)\s*(?:이|가|은|는)?\s*(.+?)\s*(?:으로|로|쪽이에요|이에요|예요|이야)/.exec(seg))) seg = m[1];
      if (f === 'when' && !/(이번\s*달|다음\s*달|\d+\s*주\s*(뒤|후)|\d+\s*개월|\d{1,2}\s*월|아직|모르|미정)/.test(seg)) continue;
      if (f === 'own') seg = /샀|구매|구입|매수|생겼|분양/.test(seg) ? '있어요' : /팔|무주택/.test(seg) ? '없어요' : seg;
      const r = interpretAnswer(f, seg, { today });
      if (['age', 'cash', 'income', 'time', 'when', 'job'].includes(f) && r.status === 'ask_back') continue;   // 언급만 하고 값이 없으면 안 바꿔요
      r.evidence = r.evidence || seg;
      changes.push(r);
    }
    if (!changes.length)
      return { kind: 'none', changes: [], message: NONE_HINT.test(t) ? '그 내용은 3단계에서 집별로 볼게요. 1단계 조건은 그대로예요.' : '1단계 조건은 바뀌지 않았어요. 궁금한 점은 질문으로 적어 주세요.' };
    const P = profile || {};
    const msg = changes.map(c => {
      const lbl = F[c.field].label;
      if (c.status === 'ok') {
        const old = P[c.field], oldD = old != null ? display(c.field, old) : null;
        return `${josa(lbl, '을를')} ${josa(c.display, '으로')} 바꿨어요` + (oldD && oldD !== c.display ? ` (${oldD} → ${c.display})` : '');
      }
      return `${lbl}: ${c.ask}`;
    }).join(' · ');
    return { kind: 'change', changes, message: msg };
  }

  return { TODAY, FIELDS, KNOWN_PLACES, PLACE_QUERY, placeOpts, interpretAnswer, interpretUpdate, money, won, display, josa,
    _internal: { numTokens, parseKor, toMan, nativeNum, ruleStruct, fromStruct } };
})();

export default Step1Rules;
