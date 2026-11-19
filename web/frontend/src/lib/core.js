/* 계산 · 판정 · 데이터 — firsthome.html 의 함수를 그대로 옮겼어요 (화면 그리는 부분만 components/ · pages/ 의 JSX로 바꿨어요).
   S = 화면 상태 · set/render/go/focusId = store.js · SR = step1Rules.js (1단계 항목 정의) */
import { S, set, render, focusId } from '../store.js';
import SR from './step1Rules.js';

export const ICONS={
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
 train:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/>',
 bus:'<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 10h16M7 21v-3M17 21v-3"/>',
 cart:'<path d="M3 4h2l2.5 11h10L20 8H6.5"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
 pill:'<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/>',
 gym:'<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 home:'<path d="M4 11l8-7 8 7M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
 building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
 truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
 receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 bank:'<path d="M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18"/>'
};

export const POL = [
  {id:'molit', icon:'home', name:'국토부 청년월세', amt:'최대 480만 원', how:'월 20만 원 × 최대 24개월', pay:'월 최대 20만 원 × 24개월', last:'올해 접수 3월 30일 ~ 5월 29일 (끝)', channel:'주민센터 방문 또는 복지로', link:'https://www.bokjiro.go.kr', site:'복지로',
   ev:[['{AGE}','만 19~34세','ok'],['무주택','무주택','ok'],['공공임대 아님','공공임대 거주자 제외','ok'],['{INC}','청년가구 중위 60% · 원가구 중위 100% 이하','q']],
   quote:'<mark>19~34세</mark> 독립거주 <mark>무주택</mark> 청년 · 실제 월세 범위 내 <mark>월 최대 20만원 × 최대 24개월</mark>', src:'온통청년 20260319005400112218', easy:'매달 월세를 20만 원씩, 2년 동안 도와줘요'},
  {id:'move', icon:'truck', name:'서울시 중개보수·이사비 지원', amt:'최대 40만 원', how:'중개보수 + 이사비 실비 · 생애 1회', pay:'일회성 최대 40만 원', last:'올해 접수 1차 4월 1~14일 · 2차 8월 18~31일 (끝)', channel:'청년몽땅정보통 온라인', link:'https://youth.seoul.go.kr', site:'청년몽땅정보통',
   ev:[['{AGE}','만 19~39세','ok'],['12월 서울 입주','서울 전입 후 전입신고','ok'],['무주택','무주택 임차가구','ok'],['보증금 2,000만 원 이하 예산','거래금액 2억 원 이하','ok'],['{INC}','기준 중위소득 150% 이하','q']],
   quote:'<mark>2024-01-01 이후 서울시로 전입</mark> 또는 서울시 내 이사 후 <mark>전입신고 완료</mark> · 중개보수 + 이사비 실비, <mark>최대 40만원</mark>', src:'서울시 2026 청년 부동산 중개보수 및 이사비 지원', easy:'부동산 수수료와 이사비를 40만 원까지 도와줘요'},
  {id:'seoul', icon:'home', name:'서울시 청년월세', amt:'최대 240만 원', how:'월 20만 원 × 최대 12개월 · 생애 1회', pay:'월 최대 20만 원 × 12개월', last:'올해 접수 5월 6~19일 (끝)', channel:'서울주거포털 온라인', link:'https://housing.seoul.go.kr', site:'서울주거포털', excluded:true,
   ev:[['{AGE}','만 19~39세','ok'],['서울 입주','서울시 주민등록 + 임차 건물 전입','ok'],['무주택','무주택 월세 거주','ok'],['아직 집 안 정함','보증금 8천만 원 · 월세 60만 원 이하','q'],['{INC}','기준 중위소득 150% 이하','q']],
   quote:'보증금 <mark>8천만원 이하·월세 60만원 이하</mark>. 월세 60 초과여도 (보증금×5%/12 + 월세) ≤ 93만원이면 가능', src:'서울시 청년몽땅정보통'}
];

export const MED1 = 256.4;

export function me(o){ const P=S.prof||{}, sp=S.sep||P.sep, jobs=jobs1(); return {age:P.age||27, inc:P.income!=null?P.income:230, own:(S.own||P.own)==='있어요', sep:sp==='네'||sp==='모름', sepQ:sp==='모름', cash:P.cash!=null?P.cash:2000, job:jobs.includes('대학생')?'대학생':jobs[0]||'직장인', ...(o||{})}; }   // sep '모름'은 '네'와 같이 다뤄요 → 국토부 독립거주 '확인 필요'

export function moveIn(){ const w=(S.prof||{}).when, m=+TODAY1.slice(5,7), date=whenDate1(w);
  if(date) return `${date.year}년 ${+date.month}월 서울 입주`;
  if(!w||w==='다음 달') return `${m%12+1}월 서울 입주`; if(w==='이번 달') return `${m}월 서울 입주`;
  if(/^\d{1,2}월$/.test(w)) return `${w} 서울 입주`; if(w==='3개월 안') return '3개월 안 서울 입주'; return '서울 입주 (시기 미정)'; }

export function judge(o){
  const m=me(o), pct=Math.round(m.inc/MED1*100), yinc=m.inc*12;
  const age=(lo,hi)=>[`만 ${m.age}세`,`만 ${lo}~${hi}세`, m.age>=lo&&m.age<=hi?'ok':'no', `만 ${lo}~${hi}세 대상 (지금 만 ${m.age}세)`];
  const home=t=>[m.own?'집 있음':'무주택', t, m.own?'no':'ok', '무주택이어야 해요'];
  const incK=`월 ${m.inc}만 원 (중위 ${pct}%)`;
  const inc150=lo=>[incK, `기준 중위소득 ${lo?'48% 초과 ~ ':''}150% 이하`, m.inc>MED1*1.5||(lo&&m.inc<=MED1*.48)?'no':'q', m.inc>MED1*1.5?`소득이 중위 150%를 넘어요 (지금 약 ${pct}%)`:`소득이 중위 48% 이하예요 (지금 약 ${pct}%) · 주거급여 대상일 수 있어요`];
  const ev={
    molit:[age(19,34), home('무주택'), m.sep?[m.sepQ?'부모님과 같은 주소인지 모름':'부모님과 같은 주소','독립거주 (이사하며 세대 분리하면 충족)','q']:['부모님과 따로 살아요','독립거주','ok'], ['공공임대 아님','공공임대 거주자 제외','ok'], [incK,'청년가구 중위 60% · 원가구 중위 100% 이하','q']],
    move:[age(19,39), [moveIn(),'서울 전입 후 전입신고','ok'], home('무주택 임차가구'), [`보증금 ${m.cash.toLocaleString()}만 원 예산`,'거래금액 2억 원 이하', m.cash<=15000?'ok':'q'], inc150(false)],
    seoul:[age(19,39), ['서울 입주','서울시 주민등록 + 임차 건물 전입','ok'], home('무주택 월세 거주'), ['아직 집 안 정함','보증금 8천만 원 · 월세 60만 원 이하','q'], inc150(true)]
  };
  const AMT={molit:480, move:40, seoul:240};
  const list=POL.map(p=>{ const e=ev[p.id]; let st=e.some(x=>x[2]==='no')?'no':'ok'; if(o&&o.noMolit&&p.id==='molit') st='no';
    const why=e.filter(x=>x[2]==='no').map(x=>x[3]||x[1]);
    if(o&&o.noMolit&&p.id==='molit') why.push('소득 조건 안 맞음');
    return {...p, ev:e, st, why, amtN:st==='ok'?AMT[p.id]:0}; });
  const by=Object.fromEntries(list.map(p=>[p.id,p]));
  let ex=null; if(by.molit.st==='ok'&&by.seoul.st==='ok'){ by.seoul.st='dup'; by.seoul.amtN=0; ex=by.seoul; }
  const chosen=list.filter(p=>p.st==='ok'), fail=list.filter(p=>p.st==='no');
  return {m, pct, yinc, list, chosen, fail, ex, total:chosen.reduce((s,p)=>s+p.amtN,0)};
}

export function moreJ(){
  const m=me(), y=m.inc*12, A=v=>v.toLocaleString();
  return MORE.map((x,i)=>{ const r={...x};
    if(i===1){ if(m.own){r.j='no';r.why='✗ 본인 무주택이어야 해요';} else if(m.age<19||m.age>39){r.j='no';r.why=`✗ 만 19~39세 대상 · 지금 만 ${m.age}세`;} }
    if(i===2){ const bad=[]; if(m.age<19||m.age>34) bad.push(`✗ 만 19~34세 대상 · 지금 만 ${m.age}세`); if(y>7000) bad.push(`✗ 연소득 7천만 원 이하 · 지금 약 ${A(y)}만 원`); if(m.own) bad.push('✗ 무주택이어야 해요');
      if(bad.length){r.j='no';r.why=bad.join(' · ');} }
    if(i===3){ if(y>4000){r.j='no';r.why=`✗ 연소득 4천만 원 이하 · 지금 약 ${A(y)}만 원`;} else if(m.own||m.age>39){r.j='no';r.why=m.own?'✗ 무주택 세대주여야 해요':`✗ 만 19~39세 대상`;} }
    if(i===5&&m.job==='대학생'){ r.j='ok'; r.ic='home'; r.end=[11,31]; r.kd='대학생 · 어르신 집에 저렴하게 거주'; r.why='✓ 대학(원)생 대상 · {NM}은 대학생'; }
    return r; });
}

export function whatifs(){
  const J=judge(), m=J.m, out={}, nm=p=>`${p.name} ${p.amtN||{molit:480,move:40,seoul:240}[p.id]}만 원`;
  const diff=(K,extra)=>{ const a=J.chosen.map(p=>p.id), b=K.chosen.map(p=>p.id);
    return {total:K.total, plus:K.chosen.filter(p=>!a.includes(p.id)).map(nm), minus:J.chosen.filter(p=>!b.includes(p.id)).map(nm).concat(extra||[])}; };
  const tgt=m.age<35?35:m.age<40?40:null;
  if(tgt){ const d=diff(judge({age:tgt}), tgt===35&&m.age<=34&&m.inc*12<=7000&&!m.own?['청년 전월세 대출보증 (만 34세까지)']:[]); if(d.plus.length||d.minus.length) out.age={label:`만 ${tgt}살이 되면`, ...d}; }
  if(J.chosen.some(p=>p.id==='molit')) out.income={label:'국토부 소득 조건이 안 맞으면', ...diff(judge({noMolit:true}))};
  const plus=[]; if(m.inc*12<=4000&&!m.own&&m.age<=39) plus.push('서울시 청년 임차보증금 이자지원 (연 2.0% 이자 지원)'); if(!m.own) plus.push('전세보증금반환보증 보증료 지원');
  const rentPol=J.chosen.filter(p=>p.id!=='move');
  if(plus.length||rentPol.length) out.jeonse={label:'전세로 계약하면', total:null, plus, minus:rentPol.length?[rentPol.map(p=>p.name).join('·')+' (월세 거주 조건)']:[]};
  return out;
}

