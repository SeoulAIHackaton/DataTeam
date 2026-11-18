/* 화면 상태 S 하나를 모든 곳이 같이 써요 (firsthome.html 과 같은 방식).
   set(p) = S에 덮어쓰고 다시 그리기 · render() = 그대로 다시 그리기 · React는 useStore()로 다시 그려요. */
import { useSyncExternalStore } from 'react';

export const S = {
  home: true, loading: false,
  step: 1, easy: false,
  own: null, sep: null,          // STEP1 answers
  msgs: [], prof: {}, placeAsk: null, qi: 0, redo: null, extra: [],
  easyQ: 0, toast: '',           // STEP1 easy question index · toast = 잠깐 떴다 사라지는 안내
  strategy: 'B', easyMore: false,
  open: 'rent', cmp: [], showCmp: false, whatif: null,
  ragShow: false, chat: false, log: [], q3: null, why2: null, judged: true, why4: null, alarm: [],
  pat: { commute: true, late: true, shop: false, sick: true, gym: false }, detail: null, prio: 'bal', over: {}, homes: [], homesDone: false, parsed: null, addrQ: '', adding: false, calM: 10
};

let ver = 0;
const subs = new Set();
export function render() { ver++; subs.forEach(f => f()); }
export function set(p) { Object.assign(S, p); render(); }

/* 잠깐 떴다 사라지는 안내(토스트) · 같은 걸 또 부르면 시간이 다시 시작돼요 */
export function showToast(msg) {
  S.toast = msg; S.toastN = (S.toastN || 0) + 1; render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { S.toast = ''; render(); }, 1800);
}
const subscribe = f => { subs.add(f); return () => subs.delete(f); };
const snap = () => ver;
export const useStore = () => useSyncExternalStore(subscribe, snap);

/* 장 이동 · 01 → 02 는 3초 로딩 화면을 거쳐요 (pages/Loading.jsx 가 끝나면 finishLoading) */
export function go(n) {
  if (S.step === 1 && n === 2 && !S.home && !S.loading) { set({ loading: true, detail: null, showCmp: false }); window.scrollTo(0, 0); return; }
  set({ step: n, detail: null, showCmp: false }); window.scrollTo(0, 0);
}
export function finishLoading() { set({ loading: false, step: 2, detail: null, showCmp: false }); window.scrollTo(0, 0); }

/* 다시 그린 뒤에 포커스 옮기기 (React는 다 그린 뒤에 화면이 바뀌어서, 그린 다음에 찾아요) */
let pendingFocus = null;
export function focusId(id) {
  if (id && typeof id !== 'string') { id.focus({ preventScroll: true }); return; }
  pendingFocus = id; setTimeout(flushFocus, 0);
}
export function flushFocus() {
  if (pendingFocus == null) return;
  const e = document.getElementById(pendingFocus); pendingFocus = null;
  if (e) e.focus({ preventScroll: true });
}
