/* 지도: 카카오 키가 있으면 진짜 지도(#kmap, App이 그린 뒤 drawKakao), 없으면 2호선 그림 지도 */
import { S, } from '../store.js';
import { HOMES, ROUTE, DEST, FAC, LIFE, SCENES, ICONS, kakaoOn, setKvis } from '../lib/core.js';

export function MapBox({ vis }) {
  if (!kakaoOn()) return <SeoulMap vis={vis} />;
  setKvis(vis);
  return <div id="kmap" />;
}

function HomePin({ h, mode }) {
  return (
    <g opacity={mode === 'ghost' ? .45 : 1}>
      <path d={`M${h.x} ${h.y} l-12 -18 a15 15 0 1 1 24 0 z`} fill={h.color} stroke="#fff" strokeWidth="1.5" />
      <text x={h.x - 5} y={h.y - 14} fontSize="13" fontWeight="800" fill="#fff">{h.key}</text>
    </g>
  );
}

export function SeoulMap({ vis }) {
  if (!vis) { vis = {}; S.homes.forEach(i => vis[HOMES[i].key] = 'on'); }
  const shown = HOMES.filter(h => vis[h.key]);
  const st = [[546, 116, '성수역', 8, -6, 'A'], [474, 227, '역삼역', -52, -6, 'B'], [112, 200, '신대방역', 10, -8, 'C']].filter(x => vis[x[5]]);   // 넣은 집의 역만 표시
  return (
    <svg viewBox="0 0 640 300" width="100%" className="map">
      <rect width="640" height="300" fill="#EFEDE6" />
      <path d="M0 150 C 140 118, 280 190, 420 150 S 600 128, 640 158" stroke="#d6e6f5" strokeWidth="22" fill="none" />
      <text x="14" y="138" fontSize="12" fill="#8aa9c8">한강</text>
      <ellipse cx="320" cy="150" rx="240" ry="100" fill="none" stroke="#3cb44a" strokeWidth="5" opacity=".7" />
      <line x1="16" y1="22" x2="40" y2="22" stroke="#3cb44a" strokeWidth="5" /><text x="48" y="26" fontSize="12" fill="#5B6460">2호선</text>
      {st.map(s => (
        <g key={s[2]}><circle cx={s[0]} cy={s[1]} r="6" fill="#fff" stroke="#3cb44a" strokeWidth="3" /><text x={s[0] + s[3]} y={s[1] + s[4]} fontSize="12" fontWeight="700" fill="#5B6460">{s[2]}</text></g>
      ))}
      {shown.map(h => {
        const r = ROUTE[h.key], lbl = (h.route === '걸어서' ? '걸어서 ' : '') + h.commute + '분' + (h.route === '걸어서' ? '' : ' · 2호선'), w = lbl.length * 7.4 + 16;
        return (
          <g key={h.key} opacity={vis[h.key] === 'ghost' ? .45 : 1}>
            <path d={r.d} fill="none" stroke={h.color} strokeWidth="2.5" strokeDasharray="6 5" />
            <rect x={r.lx - w / 2} y={r.ly - 12} width={w} height="22" rx="11" fill="#fff" stroke={h.color} />
            <text x={r.lx} y={r.ly + 3} fontSize="12" fontWeight="800" fill={h.color} textAnchor="middle">{lbl}</text>
          </g>
        );
      })}
      <circle cx="500" cy="252" r="15" fill="#fab005" stroke="#fff" strokeWidth="2" /><text x="500" y="258" fontSize="16" fill="#fff" textAnchor="middle">★</text>
      <text x="520" y="250" fontSize="12" fontWeight="800" fill="#1D2421">자주 가는 곳</text><text x="520" y="265" fontSize="12" fontWeight="700" fill="#434C48">{DEST.name}</text>
      {shown.length ? null : <text x="320" y="292" fontSize="12" fill="#5B6460" textAnchor="middle">집을 넣으면 자주 가는 곳까지 걸리는 시간이 선으로 표시돼요</text>}
      {shown.map(h => <HomePin key={h.key} h={h} mode={vis[h.key]} />)}
    </svg>
  );
}