export const QA = {
  loan1y:{q:'직장 다닌 지 1년 안 됐는데 전세대출 받을 수 있어요?',
    a:'받을 수 있어요. 재직 1년 미만이면 전년도 원천징수영수증 대신 급여명세서·재직증명서로 소득을 증빙하는 경우가 많아요[1]. 소득 계산 방법과 한도는 은행 심사마다 달라서, 대출 은행이나 주택도시기금에 꼭 확인해야 해요[1].',
    src:[['주택도시기금 대출 공통 규칙','재직 1년 미만이면 급여명세서·재직증명서 등으로 소득을 증빙하는 경우가 많음 (계산 방식·한도는 은행 심사 기준 확인 필요)']]},
  rent12:{q:'월세 지원은 왜 12개월 뒤에 끝나요?',
    a:'청년 월세 지원은 월 최대 20만 원을 최대 12개월 동안 주는 사업이에요[1]. 그래서 13개월째부터는 지원금 없이 월세를 내야 해서 한 달 부담이 늘어나요.',
    src:[['청년 월세 지원 · 지원 내용','월 최대 20만 원 · 12개월']], calc:'늘어나는 금액(월 13만 원)은 코드가 계산했어요.'},
  sh:{q:'청년주택은 왜 바로 못 들어가요?',
    a:'청년안심주택은 1년에 공고가 두 번 나와요. 올해 2차 공고는 7월 31일에 나왔고, 계약은 2027년 1월 4~6일, 입주는 2027년 2월 1일~3월 2일이에요[1]. 공고부터 입주까지 약 6개월이라, 다음 공고를 기다려야 해요. {NM}은 본인 월소득이 1인 기준 100%(약 457만 원) 이하라 3순위로 신청할 수 있어요[2].',
    src:[['2026년 2차 서울시 청년안심주택 입주자 모집공고 (SH, 2026.07.31)','계약 2027-01-04~01-06 · 입주 2027-02-01~03-02'],['같은 공고 · 입주자격','1·2순위 외, 본인 월평균소득 100% 이하 (1인가구 기준)']]},
  when:{q:'국토부 청년월세는 내년에 언제 신청해요?',
    a:'아직 2027년 공고는 나오지 않았어요. 올해는 3월 30일부터 5월 29일까지 주민센터 방문이나 복지로 온라인으로 접수했어요[1]. 관심 있는 지원은 [담기]로 저장해 두면 공고가 열렸을 때 바로 확인할 수 있어요.',
    src:[['(국토부) 2026 청년월세 지원 · 온통청년','신청기간 2026-03-30 ~ 2026-05-29 · 주민센터 방문 또는 복지로 온라인']]},
  deposit:{q:'전세로 하면 받을 수 있는 지원이 있어요?',
    a:'서울시 청년 임차보증금 이자지원이 있어요. 임차보증금의 90% 이내, 최대 2억 원 대출에 대해 서울시가 연 2.0% 이자를 지원해요[1]. 연소득 4천만 원 이하 무주택 세대주가 대상이고, 상시 신청할 수 있어요[1].',
    src:[['2026 서울시 청년 임차보증금 이자지원','임차보증금의 90% 이내, 최대 2억원 대출에 대해 서울시가 연 2.0% 이자 지원 · 연소득 4천만원 이하']]},
  dupRent:{q:'서울시 청년월세랑 국토부 청년월세 같이 받을 수 있어요?',
    a:'같이 받을 수 없어요. 둘 다 선정되면 서울주거포털에서 서울시 청년월세 지급중지를 신청하라고 안내하고 있어요[1]. 중지하면 이미 받은 돈은 돌려줘야 하고, 기한 안에 중지 신청을 안 하면 나중에 서울시 청년월세를 신청할 수 없어요[1]. 어느 쪽을 유지할지 고를 수 있는지는 청년월세지원센터(1833-2030)에 확인해야 해요.',
    src:[['서울주거포털 공지 · 중복 선정자 지급중지 신청 안내','기한까지 중지 신청을 하지 않으면 추후 서울시 청년월세 지원 사업 신청 불가 (선정 및 지급 이력 남음) · 지원중지 신청자는 기지급분 환수']]},
  seoulRent:{q:'역삼 집은 왜 서울시 청년월세가 안 돼요?',
    a:'서울시 청년월세는 보증금 8천만 원 이하, 월세 60만 원 이하인 집이어야 해요[1]. 월세가 60만 원을 넘어도 (보증금×5%÷12 + 월세)가 93만 원 이하면 신청할 수 있어요[2]. 역삼 집은 이 값이 약 94.2만 원이라 조건에서 빠져요.',
    src:[['2026 서울시 청년월세 지원 · 거주 요건','임차 보증금 8천만원 이하, 월세 60만원 이하 건물 월세 거주'],['같은 공고 · 예외','월세 60 초과여도 (보증금×5%/12 + 월세) ≤ 93만원이면 가능']],
    calc:'94.2만 원 = 1,000만 원 × 5% ÷ 12 + 90만 원 (코드 계산)'},
  age35:{q:'내년에 35살이 되면 못 받는 게 있어요?',
    a:'국토부 청년월세는 만 19~34세가 대상이라 35살이 되면 빠져요[1]. 대신 서울시 청년월세는 만 39세까지라 신청할 수 있어요[2]. 그래서 받을 수 있는 금액이 최대 520만 원에서 280만 원으로 줄어요.',
    src:[['(국토부) 2026 청년월세 지원','19~34세 독립거주 무주택 청년'],['2026 서울시 청년월세 지원','신청일 기준 만 19~39세']], calc:'520만 원 → 280만 원은 코드가 계산했어요.'},
  move:{q:'이사비 지원은 누가 받을 수 있어요?',
    a:'만 19~39세 무주택 청년이 서울로 전입하거나 서울 안에서 이사하고 전입신고를 마치면 받을 수 있어요[1]. 거래금액 2억 원 이하 집이어야 하고, 실제로 낸 중개보수와 이사비를 합쳐 최대 40만 원까지 받아요. 생애 1회예요[1].',
    src:[['2026 서울시 청년 부동산 중개보수 및 이사비 지원','2024-01-01 이후 서울시로 전입 또는 서울시 내 이사 후 전입신고 완료 · 거래금액 2억원 이하 · 최대 40만원']]},
  none:{q:'',
    a:'공고문에서 근거를 찾지 못했어요. 확실하지 않은 내용은 답하지 않아요. 국토교통부 「찾아가는 청년주거 상담소」에서 직접 상담받을 수 있어요[1].',
    src:[['찾아가는 청년주거 상담소 · 온통청년','대상: 주거정책에 관심있는 청년']], miss:true}
};

export function matchQ(t){
  const has=r=>r.test(t);
  if(has(/1년|재직|신입|입사/)) return 'loan1y';
  if(has(/중복|같이|둘 ?다|동시/)) return 'dupRent';
  if(has(/전세|이자|보증금/)) return 'deposit';
  if(has(/역삼|60만|월세 ?[6-9]\d ?만|서울시.*(안|못)/)) return 'seoulRent';
  if(has(/35|나이/)) return 'age35';
  if(has(/언제|기간|내년|공고/)) return 'when';
  if(has(/12개월|끝나|종료/)) return 'rent12';
  if(has(/청년주택|안심주택|SH|대기|입주/)) return 'sh';
  if(has(/이사비|이사/)) return 'move';
  if(has(/대출|버팀목/)) return 'loan1y';
  return 'none';
}

export let API_OK = null;

export function apiCheck(){
  if(!location.protocol.startsWith('http')){ API_OK=false; return; }
  fetch('/api/health').then(r=>r.ok?r.json():null).then(j=>{ API_OK=!!(j&&j.ok); render(); }).catch(()=>{ API_OK=false; });
}

export function apiProfile(){ const P=S.prof||{}, jobs=jobs1(); return {age:P.age||27, income_monthly:P.income, job:jobs.includes('대학생')?'대학생':jobs[0], homeless:S.own!=='있어요', area:{}}; }

export function apiAsk(q){
  return fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q, profile:apiProfile()})})
    .then(r=>r.ok?r.json():null).catch(()=>null);
}

export function ask3(q, k){   // q: 질문 문장 · k: 예시 질문 키 (서버가 없을 때 미리 넣어 둔 답)
  q=(q||'').trim(); if(!q) return;
  if(!location.protocol.startsWith('http')){ S.q3res=null; S.q3k=k||null; S.q3t=k?null:q; S.q3=k||matchQ(q); render(); return; }
  Object.assign(S,{q3:null, q3res:null, q3t:q, q3k:k||null, q3load:true}); render();
  apiAsk(q).then(r=>{ S.q3load=false; API_OK=!!r; if(r) S.q3res=r; else S.q3=k||matchQ(q); render(); });   // 서버가 늦게 켜져도 질문할 때마다 다시 시도
}

