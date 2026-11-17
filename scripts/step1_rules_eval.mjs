/*
 * 1단계 규칙 평가 (web/step1_rules.js) — Node만으로 돌아가요 (npm 패키지 없음)
 *   processed/step1/eval_cases.csv 의 119개 입력을 Step1Rules 에 넣고 채점해요.
 *   - value:    status=ok 이고 값이 맞으면 O
 *   - confirm:  status=confirm 이고 값 또는 options 안에 기대값이 있으면 O
 *   - ask_back: status=ask_back 이면 O
 *   - question / none: update 모드의 kind 가 같으면 O
 *   - 조용한 오답: status=ok 로 저장했는데 값이 틀린 것 (질문·none인데 조건을 바꾼 것 포함) → 0개여야 해요
 *   기대값이 '26|27'처럼 여러 개면 그중 하나면 맞아요.
 *   지금 규칙(main 의 web/index.html 로직, 아래 OLD 에 그대로 옮김)과 보강한 규칙을 나란히 비교해요.
 *
 * 실행: node scripts/step1_rules_eval.mjs
 * 결과: processed/step1/eval_result.csv (utf-8-sig)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = createRequire(import.meta.url)(join(BASE, 'web', 'step1_rules.js'));
const CF = join(BASE, 'processed', 'step1', 'eval_cases.csv');
const OUT = join(BASE, 'processed', 'step1', 'eval_result.csv');
const PROFILE = { age: 27, job: '직장인', place: { name: '멀티캠퍼스 역삼', query: '서울 강남구 테헤란로 212' }, cash: 2000, income: 230, time: 40, when: '다음 달', own: '없어요', sep: '네' };

/* ---------- 지금 규칙 (main 의 web/index.html: QS1.parse · typed1 · money · KNOWN_PLACES · extra1 · parseMsg 를 그대로 옮김) ---------- */
const OLD = (() => {
  function money(t){ t = t.replace(/,/g,''); let m, v = 0;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*억/))) v += parseFloat(m[1]) * 10000;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*천/))) v += parseFloat(m[1]) * 1000;
    if (!v && (m = t.match(/(\d+(?:\.\d+)?)\s*(만|만원|만 원)?/))) v = parseFloat(m[1]);
    return v ? Math.round(v) : null; }
  const KNOWN_PLACES = { '강남':1, '홍대':1, '신촌':1, '판교':1, '여의도':1, '종로':1, '성수':1 };
  const P = {
    age: t=>{const m=t.match(/\d{2}/);return m&&+m[0]>=14&&+m[0]<=99?+m[0]:null},
    job: t=>/직장|회사|근무|재직|사원|직원|공무원|정규|계약직|프리랜서|일해|다녀/.test(t)?'직장인':/대학|학생|휴학|졸업반/.test(t)?'대학생':/취준|취업|구직|준비|쉬고|백수/.test(t)?'취업 준비':/^[가-힣 ]{2,}$/.test(t.trim())?t.trim():null,
    place: t=>/^[가-힣A-Za-z0-9 ]{2,}$/.test(t.trim())?t.trim():null,
    cash: t=>money(t), income: t=>money(t),
    time: t=>{if(/상관|아무|괜찮/.test(t))return 999;const h=t.match(/(\d+)\s*시간/),m=t.match(/(\d+)/);return h?+h[1]*60+(/반/.test(t)?30:0):/한 ?시간/.test(t)?60+(/반/.test(t)?30:0):m?+m[1]:null},
    when: t=>/이번 ?달|당장|바로|빨리|지금/.test(t)?'이번 달':/다음 ?달|한 ?달 ?(뒤|후)/.test(t)?'다음 달':/(\d{1,2})\s*월/.test(t)?t.match(/(\d{1,2})\s*월/)[1]+'월':/(\d)\s*개월|석 ?달|분기/.test(t)?'3개월 안':/모르|미정|아직|글쎄/.test(t)?'아직 몰라요':null,
    own: t=>/없|무주택|아니/.test(t)?'없어요':/있/.test(t)?'있어요':null,
    sep: t=>/아니|따로|분리/.test(t)?'아니요':/네|같|응/.test(t)?'네':null
  };
  function answer(k, t){            // typed1
    t = (t||'').trim();
    if (!t) return { status:'ask_back', value:null, options:[] };
    if (/^[a-z]{2,}$/.test(t) && !['age','cash','income','time'].includes(k)) return { status:'ask_back', value:null, options:[] };
    const v = P[k](t);
    if (/[ㄱ-ㅎㅏ-ㅣ]/.test(t) || v==null || Number.isNaN(v)) return { status:'ask_back', value:null, options:[] };
    if (k==='place' && KNOWN_PLACES[v.replace(/역$/,'')] && !/역$/.test(v)) return { status:'ask_back', value:null, options:[] };   // set(): 넓은 지명이면 다시 묻기
    return { status:'ok', value:v, options:[] };
  }
  function parseMsg(t){
    const out = {}; let m;
    if ((m = t.match(/(만\s*)?(\d{2})\s*(살|세)/))) out.age = +m[2];
    if ((m = t.match(/직장인|회사원|회사|직장|출근|월급/))) out.job = '직장인'; else if ((m = t.match(/대학생|학생|학교|대학|등교/))) out.job = '대학생';
    if ((m = t.match(/(회사|직장|학교|대학교|일하는 곳|사무실|출근|등교)(은|는|가|이|하는 곳은)\s*([가-힣A-Za-z0-9 ]{2,20}?)(이고|이에요|예요|이라|라서|에 있|쪽|근처|,|\.|$)/))) out.place = m[3].trim().replace(/\s*(에|에서)$/,'');
    else if ((m = t.match(/([가-힣]{2,10}역)/))) out.place = m[1];
    if ((m = t.match(/(모아둔 돈|모은 돈|목돈|보증금으로 쓸 수 있는 돈|보증금)\s*(은|는|이|으로)?\s*([0-9][0-9,.\s]*(억|천|만)?[0-9,.\s]*(천|만)?)/))) out.cash = money(m[3]);
    if ((m = t.match(/(월급|월 소득|한 달 수입|한 달에|월)\s*(은|는|이)?\s*([0-9][0-9,]*\s*만?)\s*(원|정도)?/))) out.income = money(m[3]);
    if ((m = t.match(/(\d+)\s*시간/))) out.time = +m[1] * 60; else if ((m = t.match(/(\d+)\s*분\s*(안|이내|이하)?/))) out.time = +m[1];
    if ((m = t.match(/다음\s*달|이번\s*달|(\d{1,2})\s*월에/))) out.when = m[1] ? `${m[1]}월` : m[0];
    if (/집\s*(이|은)?\s*없|무주택/.test(t)) out.own = '없어요';
    if (/세대\s*분리|혼자\s*전입|따로\s*전입/.test(t)) out.sep = '아니요';
    return out;
  }
  function update(t){               // extra1: 질문이면 /api/ask, 조건이 뽑히면 변경, 아니면 /api/ask 로 보냄(= question)
    t = (t||'').trim();
    const isQ = /[?？]\s*$|(나요|까요|되나|있나)\s*$/.test(t);
    const p = isQ ? {} : parseMsg(t);
    const keys = Object.keys(p);
    if (!keys.length) return { kind:'question', changes:[] };
    return { kind:'change', changes: keys.map(k => ({ field:k, status:'ok', value:p[k], options:[] })) };
  }
  return { answer, update };
})();

