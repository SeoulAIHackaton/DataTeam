/* 화면 고르기: 처음 화면 → (01 → 3초 로딩 → 02 → 03 → 04)
   틀은 위 막대 · 왼쪽 목차 · 본문 · 오른쪽 패널 (쉬운 화면은 목차와 패널을 숨겨요) */
import { useEffect, useLayoutEffect } from 'react';
import { S, useStore, flushFocus } from './store.js';
import { roving1, drawKakao, apiCheck, hs, scores, DEST } from './lib/core.js';
import { Header, Footer, Rail, ProfileMini, AlarmPanel, TipsPanel, FileSummary } from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Loading from './pages/Loading.jsx';
import Step1, { Side1, Banner1 } from './pages/Step1.jsx';
import Step2 from './pages/Step2.jsx';
import Step3, { CmpAside } from './pages/Step3.jsx';
import Step4 from './pages/Step4.jsx';

const BODY = [null, Step1, Step2, Step3, Step4];

function Aside() {
  if (S.easy) return null;
  if (S.step === 1) return <Side1 />;
  if (S.step === 2) return <><AlarmPanel /><ProfileMini /></>;
  if (S.step === 3) return S.homesDone && S.homes.length >= 2 ? <CmpAside H={hs()} top={scores()[0].h} /> : <><TipsPanel /><ProfileMini /></>;
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

export default function App() {
  useStore();
  useLayoutEffect(() => { flushFocus(); roving1(); syncKakao(); });   // 다 그린 뒤: 포커스 옮기기 · 버튼 그룹 Tab 자리 · 지도
  useEffect(() => { apiCheck(); }, []);

  if (S.home) return <Home />;
  if (S.loading) return <Loading />;
  const Body = BODY[S.step];
  return (
    <div className={`app ${S.easy ? 'easy' : ''} ${S.ragShow ? 'show-rag' : ''}`}>
      <Header />
      <div className="shell">
        {S.easy ? null : <Rail />}
        <main className="col" id="main"><Banner1 /><Body /></main>
        <aside className="side" aria-label="이 장의 도구"><Aside /></aside>
      </div>
      <Footer />
    </div>
  );
}