export const MORE = [
  {n:'2026 전월세 안심계약 도움서비스', ic:'home', o:'서울특별시', end:[11,31], j:'ok', why:'✓ 사회초년생 1인가구 · 집 계약 전에 받으면 좋아요', qt:'사회초년생 등 내 집 찾기가 어려운 1인가구에게 전월세 계약상담 및 집보기 동행 서비스', link:'https://housing.seoul.go.kr', site:'서울주거포털'},
  {n:'2026 청년안심주택 공급(매입)', ic:'building', o:'서울특별시', end:[11,31], j:'ok', why:'✓ 만 19~39세 · ✓ 서울 · ? 소득·자산은 서류 확인', qt:'공고일 기준 만 19~39세, 미혼, 본인 무주택', link:'https://soco.seoul.go.kr', site:'청년안심주택'},
  {n:'청년 전월세 대출보증', ic:'bank', o:'금융위원회', end:null, j:'ok', why:'✓ {AGE} (19~34세) · ✓ 연소득 {YINC} (7천만 원 이하) · ✓ 무주택', qt:'연소득 7천만원 이하인 만 19~34세 무주택 청년', link:'https://www.hf.go.kr', site:'한국주택금융공사'},
  {n:'서울시 청년 임차보증금 이자지원', o:'서울특별시 · 상시', j:'cond', why:'전세로 계약하면 해당 · 지금 월세 계획에선 해당 없음', qt:'임차보증금의 90% 이내, 최대 2억원 대출에 대해 서울시가 연 2.0% 이자 지원'},
  {n:'전세보증금반환보증 보증료 지원', o:'국토교통부 · 상시', j:'cond', why:'전세로 계약하면 해당 · 지금 월세 계획에선 해당 없음', qt:'유효한 전세보증금반환보증(HUG, HF, SGI)에 가입한 임차보증금 3억원 이하'},
  {n:'2026 청년과 어르신 주거공유', o:'서울특별시 · 12/31까지', j:'no', why:'✗ 대학(원)생 대상 · {NM}은 직장인', qt:'대학(원)생에게 주변 임대료보다 저렴하게 주거공간을 제공'},
  {n:'2026 청년 매입임대주택 사업', o:'서울특별시', j:'no', why:'✗ 접수 마감 (2026-06-30) · 내년 공고 확인', qt:'무주택 저소득 청년층에게 저렴하게 공급'}
];

export const ddayOf = e => e ? Math.round((new Date(2026,e[0],e[1]) - TODAY)/864e5) : null;

export const TODAY1 = SR.TODAY;              // 날짜 판단 기준 = 오늘 (YYYY-MM-DD)

export const GROUPS1 = [
  { id:'basic', title:'기본 정보', desc:'지원 대상에 해당하는지 확인해요.', fields:['age','job','own','sep'] },
  { id:'budget', title:'나의 예산', desc:'쓸 수 있는 돈과 수입을 알려 주세요.', fields:['cash','income'] },
  { id:'move', title:'이사·이동 조건', desc:'살고 싶은 집의 범위를 좁혀요.', fields:['place','time','when'] },
];
export const W1 = GROUPS1.flatMap(g => g.fields.map(k => SR.FIELDS.find(f => f.k === k))), F1K = Object.fromEntries(W1.map(f => [f.k, f])), NOW_Y = +TODAY1.slice(0,4);

// 기존 단일 job 값도 읽고, 학생 여부를 기존 지원 판정에 계속 전달해요.
export function jobs1(){ const P=S.prof||{};
  return [...new Set((Array.isArray(P.jobs) ? P.jobs : P.job ? [P.job] : []).filter(v => F1K.job.allowed.includes(v)))]; }

export function toggleJob1(value){
  if(!F1K.job.allowed.includes(value)) return;
  const jobs=jobs1(), next=jobs.includes(value) ? jobs.filter(v => v!==value) : [...jobs,value], P={...S.prof,jobs:next};
  if(next.length) P.job=next.includes('대학생') ? '대학생' : next[0]; else delete P.job;
  S.prof=P; render();
}

// 연도·월을 함께 저장해 연말을 넘어가도 입주 시기가 바뀌지 않아요.
export function whenDate1(value=(S.prof||{}).when){
  const match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value||'');
  if(match) return {year:match[1],month:String(+match[2])};
  const month=+TODAY1.slice(5,7), offset=value==='이번 달' ? 0 : value==='다음 달' ? 1 : null;
  if(offset!==null){ const date=new Date(NOW_Y,month-1+offset,1); return {year:String(date.getFullYear()),month:String(date.getMonth()+1)}; }
  const legacy=/^(\d{1,2})월$/.exec(value||'');
  return legacy && +legacy[1]>=1 && +legacy[1]<=12 ? {year:String(NOW_Y+(+legacy[1]<month ? 1 : 0)),month:String(+legacy[1])} : null;
}

export function whenParts1(){ const date=whenDate1(), d=D1();
  return {year:d.whenYear ?? date?.year ?? '',month:d.whenMonth ?? date?.month ?? ''}; }

function saveWhen1(parts, unknown=false){
  Object.assign(D1(),{whenYear:parts.year,whenMonth:parts.month});
  const P={...S.prof};
  if(unknown) P.when='아직 몰라요';
  else if(parts.year && parts.month) P.when=`${parts.year}-${parts.month.padStart(2,'0')}`;
  else delete P.when;
  S.prof=P; render();
}

export function setWhenPart1(key,value){
  if(!['year','month'].includes(key)) return;
  const parts={...whenParts1(),[key]:String(value)};
  if(!parts.year) parts.month='';
  if(parts.year===String(NOW_Y) && +parts.month<+TODAY1.slice(5,7)) parts.month='';
  saveWhen1(parts);
}

export function whenUnknown1(checked){ saveWhen1(whenParts1(),checked); }

export const YEARS1 = (([a,b]) => Array.from({length:b-a+1}, (_,i) => b-i))(F1K.age.years);   // 2010 → 1960

export const INC_LIMIT = MED1 * 1.5;   // 지원 소득 기준 안내 (판정 아님) · judge()의 inc150 과 같은 값

export const PLACES1 = (() => {        // 카카오 키가 없을 때 고를 수 있는 후보 (FIELDS 버튼 + KNOWN_PLACES)
  const m = new Map();
  F1K.place.opts.forEach(([n, v]) => m.set(n, {name:n, query:v.query, area:''}));
  Object.entries(SR.KNOWN_PLACES).forEach(([a, l]) => l.forEach(([n, q]) => m.has(n) ? (m.get(n).area = a) : m.set(n, {name:n, query:q, area:a})));
  return [...m.values()];
})();

export const D1 = () => S.d1 || (S.d1 = {});

export function done1(k){ const P = S.prof || {};
  if(k==='age' && S.d1?.yv != null) return false;
  return k==='own' ? !!S.own : k==='sep' ? !!S.sep : k==='place' ? !!(P.place && P.placeOk) : k==='job' ? jobs1().length>0 : k==='when' ? P.when==='아직 몰라요'||P.when==='3개월 안'||!!whenDate1() : P[k] != null; }

export const lbl1 = (k, v) => (F1K[k].opts.find(o => o[1]===v) || [v])[0];

export function val1(k){
  if(!done1(k)) return null; const P = S.prof;
  switch(k){
    case 'age': return P.birthYear ? `${P.birthYear}년생 (만 ${P.age}세)` : `만 ${P.age}세`;
    case 'place': return P.place;
    case 'cash': return won(P.cash);
    case 'income': return `월 ${won(P.income)}`;
    case 'time': return P.time >= 999 ? '상관없어요' : `${fmtMin(P.time)} 이내`;
    case 'job': return jobs1().map(v => lbl1('job',v)).join(' · ');
    case 'when': { const date=whenDate1(); return date ? `${date.year}년 ${date.month}월` : P.when==='아직 몰라요' ? '아직 미정' : P.when; }
    case 'own': return S.own;
    case 'sep': return {'네':'같아요', '아니요':'달라요', '모름':'잘 모르겠어요'}[S.sep] || S.sep;   // '부모님과 주소 · 같아요'처럼 라벨과 이어 읽혀요
    default: return lbl1(k, P[k]);
  }
}

export const all1 = () => W1.every(f => done1(f.k));

export const AGE_SPLIT1 = {};

export function ageSplit(y){
  if(y in AGE_SPLIT1) return AGE_SPLIT1[y];
  const a = NOW_Y - y, keep = {prof:S.prof, own:S.own, sep:S.sep};
  const sig = age => { S.prof = {age}; S.own = null; S.sep = null; return JSON.stringify([judge().list.map(p => p.st), moreJ().map(r => r.j || '')]); };
  let r; try { r = sig(a) !== sig(a - 1); } finally { Object.assign(S, keep); }
  return AGE_SPLIT1[y] = r;
}

export function year1(v, fid){ const y = +v || null, P = {...S.prof};
  if(!y){ delete P.birthYear; delete P.age; delete P.bday; }
  else { P.birthYear = y; P.bday = null; P.age = ageSplit(y) ? null : NOW_Y - y; }   // 경계 연도는 생일을 고를 때까지 빈 항목
  S.prof = P; render(); focusId(fid || 'f1-year'); }

export function bd1(v){ const y = S.prof.birthYear; S.prof = {...S.prof, bday:v, age: NOW_Y - y - (v==='before' ? 1 : 0)}; render(); focusId('f1-bd-' + v); }

export const srvPlace = () => location.protocol.startsWith('http') && !window._psfail;

export const liveOn1 = () => kakaoOn() || srvPlace();

export function placeHits(q){ const n = s => String(s || '').replace(/\s+/g, '').toLowerCase(), k = n(q), tk = String(q || '').split(/\s+/).filter(Boolean).map(n);
  if(!k) return PLACES1;
  return PLACES1.filter(p => { const all = n(p.name + p.area + p.query); return tk.every(t => all.includes(t)) || k.includes(n(p.name)); }); }

export const placeList1 = () => { const d = D1(), q = d.pq || '';   // 검색 결과가 있으면 맞는 후보(역삼 → 멀티캠퍼스 역삼·역삼역)를 앞에, 카카오 결과를 뒤에
  if(!(liveOn1() && q.trim() && d.kres)) return placeHits(q);
  const seen = new Set(); return [...placeHits(q), ...d.kres].filter(p => !seen.has(p.name) && seen.add(p.name)).slice(0, 12); };

export let _ptimer = null;

export function placeIn(v){ D1().pq = v; D1().kres = null; clearTimeout(_ptimer);
  if(liveOn1() && v.trim()){ _ptimer = setTimeout(() => kakaoOn() ? kakaoPlaces(v) : srvPlaces(v), 250); }
  render(); }

const currentPlaceQuery = q => D1().pq === q && (!done1('place') || D1().pedit);