/* ---------- 채점 ---------- */
function parseCSV(txt){
  const rows = []; let row = [], f = '', q = false;
  txt = txt.replace(/^﻿/, '');
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i+1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const vv = x => (x && typeof x === 'object') ? x.name : x;
const eq = (a, b) => vv(a) != null && String(vv(a)).replace(/\s/g, '') === String(b).replace(/\s/g, '');
const anyEq = (v, exp) => exp.split('|').some(e => eq(v, e));

function grade(c, r){
  const et = c.expect_type, exp = c.expected;
  if (c.mode === 'answer') {
    const st = r.status;
    const ok = et === 'value' ? st === 'ok' && anyEq(r.value, exp)
      : et === 'confirm' ? st === 'confirm' && (anyEq(r.value, exp) || r.options.some(o => anyEq(o[1], exp)))
      : st === 'ask_back';
    return [ok, st === 'ok' && !(et === 'value' && anyEq(r.value, exp))];
  }
  const oks = r.changes.filter(x => x.status === 'ok');
  if (et === 'question' || et === 'none') return [r.kind === et, oks.length > 0];
  const [f, rawVal] = exp.split('='); const val = rawVal.split('(')[0];
  const wrongOk = oks.filter(x => !(x.field === f && et === 'value' && anyEq(x.value, val)));
  const x = r.changes.find(x => x.field === f);
  if (!x || r.kind !== 'change') return [false, wrongOk.length > 0];
  const ok = et === 'value' ? x.status === 'ok' && anyEq(x.value, val)
    : et === 'confirm' ? x.status === 'confirm' && (anyEq(x.value, val) || x.options.some(o => anyEq(o[1], val)))
    : x.status === 'ask_back';
  return [ok, wrongOk.length > 0];
}
function short(r){
  if ('kind' in r) return r.kind + (r.changes.length ? ': ' + r.changes.map(c => `${c.field}=${vv(c.value)}(${c.status})`).join(', ') : '');
  let s = `${r.status} ${vv(r.value) ?? ''}`.trim();
  if (r.status === 'confirm') s += ' opts=' + r.options.filter(o => o[1] != null).map(o => vv(o[1])).join('/');
  return s;
}

const cases = parseCSV(readFileSync(CF, 'utf8'));
const MODES = [
  ['지금 규칙 (main)', c => c.mode === 'answer' ? OLD.answer(c.field, c.input) : OLD.update(c.input)],
  ['보강 규칙 (step1_rules.js)', c => c.mode === 'answer' ? R.interpretAnswer(c.field, c.input, { today: '2026-11-21' }) : R.interpretUpdate(c.input, PROFILE, { today: '2026-11-21' })]
];
const results = {}, summary = [];
for (const [name, fn] of MODES) {
  const res = cases.map(c => {
    const t0 = process.hrtime.bigint();
    const r = fn(c);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const [ok, silent] = grade(c, r);
    return { ok, silent, ms, short: short(r), r };
  });
  results[name] = res;
  const n = cases.length, ok = res.filter(x => x.ok).length, silent = res.filter(x => x.silent).length;
  const by = {};
  cases.forEach((c, i) => { for (const k of [`유형 ${c.expect_type}`, `필드 ${c.field || 'update'}`]) { by[k] ??= [0, 0]; by[k][0] += res[i].ok; by[k][1]++; } });
  summary.push({ name, ok, n, silent, by, avg: res.reduce((s, x) => s + x.ms, 0) / n, max: Math.max(...res.map(x => x.ms)) });
}

const [oldN, newN] = MODES.map(m => m[0]);
console.log('■ 틀린 케이스 (보강 규칙)');
cases.forEach((c, i) => { const r = results[newN][i]; if (!r.ok || r.silent) console.log(`  ${c.id} ${r.silent ? '조용한오답 ' : ''}[${c.field || 'update'}] ${c.input} → ${r.short}  (기대 ${c.expect_type} ${c.expected})`); });
for (const s of summary) {
  console.log(`\n■ ${s.name}: 정답 ${s.ok}/${s.n} (${(s.ok / s.n * 100).toFixed(1)}%) · 조용한 오답 ${s.silent}개 · 응답 평균 ${s.avg.toFixed(2)}ms 최대 ${s.max.toFixed(2)}ms`);
  console.log('  ' + Object.entries(s.by).filter(([k]) => k.startsWith('유형')).map(([k, [a, b]]) => `${k.slice(3)} ${a}/${b}`).join(' · '));
  console.log('  ' + Object.entries(s.by).filter(([k]) => k.startsWith('필드')).map(([k, [a, b]]) => `${k.slice(3)} ${a}/${b}`).join(' · '));
}
const fixed = cases.filter((c, i) => !results[oldN][i].ok && results[newN][i].ok).length;
const broke = cases.filter((c, i) => results[oldN][i].ok && !results[newN][i].ok).map(c => c.id);
console.log(`\n■ 비교: 지금 규칙에서 틀리고 보강 규칙에서 맞은 케이스 ${fixed}개 · 반대(새로 틀림) ${broke.length}개 ${broke.join(' ')}`);

const head = ['id', 'mode', 'field', 'input', 'expect_type', 'expected', 'note', 'old_ok', 'old_silent', 'old_result', 'new_ok', 'new_silent', 'new_result', 'new_display', 'new_explain', 'new_ask'];
const lines = [head.join(',')];
cases.forEach((c, i) => {
  const o = results[oldN][i], n = results[newN][i], r = n.r;
  const one = 'kind' in r ? (r.changes[0] || {}) : r;
  lines.push([c.id, c.mode, c.field, c.input, c.expect_type, c.expected, c.note, o.ok ? 'O' : 'X', o.silent ? '!' : '', o.short,
    n.ok ? 'O' : 'X', n.silent ? '!' : '', n.short, one.display ?? '', one.explain ?? '', ('kind' in r ? r.message : r.ask) ?? ''].map(csvCell).join(','));
});
writeFileSync(OUT, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
console.log('저장 → processed/step1/eval_result.csv');