function PinIcon({ x, y, name, on, col }) {
  const c = on ? (col || '#1F5E4B') : '#8C928E';
  return (
    <g transform={`translate(${x - 13},${y - 13})`} opacity={on ? 1 : .6}>
      <circle cx="13" cy="13" r="13" fill="#fff" stroke={c} strokeWidth="2" />
      <g transform="translate(5,5) scale(.667)" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
    </g>
  );
}

export function NeighMap({ h, scene }) {
  const hot = SCENES[scene].f, cx = 320, cy = 160, R = 130;   // 원 = 걸어서 10분 (중심에서 70 + 분×6)
  const pts = FAC.map((f, i) => {
    const m = LIFE[h.key][f.k][1], a = (i / FAC.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8, d = Math.min(175, 70 + m * 6);
    return { f, m, n: LIFE[h.key][f.k][0], x: cx + Math.cos(a) * d * 1.35, y: cy + Math.sin(a) * d * .78, left: Math.cos(a) < 0, on: hot.includes(f.k) };
  });
  return (
    <svg viewBox="0 0 640 320" width="100%" className="map">
      <rect width="640" height="320" rx="16" fill="#EFEDE6" />
      <g stroke="#fff" strokeWidth="12"><line x1="0" y1="160" x2="640" y2="160" /><line x1="320" y1="0" x2="320" y2="320" /></g>
      <g stroke="#fff" strokeWidth="6"><line x1="0" y1="70" x2="640" y2="70" /><line x1="0" y1="250" x2="640" y2="250" /><line x1="150" y1="0" x2="150" y2="320" /><line x1="490" y1="0" x2="490" y2="320" /></g>
      <ellipse cx={cx} cy={cy} rx={R * 1.35} ry={R * .78} fill={h.color} fillOpacity=".06" stroke={h.color} strokeOpacity=".5" strokeDasharray="6 5" />
      <text x="16" y="306" fontSize="12" fill="#5B6460">점선 = 걸어서 약 10분 · 거리는 직선거리 × 1.3으로 계산한 추정이에요</text>
      {pts.filter(p => !p.on).concat(pts.filter(p => p.on)).map(p => (
        <g key={p.f.k}>
          <PinIcon x={p.x} y={p.y} name={p.f.icon} on={p.on} col={h.color} />
          <text x={p.left ? p.x - 17 : p.x + 17} y={p.y + 4} textAnchor={p.left ? 'end' : 'start'} fontSize="12" fontWeight={p.on ? 800 : 500} fill={p.on ? '#1D2421' : '#8C928E'}>{p.n} {p.m}분</text>
        </g>
      ))}
      <HomePin h={{ ...h, x: cx, y: cy + 8 }} mode="on" />
    </svg>
  );
}

/* 오른쪽 패널용 그림 지도 (카카오 키가 없을 때) · 좌표는 SeoulMap과 같고 핀·선만 크게 */
export function MiniMap({ H }) {
  return (
    <svg viewBox="0 0 640 300" className="cmp-mini" role="img" aria-label={`후보 집 ${H.length}곳과 ${DEST.name} 위치 (그림 지도)`}>
      <rect width="640" height="300" fill="#EFEDE6" />
      <path d="M0 150 C 140 118, 280 190, 420 150 S 600 128, 640 158" stroke="#d6e6f5" strokeWidth="30" fill="none" />
      <ellipse cx="320" cy="150" rx="240" ry="100" fill="none" stroke="#3cb44a" strokeWidth="6" opacity=".35" />
      {H.map(h => <path key={h.key} d={ROUTE[h.key].d} fill="none" stroke={h.color} strokeWidth="6" strokeDasharray="16 12" />)}
      <circle cx="500" cy="252" r="28" fill="#1D2421" stroke="#fff" strokeWidth="5" /><path d="M500 234l5.3 10.8 11.9 1.7-8.6 8.4 2 11.8-10.6-5.6-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7z" fill="#fff" />
      {H.map(h => (
        <g key={h.key}><circle cx={h.x} cy={h.y} r="28" fill={h.color} stroke="#fff" strokeWidth="5" /><text x={h.x} y={h.y + 11} fontSize="30" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="sans-serif">{h.key}</text></g>
      ))}
    </svg>
  );
}