export function srvPlaces(q){
  fetch('/api/place?q=' + encodeURIComponent(q)).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { if(!currentPlaceQuery(q)) return; D1().kres = (j.places || []).map(p => ({name:p.name, query:p.query, area:p.address, live:true})); })
    .catch(() => { window._psfail = true; })      // 서버 꺼짐·키 없음 → 후보 목록으로
    .finally(() => render());
}

export function kakaoPlaces(q){
  loadKakao().then(() => new kakao.maps.services.Places().keywordSearch(q, (r, st) => { if(!currentPlaceQuery(q)) return;
      D1().kres = st === kakao.maps.services.Status.OK ? r.slice(0, 8).map(x => ({name:x.place_name, query:x.road_address_name || x.address_name || x.place_name, area:x.road_address_name || x.address_name, live:true})) : [];
      render(); }, {size:8}))
    .catch(() => { window._kfail = true; render(); });
}

export function pickPlace1(j){ const p = placeList1()[j]; if(!p) return;
  // 닫히는 동안 보고 있던 결과를 유지해요. 다시 열면 새 검색을 시작해요.
  setDest(p.name, p.query); S.prof = {...S.prof, place:p.name, placeOk:true}; D1().pedit = false; clearTimeout(_ptimer);
  render(); focusId('f1-place-chg'); }

export function placeChange(){ Object.assign(D1(), {pedit:true, pq:'', kres:null}); render(); focusId('f1-pin'); }

export function placeKey(e){
  if(e.key==='Escape' && done1('place')){ D1().pedit = false; clearTimeout(_ptimer); render(); return focusId('f1-place-chg'); }
  if(e.key !== 'Enter' || e.isComposing) return; e.preventDefault(); if(placeList1().length) pickPlace1(0); }

export const digits1 = s => String(s || '').replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 6);

export function numStr1(k){ const d = D1(), P = S.prof || {};
  if(k==='cash') return d.cashV != null ? d.cashV : P.cash != null ? String(P.cash) : '';
  return d.incV != null ? d.incV : P.incomeInput ? String(P.incomeInput.amount) : P.income != null ? String(P.income) : ''; }

export const incMode1 = () => D1().incMode || (S.prof.incomeInput || {}).mode || '월';

export const monthly1 = () => { const v = numStr1('income'); return v === '' ? null : incMode1()==='연' ? Math.round(+v / 12) : +v; };

export function save1n(k){ const P = {...S.prof}, v = numStr1(k);
  if(k==='cash'){ const ok = v !== '' && +v <= F1K.cash.range[1]; if(ok) P.cash = +v; else delete P.cash; }
  else { const m = monthly1(), ok = m != null && m <= F1K.income.range[1];
    if(ok){ P.income = m; P.incomeInput = {mode: incMode1(), amount: +v}; } else { delete P.income; delete P.incomeInput; } }
  S.prof = P; }

export function mode1(m){ if(incMode1() === m) return; D1().incMode = m; save1n('income'); render(); focusId('f1-mode-' + m); }

export function roving1(){ document.querySelectorAll('#root [role="radiogroup"]').forEach(g => { const rs = [...g.querySelectorAll('[role="radio"]')];
  const c = rs.find(r => r.getAttribute('aria-checked') === 'true') || rs[0]; rs.forEach(r => { r.tabIndex = r === c ? 0 : -1; }); }); }
document.addEventListener('keydown', e => { const t = e.target; if(!t || !t.getAttribute || t.getAttribute('role') !== 'radio') return;
  const g = t.closest('[role="radiogroup"]'), d = {ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1}[e.key]; if(!g || !d) return;
  e.preventDefault(); const rs = [...g.querySelectorAll('[role="radio"]')]; rs[(rs.indexOf(t) + d + rs.length) % rs.length].focus(); });

export function demo1(){   // 시연·테스트용: 시연 인물 값으로 9개 채우기
  setDest('멀티캠퍼스 역삼', '서울 강남구 테헤란로 212');
  const date=whenDate1('다음 달');
  S.prof = {birthYear:1999, age:27, bday:null, job:'직장인', jobs:['직장인'], place:'멀티캠퍼스 역삼', placeOk:true, cash:2000, income:230, incomeInput:{mode:'월', amount:230}, time:45, when:`${date.year}-${date.month.padStart(2,'0')}`};
  S.own = '없어요'; S.sep = '네'; S.d1 = {}; render(); }

export const ADD1 = {cash: [[100, '+100만'], [500, '+500만'], [1000, '+1,000만'], [5000, '+5,000만']],
              월: [[10, '+10만'], [50, '+50만'], [100, '+100만']],
              연: [[100, '+100만'], [500, '+500만'], [1000, '+1,000만']]};

export const addList1 = k => k === 'cash' ? ADD1.cash : ADD1[incMode1()];

export const max1 = k => k === 'cash' ? F1K.cash.range[1] : F1K.income.range[1] * (incMode1() === '연' ? 12 : 1);

export const vKey1 = k => k === 'cash' ? 'cashV' : 'incV';

export function bump1(k){ const e = document.getElementById(`f1-${k}-n`); if(!e) return; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }

export function add1(k, n, j){ const cur = +numStr1(k) || 0; D1()[vKey1(k)] = String(Math.max(0, Math.min(max1(k), cur + n))); save1n(k); render(); focusId(`f1-${k}-a${j}`); bump1(k); }

export function clear1(k){ D1()[vKey1(k)] = ''; save1n(k); render(); focusId(`f1-${k}-n`); }

export const amtW1 = v => (Math.max(1, (v ? (+v).toLocaleString() : '0').length) * .62 + .2).toFixed(2) + 'em';   // 숫자 길이만큼만 (단위가 숫자 바로 뒤에)

export const Y_RANGE1 = F1K.age.years;

export function yearStep1(d){ const y = S.prof.birthYear, n = y ? y + d : NOW_Y - 27; year1(Math.max(Y_RANGE1[0], Math.min(Y_RANGE1[1], n)), d < 0 ? 'f1-year-m' : 'f1-year-p'); }

export const T_RANGE1 = [10, 90];

export const fmtMin = m => m >= 999 ? '상관없어요' : m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;

export const tPct1 = v => (v - T_RANGE1[0]) / (T_RANGE1[1] - T_RANGE1[0]) * 100;

export function pick1(k, v, id){ if(k === 'own') S.own = v; else if(k === 'sep') S.sep = v; else S.prof = {...S.prof, [k]: v}; render(); focusId(id); }

export const CARD1 = {
  own: [['없어요', '없어요', '청년 지원 대부분이 무주택 조건이에요'], ['있어요', '있어요', '무주택 조건인 지원은 받기 어려워요']],
  sep: [['네, 같아요', '네', '이사하며 세대 분리하면 돼요'], ['아니요', '아니요', '이미 따로 살아요'], ['잘 모르겠어요', '모름', '등본에서 확인할 수 있어요']]
};

export const won = SR.won, money = SR.money, KNOWN_PLACES = SR.KNOWN_PLACES, placeOpts = SR.placeOpts;

export function setDest(name, q){ DEST.name = name; DEST.addr = q; }

export const TODAY = (d => new Date(d.getFullYear(), d.getMonth(), d.getDate()))(new Date());   // 오늘 0시 · D-day 계산 기준

export const PCOL = {
  molit: {fg: '#1F5E4B', bg: '#E6EFEA', bd: '#B9D2C6', short: '국토부 월세'},
  move: {fg: '#5C6A1F', bg: '#EFF1E0', bd: '#D3D8B0', short: '이사비'},
  seoul: {fg: '#2D5F7A', bg: '#E7EFF4', bd: '#BCD0DC', short: '서울시 월세'},
  safe: {fg: '#8C5A00', bg: '#FBF0DA', bd: '#EBCF95', short: '안심계약 도움'},
  house: {fg: '#A0452A', bg: '#F8E9E3', bd: '#E6BFB1', short: '청년안심주택'},
  loan: {fg: '#5B49B0', bg: '#EEEBF8', bd: '#CFC7EE', short: '대출보증'}
};

export const CAL_EVENTS = [
  {id:'safe',  name:'전월세 안심계약 도움서비스 신청', s:[10,21], e:[11,31], kind:'warn'},
  {id:'house', name:'청년안심주택 공급(매입) 신청', s:[10,21], e:[11,31], kind:'pri'},
  {id:null,    name:'입주 예정일', s:[11,1], e:[11,1], kind:'me'},
  {id:null,    name:'전입신고 (입주 후 14일 안)', s:[11,1], e:[11,14], kind:'me'}
];


export function toggleAlarm(id){ set({alarm:S.alarm.includes(id)?S.alarm.filter(x=>x!==id):[...S.alarm,id]}); }

export const DEST = {name:'멀티캠퍼스 역삼', addr:'서울 강남구 테헤란로 212'};

export const HOMES = [
  {key:'A', label:'성수동 원룸', addr:'서울 성동구 성수동2가 333-76', station:'성수역 걸어서 8분', deposit:1000, rent:60, fee:7,
   fare:1550, commute:30, route:'2호선 · 환승 없음', x:546, y:82, color:'#B4501B'},
  {key:'B', label:'역삼동 원룸', addr:'서울 강남구 역삼동 778-26', station:'한티역 걸어서 15분', deposit:1000, rent:90, fee:10,
   fare:0, commute:13, route:'걸어서', x:420, y:262, color:'#2D6C8C'},
  {key:'C', label:'신림동 원룸', addr:'서울 관악구 신림동 502-36', station:'신대방역 걸어서 6분', deposit:500, rent:42, fee:null,
   fare:1650, commute:30, route:'2호선 · 환승 없음', x:112, y:246, color:'#7A4E9E'}
];

export const FAC = [
  {k:'station', label:'지하철역', icon:'train'}, {k:'mart', label:'대형마트', icon:'cart'}, {k:'super', label:'동네슈퍼', icon:'cart'},
  {k:'conv', label:'편의점', icon:'cart'}, {k:'pharm', label:'약국', icon:'pill'}, {k:'clinic', label:'내과', icon:'pill'},
  {k:'gym', label:'헬스장', icon:'gym'}, {k:'park', label:'공원', icon:'home'}
];

