/* 화면 고르기: 처음 화면 → (01 → 3초 로딩 → 02 → 03)
   틀은 위 막대 · 왼쪽 목차 · 본문 · 오른쪽 패널 (쉬운 화면은 목차와 패널을 숨겨요) */
import { useEffect, useLayoutEffect } from 'react';
import { S, useStore, flushFocus } from './store.js';
import { roving1, drawKakao, apiCheck, DEST } from './lib/core.js';
import { Header, Footer, Rail, ProfileMini, AlarmPanel, FileSummary } from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Loading from './pages/Loading.jsx';
import Step1, { Side1, Banner1 } from './pages/Step1.jsx';
import Step2 from './pages/Step2.jsx';
import Step3 from './pages/Step3.jsx';

const BODY = [null, Step1, Step2, Step3];

/* 03 비교 화면(동네 지도 포함)은 후보 3곳과 항목명을 같이 읽어야 해서 오른쪽 패널을 빼고 본문을 넓혀요 */
const wide = () => !S.easy && S.step === 3 && S.homesDone && S.homes.length >= 2;

function Aside() {
  if (S.easy) return null;
  if (S.step === 1) return <Side1 />;
  if (S.step === 2) return <><AlarmPanel /><ProfileMini /></>;
  return <FileSummary />;
}

/* 카카오 지도는 지도 칸이 새로 생기거나 보여줄 집이 바뀔 때만 다시 그려요 */
const drawn = new WeakMap();
function syncKakao() {
  const el = document.getElementById('kmap'); if (!el) return;
  const sig = JSON.stringify([S.homes, S.parsed, S.cand && S.cand.addr, S.over, S.easy, DEST.addr]);
  if (drawn.get(el) === sig) return;
  drawn.set(el, sig); drawKakao();
}

/* 양옆 메뉴 · 스크롤 위치에 따라 부드럽게 따라와요
   맨 위: 본문 첫 줄과 나란히 → 중간: 헤더 아래에 붙어서 따라옴 → 맨 아래: 본문 끝에 맞춰 멈춤 (transition으로 살짝 늦게 따라와 움직임이 보여요) */
const HEAD = 60, GAP = 24;
function floatSides() {
  const main = document.getElementById('main'); if (!main) return;
  const top = main.getBoundingClientRect().top + scrollY, bottom = top + main.offsetHeight;
  document.querySelectorAll('.shell > .rail, .shell > .side').forEach(el => {
    if (getComputedStyle(el).position === 'static') {
      el.style.transform = '';
      return;
    }
    const max = Math.max(0, bottom - top - el.offsetHeight);
    const y = Math.min(max, Math.max(0, scrollY + HEAD + GAP - top));
    el.style.transform = y ? `translateY(${Math.round(y)}px)` : '';
  });
}
let raf = 0;
const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; floatSides(); }); };

export default function App() {
  useStore();
  useLayoutEffect(() => { flushFocus(); roving1(); syncKakao(); floatSides(); });   // 다 그린 뒤: 포커스 옮기기 · 버튼 그룹 Tab 자리 · 지도
  useEffect(() => { apiCheck(); }, []);
  useEffect(() => {
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
  }, []);

  if (S.home) return <Home />;
  if (S.loading) return <Loading />;
  const Body = BODY[S.step];
  return (
    <div className={`app ${S.easy ? 'easy' : 'responsive-shell'} ${S.ragShow ? 'show-rag' : ''}`}>
      <Header />
      <div className={`shell ${wide() ? 'wide' : ''}`}>
        {S.easy ? null : <Rail />}
        <main className="col" id="main"><Banner1 /><Body /></main>
        {wide() ? null : <aside className="side" aria-label="이 장의 도구"><Aside /></aside>}
      </div>
      <Footer />
    </div>
  );
}