export const LIFE = {
  A:{station:['성수역',8], mart:['라성마트',10], super:['해태의집',8], conv:['세븐일레븐',1], pharm:['성수약국',3], clinic:['성수탑내과',6], gym:['라이프짐',1], park:['무지개어린이공원',1]},
  B:{station:['한티역',15], mart:['이마트 역삼점',10], super:['오아시스마켓',2], conv:['GS25',1], pharm:['유진약국',2], clinic:['연세기쁜내과',4], gym:['머스트무브짐',3], park:['역삼장미공원',2]},
  C:{station:['신대방역',6], mart:['하나로마트',17], super:['진흥마트',2], conv:['GS25',2], pharm:['일광약국',2], clinic:['최준호내과',3], gym:['짐엑스',2], park:['보라매공원',7]}
};

export const SCENES = {shop:{name:'장보기', f:['mart','super','conv']}, sick:{name:'아플 때', f:['pharm','clinic']}, move:{name:'운동·산책', f:['gym','park']}, go:{name:'역까지', f:['station']}};

export const PRIO = {
  bal:{name:'균형', w:{cost:.40, time:.35, life:.25}},
  money:{name:'돈이 먼저', w:{cost:.60, time:.25, life:.15}},
  time:{name:'시간이 먼저', w:{cost:.20, time:.60, life:.20}},
  life:{name:'동네 생활', w:{cost:.30, time:.20, life:.50}}
};

export const DAYS = 20;

export const MAX_HOMES = 3;

export const ADDR_RESULTS = {
  0:[['서울 성동구 성수동2가 333-76','지번 주소 · 건물 단위로 위치 확인',0],['서울 성동구 성수이로20길','길 이름만 있어요 · 건물 번호까지 넣어 주세요',null]],
  1:[['서울 강남구 역삼동 778-26','지번 주소 · 건물 단위로 위치 확인',1],['서울 강남구 역삼로','길 이름만 있어요 · 건물 번호까지 넣어 주세요',null]],
  2:[['서울 관악구 신림동 502-36','지번 주소 · 건물 단위로 위치 확인',2],['서울 관악구 신림로','길 이름만 있어요 · 건물 번호까지 넣어 주세요',null]]
};

export const ADDR_Q = {0:'성수동2가 333-76', 1:'역삼동 778-26', 2:'신림동 502-36'};

export const ODSAY_WEB_KEY = import.meta.env.VITE_ODSAY_KEY || 'ODSAY_KEY';   // ODsay에 웹 플랫폼(http://127.0.0.1:5500)으로 등록한 키. 없으면 그대로 두기

export const walkMin = d => Math.max(1, Math.round(d * 1.3 / 67));

export function kq(fn){ return new Promise(ok => fn((r, st) => ok(st === kakao.maps.services.Status.OK ? r : []))); }

export async function liveSearch(){
  const q = (S.addrQ || '').trim(); if(!q) return;
  set({liveBusy:'search', live:null, cand:null});
  await loadKakao();
  const geo = new kakao.maps.services.Geocoder(), ps = new kakao.maps.services.Places();
  const [ad, kw] = await Promise.all([kq(cb => geo.addressSearch(q, cb, {size:10})), kq(cb => ps.keywordSearch(q, cb, {size:5}))]);
  const out = ad.map(r => {
    const a = r.address || {}, road = r.road_address;
    const numbered = r.address_type === 'REGION_ADDR' || r.address_type === 'ROAD_ADDR';
    return {name: r.address_name, sub: road && road.address_name !== r.address_name ? road.address_name : (a.address_name || ''), x:+r.x, y:+r.y,
            dong: a.region_3depth_name || (road && road.region_3depth_name) || '', ok: numbered};
  }).concat(kw.map(r => ({name: r.address_name || r.road_address_name, sub: r.place_name + (r.road_address_name ? ' · ' + r.road_address_name : ''), x:+r.x, y:+r.y,
            dong: (r.address_name || '').split(' ').find(t => /[동가리]$/.test(t)) || '', ok: /\d/.test(r.address_name || '')})));
  set({liveBusy:null, live: out});
}

export async function nearest(loc, how){
  const ps = new kakao.maps.services.Places(), opt = {location: loc, radius: 2000, sort: kakao.maps.services.SortBy.DISTANCE};
  const r = how.code ? await kq(cb => ps.categorySearch(how.code, cb, opt)) : await kq(cb => ps.keywordSearch(how.kw, cb, opt));
  const hit = r.find(x => !how.must || how.must.some(m => (x.category_name + x.place_name).includes(m)));
  return hit ? [hit.place_name.replace(/^(.{0,14}).*$/, '$1'), walkMin(+hit.distance)] : ['2km 안에 없음', 30];
}

export async function commute(x, y){
  const d = await geocode(DEST.addr), dx = d.getLng(), dy = d.getLat();
  const dist = Math.hypot((x - dx) * 88200, (y - dy) * 111000);
  if(ODSAY_WEB_KEY !== 'ODSAY_KEY'){
    try{
      const j = await (await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?SX=${x}&SY=${y}&EX=${dx}&EY=${dy}&apiKey=${encodeURIComponent(ODSAY_WEB_KEY)}`)).json();
      if(j.result && j.result.path){ const i = j.result.path[0].info, sp = j.result.path[0].subPath.find(s => s.lane);
        const line = sp ? (sp.lane[0].name || sp.lane[0].busNo + '번 버스') : '대중교통';
        const tr = i.subwayTransitCount + i.busTransitCount - 1;
        return {commute: i.totalTime, fare: i.payment, route: `${line} · ${tr > 0 ? '환승 ' + tr + '번' : '환승 없음'}`}; }
      if(dist < 1500) return {commute: walkMin(dist), fare: 0, route: '걸어서'};
    }catch(e){}
  }
  if(dist < 1500) return {commute: walkMin(dist), fare: 0, route: '걸어서'};
  return {commute: Math.round(12 + dist / 1000 * 2.6), fare: 1550, route: '대중교통 · 거리로 추정', est: true};
}

export async function livePick(k){
  const r = S.live[k], slot = nextSlot(), base = HOMES[slot];
  set({liveBusy:'pick'});
  const loc = new kakao.maps.LatLng(r.y, r.x);
  const F = {station:{code:'SW8'}, mart:{code:'MT1'}, super:{kw:'슈퍼마켓', must:['슈퍼','마트']}, conv:{code:'CS2'}, pharm:{code:'PM9'},
             clinic:{code:'HP8', must:['내과','가정의학과']}, gym:{kw:'헬스장', must:['헬스','피트니스','짐']}, park:{kw:'공원', must:['공원']}};
  const life = {}; for(const [k2, how] of Object.entries(F)) life[k2] = await nearest(loc, how);
  const c = await commute(r.x, r.y);
  GEO[r.name] = loc;
  const cand = {...base, label: (r.dong || r.name.split(' ').slice(-2, -1)[0] || '후보') + ' 원룸', addr: r.name,
    station: `${life.station[0]} 걸어서 ${life.station[1]}분`, deposit: 1000, rent: 50, fee: null, ...c, live: true, life};
  set({liveBusy:null, cand});
}

export function addLive(){
  const g = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : undefined; };
  const slot = nextSlot(), c = S.cand;
  c.deposit = g('in-dep') ?? c.deposit; c.rent = g('in-rent') ?? c.rent; c.fee = g('in-fee') ?? null;   // 비워 두면 '확인 필요'
  HOMES[slot] = c; LIFE[c.key] = c.life; delete S.over[c.key];
  set({homes:[...S.homes, slot].sort(), cand:null, live:null, addrQ:'', adding:false});
}

export const val = (h, f) => (S.over[h.key] && S.over[h.key][f] !== undefined) ? S.over[h.key][f] : h[f];

export const fareMonth = h => Math.round(h.fare * 2 * DAYS / 1000) / 10;            // 만 원

export const feeOf = h => { const f = val(h, 'fee'); return f == null || f === '' || Number.isNaN(f) ? null : f; };

export const feeKnown = h => feeOf(h) != null;

export const monthly = h => Math.round((val(h,'rent') + (feeOf(h) || 0)) * 10) / 10;   // 한 달 확인된 비용 = 월세 + 확인된 관리비 (교통비는 참고 표시만, PRD v1.2 4절)

export const cheapest = H => { const K = H.filter(feeKnown); return K.length ? K.reduce((a, b) => monthly(a) <= monthly(b) ? a : b) : null; };   // 관리비 확인된 집 중에서만

export const clamp = v => Math.max(0, Math.min(100, v));

export const walkScore = m => clamp(100 * (20 - m) / 15);

// 생활 점수: 시설 8곳 도보시간의 walkScore 평균 (scores()의 life 항목과 같은 식)
export const lifeScore = h => Math.round(FAC.reduce((a, f) => a + walkScore(LIFE[h.key][f.k][1]), 0) / FAC.length * 10) / 10;

export const r1 = v => Math.round(v * 10) / 10;

export function scores(){      // 관리비 확인된 집이 먼저(점수순), 모르는 집(unk)은 뒤에 붙여요 — 화면에서는 순위 대신 '확인 필요'
  const H = hs(), K = H.filter(feeKnown), minC = Math.min(...(K.length ? K : H).map(monthly)), w = PRIO[S.prio].w;
  return H.map(h => {
    const cost = clamp(100 - (monthly(h) - minC) * 1.5);
    const time = clamp(100 - Math.max(0, h.commute - 15) * 2);
    const life = FAC.reduce((a, f) => a + walkScore(LIFE[h.key][f.k][1]), 0) / FAC.length;
    return {h, cost:Math.round(cost), time:Math.round(time), life:Math.round(life), total:Math.round(cost*w.cost + time*w.time + life*w.life), unk:!feeKnown(h)};
  }).sort((a, b) => (a.unk - b.unk) || (b.total - a.total));
}

export function reasons(rank){
  const out = [], top = rank[0].h, H = rank.map(r => r.h), K = H.filter(feeKnown);
  const cheap = K.length >= 2 ? cheapest(H) : null, fast = H.reduce((a, b) => a.commute <= b.commute ? a : b);
  const eun = s => s + ((s.charCodeAt(s.length-1) - 0xAC00) % 28 ? '은' : '는');
  const nm = h => h.label.replace(' 원룸', '').replace('동', '');
  if (top === cheap) out.push(`한 달 확인된 비용이 <b>${monthly(top)}만 원</b>으로 관리비까지 확인된 ${K.length}곳 중 가장 적어요.${val(top,'deposit') === Math.min(...H.map(h => val(h,'deposit'))) ? ` 보증금도 ${val(top,'deposit').toLocaleString()}만 원으로 처음 드는 목돈이 가장 적어요.` : ''}`);
  if (top === fast) out.push(`${DEST.name}까지 <b>${top.route === '걸어서' ? '걸어서 ' : ''}${top.commute}분</b>으로 가장 가까워요.`);
  K.forEach(a => K.forEach(b => { if (a !== b && monthly(a) > monthly(b) && a.commute >= b.commute)
    out.push(`${eun(nm(a))} ${nm(b)}보다 한 달 <b>${r1(monthly(a) - monthly(b))}만 원</b> 더 들지만, 오가는 시간은 ${a.commute === b.commute ? '같아요' : '더 길어요'} (${a.commute}분 vs ${b.commute}분).`); }));
  if (cheap && fast !== cheap && feeKnown(fast)) { const hrs = r1((cheap.commute - fast.commute) * 2 * DAYS / 60), extra = r1(monthly(fast) - monthly(cheap));
    if (hrs > 0) out.push(`${eun(nm(fast))} ${nm(cheap)}보다 한 달 ${extra}만 원 더 내고, 오가는 시간을 한 달 약 <b>${hrs}시간</b> 아껴요. 1시간에 약 ${r1(extra / hrs)}만 원인 셈이에요.`); }
  H.filter(h => !feeKnown(h)).forEach(h => out.push(`${eun(nm(h))} 관리비를 몰라서 순위에서 뺐어요. 관리비를 넣으면 다시 계산해요.`));
  return out;
}

export function weakness(h){
  const far = FAC.filter(f => LIFE[h.key][f.k][1] >= 15).map(f => `${f.label}(${LIFE[h.key][f.k][0]})까지 걸어서 약 ${LIFE[h.key][f.k][1]}분`);
  return far.length ? far.join(', ') + '이라 조금 멀어요.' : '';
}

export function nextSlot(){ return [0,1,2].find(i=>!S.homes.includes(i)); }

export function addHome(i){
  const g = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : undefined; };
  const o = {}; const d = g('in-dep'), r = g('in-rent'), f = g('in-fee');
  if (d !== undefined) o.deposit = d; if (r !== undefined) o.rent = r; o.fee = f !== undefined ? f : null;   // 비워 두면 '확인 필요'
  S.over[HOMES[i].key] = o;
  set({homes:[...S.homes,i].sort(), parsed:null, addrQ:'', adding:false});
}

export function homeVis(){ const v={}; S.homes.forEach(i=>v[HOMES[i].key]='on'); if(S.parsed!==null&&S.parsed!==undefined) v[HOMES[S.parsed].key]='ghost'; return v; }

export const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY || 'JS_KEY';

export const kakaoOn = () => KAKAO_JS_KEY !== 'JS_KEY' && location.protocol.startsWith('http') && !window._kfail;

export const GEO = {};   // 주소 → 좌표 캐시

export let _kvis = null, _kloading = null;
export const setKvis = v => { _kvis = v || null; };

export function loadKakao(){
  if(window.kakao && kakao.maps && kakao.maps.services) return Promise.resolve();
  if(_kloading) return _kloading;
  _kloading = new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    sc.onload = () => kakao.maps.load(ok);
    sc.onerror = () => fail();
    document.head.appendChild(sc);
  });
  return _kloading;
}

export function geocode(addr){
  if(GEO[addr]) return Promise.resolve(GEO[addr]);
  return new Promise((ok, fail) => new kakao.maps.services.Geocoder().addressSearch(addr, (r, st) => {
    if(st === kakao.maps.services.Status.OK){ GEO[addr] = new kakao.maps.LatLng(r[0].y, r[0].x); ok(GEO[addr]); return; }
    new kakao.maps.services.Places().keywordSearch(addr, (r2, st2) => {      // 역·건물 이름이면 장소 검색으로
      if(st2 === kakao.maps.services.Status.OK){ GEO[addr] = new kakao.maps.LatLng(r2[0].y, r2[0].x); ok(GEO[addr]); } else fail(addr); });
  }));
}

export async function drawKakao(){
  const el = document.getElementById('kmap'); if(!el) return;
  try { await loadKakao(); } catch(e){ window._kfail = true; render(); return; }
  let vis = _kvis; if(!vis){ vis = {}; S.homes.forEach(i => vis[HOMES[i].key] = 'on'); }
  const map = new kakao.maps.Map(el, { center: new kakao.maps.LatLng(37.52, 127.0), level: 8 });
  const bounds = new kakao.maps.LatLngBounds();
  const dest = await geocode(DEST.addr); bounds.extend(dest);
  new kakao.maps.Marker({ map, position: dest });
  new kakao.maps.CustomOverlay({ map, position: dest, yAnchor: 2.8, content: `<div class="kpin dest">★ 자주 가는 곳 · ${DEST.name}</div>` });
  const shown = HOMES.filter(h => vis[h.key]);
  for(const h of shown){
    const p = await geocode(h.addr); bounds.extend(p);
    const op = vis[h.key] === 'ghost' ? .45 : 1, t = (h.route === '걸어서' ? '걸어서 ' : '') + h.commute + '분' + (h.route === '걸어서' ? '' : ' · ' + h.route.split(' · ')[0]);
    new kakao.maps.Marker({ map, position: p, opacity: op });
    new kakao.maps.CustomOverlay({ map, position: p, yAnchor: 1.7, content: `<div class="kpin" style="background:${h.color};opacity:${op}">${h.key} ${h.label} · ${t}</div>` });
    new kakao.maps.Polyline({ map, path: [p, dest], strokeWeight: 3, strokeColor: h.color, strokeOpacity: .8 * op, strokeStyle: 'dash' });
    new kakao.maps.Circle({ map, center: p, radius: 500, strokeWeight: 1, strokeColor: h.color, strokeOpacity: .5 * op, strokeStyle: 'dash', fillColor: h.color, fillOpacity: .06 * op });
  }
  if(shown.length) map.setBounds(bounds, 80, 80, 80, 80); else { map.setCenter(dest); map.setLevel(7); }
}

export const ROUTE = {
  A:{d:'M546 72 Q 615 170 510 244', lx:592, ly:168},
  B:{d:'M420 252 Q 452 290 486 258', lx:356, ly:250},
  C:{d:'M112 238 Q 300 330 486 258', lx:300, ly:286}
};

export function hs(){ return S.homes.map(i=>HOMES[i]); }

export function houseSupport(h){
  const J=judge(), by=Object.fromEntries(J.list.map(p=>[p.id,p])), d=val(h,'deposit'), r=val(h,'rent');
  const person=id=>by[id].st!=='no', pwhy=id=>by[id].why.join(', ');
  const sv=d*0.05/12+r, amt=d+r*100;
  const molit = person('molit') ? {ok:true, t:'월 '+Math.min(r,20)+'만 원 × 24개월'} : {ok:false, t:pwhy('molit')};
  let seoul;
  if(!person('seoul')) seoul={ok:false, t:pwhy('seoul')};
  else if(d>8000) seoul={ok:false, t:`보증금 8천만 원 초과 (이 집 ${d.toLocaleString()}만 원)`};
  else if(r>60 && sv>93) seoul={ok:false, t:`월세 60만 원 초과 · 보증금×5%÷12+월세 = ${r1(sv)}만 원 (93만 원 넘음)`};
  else seoul={ok:true, t:'월 '+Math.min(r,20)+'만 원 × 12개월'};
  if(seoul.ok && molit.ok){ seoul.dup=true; seoul.t='조건은 맞지만 국토부와 같이 못 받아요'; }
  const move = !person('move') ? {ok:false, t:pwhy('move')} : amt>20000 ? {ok:false, t:`거래금액 2억 원 초과 (환산 ${amt.toLocaleString()}만 원)`} : {ok:true, t:'중개보수 + 이사비 최대 40만 원'};
  const monthSup = molit.ok||seoul.ok ? Math.min(r,20) : 0;
  return {molit, seoul, move, monthSup, total:(molit.ok?Math.min(r,20)*24:seoul.ok?Math.min(r,20)*12:0)+(move.ok?40:0)};
}

export const walkPre = h => h.route === '걸어서' ? '걸어서 ' : '';

export const shortRoute = h => h.route === '걸어서' ? '걸어서' : h.route.split(' · ')[0];

export function jump(id){
  const el = document.getElementById(id); if (!el) return false;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 1400);
  return false;
}

export function openEdit(k, focusId){
  set({ editKey: k });
  setTimeout(() => { const box = document.getElementById('cmp-edit'); if (box) box.scrollIntoView({ block: 'nearest' });
    const i = document.getElementById(focusId || 'ed-dep'); if (i) i.focus(); }, 0);
}

export function saveEdit(k){
  const g = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : null; };
  const d = g('ed-dep'), r = g('ed-rent');
  S.over[k] = { ...(S.over[k] || {}), ...(d != null ? { deposit: d } : {}), ...(r != null ? { rent: r } : {}), fee: g('ed-fee') };   // 관리비를 비우면 '확인 필요'
  set({ editKey: null, cmpQ: [] });
}

export const nm3 = h => h.label.replace(' 원룸', '').replace(/동$/, '');

export const bat3 = w => { const c = String(w).charCodeAt(String(w).length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; };

export const ja3 = (w, a, b) => w + (bat3(w) ? a : b);                       // ja3('신림','이','') → 신림이

export const plain = t => String(t).replace(/<[^>]+>/g, '');

export function rankBy(k) { const s = S.prio; S.prio = k; const r = scores(); S.prio = s; return r; }

export function facts3() {      // AI에 넘기는 값 = 화면에 보이는 계산 결과 그대로 (AI는 이 밖의 숫자를 쓰면 안 돼요)
  const H = hs(), cash = me().cash, pct = v => Math.round(v * 100);
  const homes = H.map(h => {
    const s = houseSupport(h);
    return {
      name: nm3(h), label: h.label, deposit: val(h, 'deposit'), deposit_short: Math.max(0, val(h, 'deposit') - cash), rent: val(h, 'rent'), fee: feeOf(h), fee_known: feeKnown(h),
      monthly: monthly(h), transit_fare_month_ref: fareMonth(h), commute_min: h.commute, route: h.route, station: h.station,
      support_total: s.total, monthly_support: s.monthSup, monthly_after_support: r1(monthly(h) - s.monthSup),
      nearest: Object.fromEntries(FAC.map(f => [f.label, `${LIFE[h.key][f.k][0]} ${LIFE[h.key][f.k][1]}분`]))
    };
  });
  const pairs = [];
  H.forEach((a, i) => H.forEach((b, j) => {
    if (i < j) pairs.push({
      a: nm3(a), b: nm3(b), monthly_diff: r1(Math.abs(monthly(a) - monthly(b))), commute_diff_min: Math.abs(a.commute - b.commute),
      deposit_diff: Math.abs(val(a, 'deposit') - val(b, 'deposit')), commute_hours_month_diff: r1(Math.abs(a.commute - b.commute) * 2 * DAYS / 60)
    });
  }));
  const priorities = Object.fromEntries(Object.entries(PRIO).map(([k, p]) => [p.name, {
    weights: { 비용: pct(p.w.cost), 시간: pct(p.w.time), 생활: pct(p.w.life) },
    rank: rankBy(k).filter(r => !r.unk).map((r, i) => ({ rank: i + 1, home: nm3(r.h), total: r.total, cost_score: r.cost, time_score: r.time, life_score: r.life })),
    not_ranked_fee_unknown: rankBy(k).filter(r => r.unk).map(r => nm3(r.h))
  }]));
  return { dest: DEST.name, my_cash: cash, max_commute_wish: S.prof && S.prof.time < 999 ? S.prof.time : null, prio_now: PRIO[S.prio].name, priorities, homes, pairs,
    fee_rule: 'fee_known이 false인 집은 관리비를 몰라요. monthly는 월세만이라 가장 싸다고 말하면 안 되고, 순위에도 없어요.',
    reasons_now: reasons(scores()).map(plain), score_rule: '비용: 가장 싼 집 100점, 월 10만 원 비쌀 때마다 −15점 · 시간: 15분 이하 100점, 그 뒤 1분마다 −2점 · 생활: 시설 8곳 도보 거리 평균' };
}

export const OUT3 = /소음|층간|방음|채광|햇빛|해가|치안|안전|경사|언덕|곰팡이|벌레|집주인|수압|냄새|전망|넓|평수|면적|크기|구조|옵션|반려|강아지|고양이|주차|엘리베이터|몇\s*층|영업시간|야간|분위기/;

export const STEP2_3 = q => /신청|언제|공고|서류|자격|조건|기간|마감/.test(q) && /지원|청년월세|월세\s*지원|이사비|중개보수|대출|보증|안심/.test(q);

export function tmpl3(q) {      // 코드가 만드는 답 (서버가 없거나 AI 답이 검사에 걸릴 때)
  const H = hs(), rank = scores(), top = rank[0].h, pn = PRIO[S.prio].name, n = nm3;
  const by = (f, d) => H.slice().sort((a, b) => d * (f(a) - f(b)));
  const cheap = by(monthly, 1).filter(feeKnown), fast = by(h => h.commute, 1);   // 싸다는 비교는 관리비 확인된 집끼리만
  const unk = H.filter(h => !feeKnown(h)), unkNote = unk.length ? ` ${unk.map(h => ja3(n(h), '은', '는')).join(', ')} 관리비를 몰라서 월세만 알아요.` : '';
  const pos = h => rank.findIndex(r => r.h === h) + 1, sc = h => rank.find(r => r.h === h).total;
  const named = H.filter(h => q.includes(n(h)));
  const won = v => `${v.toLocaleString()}만 원`;
  if (STEP2_3(q)) return { kind: 'step2', text: '지원 조건과 신청 시기는 2단계에서 확인해 보세요. 공고문 근거로 답해 드려요.' };
  if (OUT3.test(q)) return { kind: 'out', text: '비교 결과에는 없는 내용이에요. 집 볼 때 직접 확인해 보세요.' };
  const pk = [['money', /돈|비용|싼|저렴/], ['time', /시간|출퇴근|통근|가까/], ['life', /생활|동네|편의/], ['bal', /균형/]].find(([k, re]) => re.test(q) && /먼저|중요|우선|기준|바꾸|바뀌|으로 하면|로 하면/.test(q));
  if (pk) {
    const r = rankBy(pk[0]);
    const rk = r.filter(x => !x.unk);
    if (!rk.length) return { kind: 'ok', text: `관리비를 아는 집이 없어서 순위를 정하지 않았어요.${unkNote}` };
    return { kind: 'ok', text: `'${PRIO[pk[0]].name}' 기준이면 ${rk.map((x, i) => `${i + 1}위 ${n(x.h)} ${x.total}점`).join(', ')}이에요.${pk[0] !== S.prio ? ` 지금은 '${pn}' 기준이라 ${ja3(n(top), '이', '가')} 1위예요.` : ''}${unkNote}` };
  }
  if (/지원\s*받|지원받|실제\s*부담|실부담.*지원/.test(q)) {
    const af = h => r1(monthly(h) - houseSupport(h).monthSup), s = by(af, 1), sk = s.filter(feeKnown);
    return { kind: 'ok', text: `지원을 받는다고 가정하면 한 달 비용은 ${s.map(h => `${n(h)} ${won(af(h))}${feeKnown(h) ? '' : ' + 관리비'}`).join(', ')}이에요.${sk.length ? ` 관리비까지 확인된 집 중에는 ${ja3(n(sk[0]), '이', '가')} 가장 적어요.` : ''}${unkNote}` };
  }
  if (/보증금/.test(q)) {
    const cash = me().cash, short = H.filter(h => val(h, 'deposit') > cash);
    return { kind: 'ok', text: `보증금은 ${H.map(h => `${n(h)} ${won(val(h, 'deposit'))}`).join(', ')}이에요. ${short.length ? short.map(h => `${ja3(n(h), '은', '는')} 모아둔 돈 ${won(cash)}보다 ${won(val(h, 'deposit') - cash)} 많아요.`).join(' ') : `모두 모아둔 돈 ${won(cash)} 안이에요.`}` };
  }
  const fac = FAC.find(f => q.includes(f.label) || (f.k === 'clinic' && /병원/.test(q)) || (f.k === 'station' && /지하철|역까지/.test(q)) || (f.k === 'mart' && /마트/.test(q) && !/동네/.test(q)) || (f.k === 'gym' && /헬스|운동/.test(q)));
  if (fac) return { kind: 'ok', text: `걸어서 가장 가까운 ${fac.label}: ${H.map(h => `${n(h)} ${LIFE[h.key][fac.k][0]} ${LIFE[h.key][fac.k][1]}분`).join(', ')}이에요.` };
  if (/가까|출퇴근|통근|빠른|오래\s*걸/.test(q) && named.length < 2) return { kind: 'ok', text: `${ja3(n(fast[0]), '이', '가')} ${DEST.name}까지 ${fast[0].route === '걸어서' ? '걸어서 ' : ''}${fast[0].commute}분으로 가장 가까워요. ${fast.slice(1).map(h => `${n(h)} ${h.commute}분`).join(', ')}이에요.` };
  if (/싸|싼|저렴|돈이?\s*(적|덜)|가장\s*적|실부담/.test(q) && named.length < 2) {
    if (!cheap.length) return { kind: 'ok', text: `관리비를 아는 집이 없어서 한 달 비용을 비교할 수 없어요.${unkNote}` };
    return { kind: 'ok', text: `한 달 확인된 비용(월세+관리비)은 ${ja3(n(cheap[0]), '이', '가')} ${won(monthly(cheap[0]))}으로 가장 적어요.${cheap.length > 1 ? ` ${cheap.slice(1).map(h => `${n(h)} ${won(monthly(h))}`).join(', ')}이에요.` : ''}${unkNote}` };
  }
  if (named.length >= 2 && !named.slice(0, 2).every(feeKnown)) {
    const [a, b] = named;
    return { kind: 'ok', text: `${named.slice(0, 2).filter(h => !feeKnown(h)).map(h => ja3(n(h), '은', '는')).join(', ')} 관리비를 몰라서 한 달 비용은 비교하지 않았어요. 월세는 ${n(a)} ${won(val(a, 'rent'))}, ${n(b)} ${won(val(b, 'rent'))}이고, 출퇴근은 ${n(a)} ${a.commute}분, ${n(b)} ${b.commute}분이에요.` };
  }
  if (named.length >= 2) {
    const [a, b] = monthly(named[0]) >= monthly(named[1]) ? named : [named[1], named[0]];
    const flip = Object.keys(PRIO).find(k => k !== S.prio && rankBy(k)[0].h === a && pos(a) > 1);
    return { kind: 'ok', text: `${ja3(n(a), '은', '는')} 한 달 ${won(monthly(a))}, ${ja3(n(b), '은', '는')} ${won(monthly(b))}으로 ${won(r1(monthly(a) - monthly(b)))} 차이예요. ${a.commute < b.commute ? `대신 ${ja3(n(a), '은', '는')} ${a.route === '걸어서' ? '걸어서 ' : ''}${a.commute}분, ${ja3(n(b), '은', '는')} ${b.commute}분이에요.` : `출퇴근은 ${n(a)} ${a.commute}분, ${n(b)} ${b.commute}분이에요.`}${flip ? ` '${PRIO[flip].name}'로 바꾸면 ${ja3(n(a), '이', '가')} 1위예요.` : ''}` };
  }
  const why = named[0] || (/왜|추천|1위|이유/.test(q) ? top : null);
  if (why) {
    const p = pos(why), first = !feeKnown(why) ? `관리비를 몰라서 월세 ${won(val(why, 'rent'))}만 알고` : cheap[0] === why && cheap.length > 1 ? `한 달 확인된 비용이 ${won(monthly(why))}으로 관리비까지 확인된 ${cheap.length}곳 중 가장 적고` : `한 달 확인된 비용은 ${won(monthly(why))}이고`;
    const t2 = fast[0] === why ? `${DEST.name}까지 ${why.commute}분으로 가장 가까워요` : `${DEST.name}까지 ${why.commute}분이에요`;
    return { kind: 'ok', text: `${ja3(n(why), '은', '는')} ${first}, ${t2}. ${feeKnown(why) ? `${pn} 기준 ${sc(why)}점으로 ${p}위예요.` : '관리비를 넣으면 순위에 들어가요.'}` };
  }
  return { kind: 'miss', text: `비교 결과에서 답을 찾지 못했어요. '왜 ${ja3(n(top), '이야', '야')}?', '두 집 차이는?'처럼 물어봐 주세요.` };
}

export function askCmp(q) {
  q = String(q || '').trim().slice(0, 200); if (!q) return;
  const t = tmpl3(q), item = { q };
  S.cmpQ = [...(S.cmpQ || []), item];
  const el = document.getElementById('cmp3q'); if (el) el.value = '';
  if (t.kind === 'step2' || t.kind === 'out') { Object.assign(item, { a: t.text, mode: t.kind }); render(); return; }
  if (!location.protocol.startsWith('http')) { Object.assign(item, { a: t.text, mode: 'code', why: 'off' }); render(); return; }
  item.load = true; render();
  fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, facts: facts3() }) })
    .then(r => r.ok ? r.json() : null).catch(() => null).then(r => {
      item.load = false;
      if (!(S.cmpQ || []).includes(item)) return;          // 그 사이 우선순위를 바꿔서 지워진 질문
      if (r && r.answer) Object.assign(item, { a: r.answer, mode: 'AI' });
      else Object.assign(item, { a: t.text, mode: 'code', why: r ? (r.reason || 'off') : 'off' });
      API_OK = !!r; S.cmpAiOff = !!(r && r.reason === 'off'); render();
    });
}

export const CH = [null, {no:'01', t:'내 조건'}, {no:'02', t:'받을 지원'}, {no:'03', t:'집 고르기'}];

export function topRank(){      // 03에서 관리비까지 확인된 집 중 1위 (없으면 null)
  if (!S.homesDone || S.homes.length < 2) return null;
  const r = scores().find(x => !x.unk); return r ? r.h : null;
}

export function chSum(n){
  if (n === 1) { const k = W1.filter(f => done1(f.k)).length; return k === W1.length ? `${W1.length}개 모두 채움` : `${k} / ${W1.length} 채움`; }
  if (n === 2) { const t = judge().total; return t ? `최대 ${t.toLocaleString()}만 원` : '받을 지원 없음'; }
  if (n === 3) { const k = S.homes.length; if (!k) return '아직 없음'; if (!S.homesDone || k < 2) return `${k}곳 넣는 중`;
    const h = topRank(); return h ? `${k}곳 · 1위 ${h.key} ${h.label.replace(' 원룸', '')}` : `${k}곳 · 관리비 확인 필요`; }
  return '';
}

export function chDone(n){
  if (n === 1) return all1();
  if (n === 2) return S.step > 2;
  if (n === 3) return S.homesDone && S.homes.length >= 2;
  return false;
}

export function copyText(txt, ids, msg){
  const done = () => ids.forEach(id => { const b = document.getElementById(id); if (b) { const o = b.textContent; b.textContent = msg; setTimeout(() => { b.textContent = o; }, 1500); } });
  const fallback = () => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
}

// 오늘 날짜 → '2026년 11월 21일' (파일 첫 줄) · '2026-11-21' (파일 이름)
const today = () => { const d = TODAY; return {ko: `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`, iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`}; };

// txt 꾸미기: 한글은 두 칸 너비로 세서 라벨 뒤 값의 시작 위치를 맞춰요 (고정폭 글꼴 기준)
const tw = s => [...String(s)].reduce((n, c) => n + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(c) ? 2 : 1), 0);
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - tw(s)));
const RULE = '─'.repeat(56), RULE2 = '═'.repeat(56);
const manW = v => `${Number(v).toLocaleString()}만 원`;
const CIRCLE = ['①', '②', '③', '④', '⑤', '⑥'];

// 복사하기와 txt 저장이 같이 쓰는 파일 내용
function fileText(){
  const J = judge(), P = S.prof || {}, L = [];
  const head = (no, t, right) => { L.push('', RULE, right ? pad(`${no}  ${t}`, 40) + right : `${no}  ${t}`, RULE); };
  const homesOk = S.homesDone && S.homes.length >= 2, R = homesOk ? scores() : [], top = R.find(r => !r.unk);

  L.push(RULE2, '  내 첫 집 파일', `  첫집 내비 · ${today().ko} 기준`, RULE2);

  // 한눈에 보기
  L.push('', '■ 한눈에 보기');
  L.push('  ' + pad('받을 수 있는 지원', 22) + (J.total ? `최대 ${manW(J.total)} (${J.chosen.length}개)` : '지금 조건으로는 없어요'));
  L.push('  ' + pad('먼저 볼 집', 22) + (top ? `${top.h.key} ${top.h.label} · 한 달 ${manW(monthly(top.h))}` : homesOk ? '관리비를 알면 순위를 매겨요' : '아직 비교 전'));
  L.push('  ' + pad('기준 장소', 22) + `${DEST.name}${P.time ? ` · 편도 ${P.time >= 999 ? '시간 상관없음' : fmtMin(P.time) + ' 이내'}` : ''}`);

  // 01 내 조건
  head('01', '내 조건');
  GROUPS1.forEach((g, gi) => {
    if (gi) L.push('');
    L.push(`[${g.title}]`);
    g.fields.forEach(k => L.push('  ' + pad(F1K[k].panel, 22) + (val1(k) || '아직 안 채움')));
  });

  // 02 받을 지원
  head('02', '받을 지원', J.total ? `합계 최대 ${manW(J.total)}` : '');
  if (J.chosen.length) {
    J.chosen.forEach((p, i) => {
      if (i) L.push('');
      L.push(`${CIRCLE[i] || '·'} ${p.name}  ─  최대 ${manW(p.amtN)}`);
      L.push('   ' + pad('받는 방식', 12) + p.how);
      L.push('   ' + pad('신청', 12) + p.channel);
      if (p.link) L.push('   ' + pad('사이트', 12) + `${p.site} ${p.link}`);
      if (p.last) L.push('   ' + pad('올해 접수', 12) + p.last.replace(/^올해 접수\s*/, ''));
    });
    L.push('');
    if (J.ex) L.push(`※ ${SR.josa(J.ex.name, '은는')} 국토부 청년월세와 같이 받을 수 없어서 합계에서 뺐어요.`);
    L.push('※ 실제 지급 금액은 신청할 때 서류로 정해져요.');
  } else L.push('지금 조건으로 받을 수 있는 지원이 없어요.');

  // 03 후보 집
  head('03', '후보 집', homesOk ? `${S.homes.length}곳 비교 · ${PRIO[S.prio].name}` : '');
  if (homesOk) {
    let n = 0;
    R.forEach((r, i) => { const h = r.h, dep = val(h, 'deposit'), gap = (P.cash || 0) - dep;
      if (i) L.push('');
      L.push(`${r.unk ? '–  ' : `${++n}위 `} ${h.key} ${h.label}${r.unk ? '  (관리비 확인 필요)' : `  · 종합 ${r.total}점`}`);
      if (h.addr) L.push('     ' + pad('주소', 20) + h.addr);
      L.push('     ' + pad('보증금', 20) + manW(dep) + (P.cash != null ? (gap >= 0 ? `  (모아둔 돈으로 충분 · ${manW(gap)} 남음)` : `  (모아둔 돈보다 ${manW(-gap)} 부족)`) : ''));
      L.push('     ' + pad('월세 + 관리비', 20) + `${manW(val(h, 'rent'))} + ${feeKnown(h) ? manW(feeOf(h)) : '확인 필요'}`);
      L.push('     ' + pad('한 달 확인된 비용', 20) + manW(monthly(h)) + (r.unk ? ' (관리비 빼고)' : ''));
      L.push('     ' + pad('이동 시간', 20) + `${DEST.name}까지 ${h.commute}분${h.route ? ` · ${h.route}` : ''}`);
      if (h.station) L.push('     ' + pad('가까운 역', 20) + h.station);
    });
    L.push('', '※ 한 달 확인된 비용 = 월세 + 확인된 관리비예요. 관리비를 모르는 집은 순위에서 뺐어요.');
  } else L.push('아직 후보 집을 비교하지 않았어요. 03 집 고르기에서 2곳 이상 넣어 보세요.');

  L.push('', RULE2, '  첫집 내비 · 처음 독립하는 서울 청년을 위한 주거 도우미', '  지원 자격과 금액은 각 공고문 기준이에요. 신청 전에 꼭 확인해 주세요.', RULE2);
  return fill(L.join('\n'));
}

export function copyFile(){ copyText(fileText(), ['file-copy'], '복사했어요'); }

// 브라우저 안에서 txt 파일을 만들어 바로 내려받아요 (서버를 거치지 않아요)
export function saveFile(){
  const blob = new Blob(['﻿' + fileText().replace(/\n/g, '\r\n')], {type: 'text/plain;charset=utf-8'});   // BOM·CRLF: 윈도우 메모장에서도 한글·줄바꿈이 안 깨지게
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `내-첫-집-파일-${today().iso}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(['file-save', 'file-save2'], '저장했어요');
}

const flash = (ids, msg) => ids.forEach(id => { const b = document.getElementById(id); if (b) { const o = b.textContent; b.textContent = msg; setTimeout(() => { b.textContent = o; }, 1500); } });

export const LP_RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function lpData(){
  const J = judge({age: 27, inc: 230, own: false, sep: false, sepQ: false, cash: 2000, job: '직장인'});
  const keep = {homes: S.homes, over: S.over, prio: S.prio}; let R;
  try { S.homes = [0, 1, 2]; S.over = {}; S.prio = 'bal'; R = scores(); } finally { Object.assign(S, keep); }
  return {J, R};
}

export function fill(h){
  const P = S.prof, age = P.age || 27, inc = P.income != null ? P.income : 230;
  const nm = '회원님';
  return h.replace(/\{NM\}/g, nm).replace(/\{AGE\}/g, `만 ${age}세`).replace(/\{INC\}/g, `월 ${inc.toLocaleString()}만 원`).replace(/\{YINC\}/g, `${(inc*12).toLocaleString()}만 원`);
}
