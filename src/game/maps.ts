// ============================================================
// AETHER LEAGUE - マップ定義 (リゾート / 戦場[メイン])
// 3レーン(トップ/ミッド/ボト) + ジャングル + 川 のスプライン道路システム
// ============================================================

import type { MapDef } from './types';

// ------------------------------------------------------------
// レーン経路 (青ネクサス(-42,42) → 赤ネクサス(42,-42))
// Catmull-Rom スプラインで滑らかに補間される
// ------------------------------------------------------------

export type LaneId = 'top' | 'mid' | 'bot';
export const LANE_IDS: LaneId[] = ['top', 'mid', 'bot'];
export const MAP_HALF = 58;

export const NEXUS_POS: Record<'blue' | 'red', { x: number; z: number }> = {
  blue: { x: -42, z: 42 },
  red: { x: 42, z: -42 },
};

const LANE_WAYPOINTS: Record<LaneId, { x: number; z: number }[]> = {
  // トップ: 西稜線 → 北稜線を大きく迂回
  top: [
    { x: -42, z: 42 }, { x: -51, z: 24 }, { x: -50, z: -4 }, { x: -44, z: -22 },
    { x: -30, z: -38 }, { x: -10, z: -48 }, { x: 12, z: -50 }, { x: 32, z: -48 }, { x: 42, z: -42 },
  ],
  // ミッド: 中心を緩やかなS字で貫くメインレーン
  mid: [
    { x: -42, z: 42 }, { x: -27, z: 33 }, { x: -15, z: 21 }, { x: -5, z: 10 },
    { x: 5, z: -7 }, { x: 14, z: -20 }, { x: 27, z: -32 }, { x: 42, z: -42 },
  ],
  // ボト: 南稜線 → 東稜線を大きく迂回
  bot: [
    { x: -42, z: 42 }, { x: -32, z: 48 }, { x: -12, z: 50 }, { x: 10, z: 49 },
    { x: 30, z: 44 }, { x: 44, z: 30 }, { x: 50, z: 4 }, { x: 50, z: -24 }, { x: 42, z: -42 },
  ],
};

// 川 (ミッドを横断する支流)
export const RIVER_WAYPOINTS: { x: number; z: number }[] = [
  { x: -50, z: -8 }, { x: -28, z: -4 }, { x: 0, z: 0 }, { x: 28, z: 6 }, { x: 50, z: 10 },
];

// ------------------------------------------------------------
// ステーションマップ: 高架を走る急行電車の直線ルート
// 西端 (-60, 30) → 東端 (60, -20) - 中央広場 (0, 4) 付近を横断
// ------------------------------------------------------------
export const STATION_RAIL = {
  x1: -60, z1: 30, x2: 60, z2: -20,
};
export const RAIL_LEN = Math.hypot(STATION_RAIL.x2 - STATION_RAIL.x1, STATION_RAIL.z2 - STATION_RAIL.z1);

/** 線路上の t(0-1) における座標 */
export function railPoint(t: number): { x: number; z: number } {
  const s = Math.max(0, Math.min(1, t));
  return {
    x: STATION_RAIL.x1 + (STATION_RAIL.x2 - STATION_RAIL.x1) * s,
    z: STATION_RAIL.z1 + (STATION_RAIL.z2 - STATION_RAIL.z1) * s,
  };
}

/** 線路の進行方向 (正規化済) */
export function railDir(): { x: number; z: number } {
  const l = RAIL_LEN || 1;
  return { x: (STATION_RAIL.x2 - STATION_RAIL.x1) / l, z: (STATION_RAIL.z2 - STATION_RAIL.z1) / l };
}

/** 点の線路(軌道面)への最短距離 */
export function distToRail(x: number, z: number): number {
  const dx = STATION_RAIL.x2 - STATION_RAIL.x1;
  const dz = STATION_RAIL.z2 - STATION_RAIL.z1;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - STATION_RAIL.x1) * dx + (z - STATION_RAIL.z1) * dz) / l2));
  const px = STATION_RAIL.x1 + dx * t;
  const pz = STATION_RAIL.z1 + dz * t;
  return Math.hypot(x - px, z - pz);
}

// ------------------------------------------------------------
// スプライン構築
// ------------------------------------------------------------

interface LaneData {
  pts: { x: number; z: number }[];
  cum: number[];
  total: number;
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function buildLane(id: LaneId): LaneData {
  const wp = LANE_WAYPOINTS[id];
  const pts: { x: number; z: number }[] = [];
  const SEG = 26;
  for (let i = 0; i < wp.length - 1; i++) {
    const p0 = wp[Math.max(0, i - 1)];
    const p1 = wp[i];
    const p2 = wp[i + 1];
    const p3 = wp[Math.min(wp.length - 1, i + 2)];
    for (let s = 0; s < SEG; s++) {
      const t = s / SEG;
      pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) });
    }
  }
  pts.push(wp[wp.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

const RIVER_DATA: LaneData = (() => {
  const pts: { x: number; z: number }[] = [];
  const SEG = 20;
  const wp = RIVER_WAYPOINTS;
  for (let i = 0; i < wp.length - 1; i++) {
    const p0 = wp[Math.max(0, i - 1)];
    const p1 = wp[i];
    const p2 = wp[i + 1];
    const p3 = wp[Math.min(wp.length - 1, i + 2)];
    for (let s = 0; s < SEG; s++) {
      const t = s / SEG;
      pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) });
    }
  }
  pts.push(wp[wp.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  return { pts, cum, total: cum[cum.length - 1] };
})();

const LANE_DATA: Record<LaneId, LaneData> = {
  top: buildLane('top'),
  mid: buildLane('mid'),
  bot: buildLane('bot'),
};

function sampleLane(d: LaneData, t: number): { x: number; z: number } {
  const tc = Math.max(0, Math.min(1, t)) * d.total;
  let lo = 0;
  let hi = d.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (d.cum[mid] <= tc) lo = mid; else hi = mid;
  }
  const segLen = d.cum[hi] - d.cum[lo] || 1;
  const f = (tc - d.cum[lo]) / segLen;
  const a = d.pts[lo];
  const b = d.pts[hi];
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
}

/** レーン上の t(0-1) における座標 */
export function lanePoint(t: number, lane: LaneId = 'mid'): { x: number; z: number } {
  return sampleLane(LANE_DATA[lane], t);
}

/** レーンの進行方向 (正規化済みタンジェント) */
export function laneTangent(t: number, lane: LaneId = 'mid'): { x: number; z: number } {
  const e = 0.008;
  const a = sampleLane(LANE_DATA[lane], Math.max(0, t - e));
  const b = sampleLane(LANE_DATA[lane], Math.min(1, t + e));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

/** 川上の t(0-1) における座標 */
export function riverPoint(t: number): { x: number; z: number } {
  return sampleLane(RIVER_DATA, t);
}

/** ミニマップ/道路メッシュ用の均一サンプル */
export const LANE_SAMPLES: Record<LaneId, { x: number; z: number }[]> = {
  top: Array.from({ length: 72 }, (_, i) => lanePoint(i / 71, 'top')),
  mid: Array.from({ length: 72 }, (_, i) => lanePoint(i / 71, 'mid')),
  bot: Array.from({ length: 72 }, (_, i) => lanePoint(i / 71, 'bot')),
};
export const RIVER_SAMPLES: { x: number; z: number }[] =
  Array.from({ length: 56 }, (_, i) => riverPoint(i / 55));

/** 全レーン経路のフラット配列 (地形の平坦化判定用) */
export const ALL_ROAD_POINTS: { x: number; z: number }[] = [
  ...LANE_SAMPLES.top, ...LANE_SAMPLES.mid, ...LANE_SAMPLES.bot, ...RIVER_SAMPLES,
];

// ------------------------------------------------------------
// 草むら (ジャングル限定・道には置かない)
// ※ ブロスタ風に各チェーン内で連結しつつ、数を絞って軽量化。
//   レーン + 川 + 壁から十分離れた座標のみ (自動検証済み)
// ------------------------------------------------------------

/** 点列をつなぐ連結草むら (各点に矩形+隣接点間の橋渡し矩形) */
function bushChain(points: [number, number][], w: number): { x: number; z: number; rx: number; rz: number }[] {
  const out: { x: number; z: number; rx: number; rz: number }[] = [];
  const half = w / 2 + 0.6;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    out.push({ x, z, rx: half, rz: half });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    out.push({
      x: mx, z: mz,
      rx: Math.max(Math.abs(x2 - x1) / 2, half),
      rz: Math.max(Math.abs(z2 - z1) / 2, half),
    });
  }
  return out;
}

// 72点 → 21点に削減 (描画負け対策) & 道路上からすべて撤去 (検証スクリプト済み)
const CHAINS: [number, number][][] = [
  // 北西ジャングル (川とミッドの間の沃地)
  [[-34, 4], [-27, 7], [-20, 10], [-21, 14]],
  // 南東ジャングル (川とミッドの間の沃地)
  [[22, -6], [30, -10], [36, -14]],
  // 北ジャングル (トップとミッドの間・レーン沿いは避ける)
  [[-26, -30], [-18, -33], [-8, -36], [2, -38], [10, -32]],
  // 南ジャングル (ボトとミッドの間)
  [[26, 30], [18, 33], [8, 36], [-2, 38], [-10, 32]],
  // 西の小さな茂み (トップレーンから離す)
  [[-42, 11], [-37, 10]],
  // 東の小さな茂み
  [[42, -11], [37, -10]],
];

const SHARED_BUSHES = CHAINS.flatMap((pts) => bushChain(pts, 5.0));

// ------------------------------------------------------------
// 廃坑マップ: 奈落の上に架かる橋 + 円形の岩棚 (足場)
// ここ以外に立っていると落下 (600ダメージ + 最寄りの足場へ戻される)
// ------------------------------------------------------------

/** 廃坑の足場 (岩棚) - 草むら・ニュートラル・ファウンテンを含む */
export const MINE_PLATFORMS = [
  { x: -42, z: 42, r: 10 },   // 青ネクサス + ファウンテン
  { x: 42, z: -42, r: 10 },   // 赤ネクサス + ファウンテン
  { x: 0, z: 0, r: 12 },      // 中央広場
  { x: -24, z: 8.5, r: 13 },  // 北西ジャングル棚
  { x: 20, z: -6, r: 9 },     // 東棚1
  { x: 32, z: -12, r: 8 },    // 東棚2
  { x: -20, z: -32, r: 9 },   // 北棚1 (ニュートラル)
  { x: -6, z: -36, r: 8 },    // 北棚2
  { x: 4, z: -35, r: 9 },     // 北棚3
  { x: 20, z: 32, r: 9 },     // 南棚1 (ニュートラル)
  { x: 6, z: 36, r: 8 },      // 南棚2
  { x: -4, z: 35, r: 9 },     // 南棚3
];

/** 廃坑の細い通路 (棚とレーンをつなぐ桟道) */
export const MINE_WALKWAYS = [
  { x1: -24, z1: 14, x2: -24, z2: 27, w: 2.8 },   // 北西棚 ↔ ミッド
  { x1: 20, z1: -12, x2: 20, z2: -24, w: 2.8 },   // 東棚 ↔ ミッド
  { x1: -20, z1: -38, x2: -20, z2: -43, w: 2.8 }, // 北棚1 ↔ トップ
  { x1: 4, z1: -42, x2: 4, z2: -47, w: 2.8 },     // 北棚3 ↔ トップ
  { x1: 20, z1: 38, x2: 20, z2: 43, w: 2.8 },     // 南棚1 ↔ ボト
  { x1: -4, z1: 42, x2: -4, z2: 47, w: 2.8 },     // 南棚3 ↔ ボト
];

/** 廃坑の草むら (足場の上のみ) */
export const MINE_BUSHES = bushChain(CHAINS[0], 5.0)
  .concat(bushChain(CHAINS[1], 5.0))
  .concat(bushChain(CHAINS[2], 5.0))
  .concat(bushChain(CHAINS[3], 5.0));

/** 廃坑のニュートラルモンスター位置 (足場の上) */
export const MINE_NEUTRAL_SPOTS = [{ x: -20, z: -32 }, { x: 20, z: 32 }];

/** レーン上の固定装飾を置くヘルパ */
function laneDecor(t: number, lane: LaneId, kind: import('./types').DecorDef['kind'], s?: number): import('./types').DecorDef {
  const p = lanePoint(t, lane);
  const tan = laneTangent(t, lane);
  return { kind, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, s, r: Math.round(Math.atan2(tan.x, tan.z) * 100) / 100 };
}

// ------------------------------------------------------------
// 壁 (ジャングルの遮蔽物・移動と弾を遮る) 共通レイアウト
// レーン・川・ファウンテン・草むらと干渉しない配置
// ------------------------------------------------------------

const SHARED_WALLS = [
  { x: -16, z: -16, w: 9, d: 3 },    // 北西ジャングル (横長)
  { x: 16, z: 16, w: 9, d: 3 },      // 南東ジャングル (横長)
  { x: -28, z: 16, w: 3, d: 9 },     // 西ジャングル (縦長)
  { x: 28, z: -18, w: 3, d: 9 },     // 東ジャングル (縦長)
  { x: -10, z: 40, w: 8, d: 3 },     // 南西 (ボト沿い内側)
  { x: 10, z: -40, w: 8, d: 3 },     // 北東 (トップ沿い内側)
  { x: 11, z: 10.5, w: 6, d: 2.6 },  // 中央南東 (広場の東南)
  { x: -11, z: -10.5, w: 6, d: 2.6 },// 中央北西 (広場の北西)
];

// ------------------------------------------------------------
// マップ定義
// ------------------------------------------------------------

export const MAPS: MapDef[] = [
  // ----------------------------------------------------------
  // 戦場 (メインマップ) - 朝霧の戦場
  // ----------------------------------------------------------
  {
    id: 'battlefield',
    name: '暁光のエーテル戦場',
    subtitle: 'BATTLEFIELD - DAWN',
    desc: '夜明けの光が割れた大地を照らす古戦場。朝霧の向こうから漏れるエーテル光と、3本のレーンに響く烽火。公式の主戦場。',
    main: true,
    groundColor: 0x50614e,
    groundAccent: 0x62745a,
    laneColor: 0x9a8763,
    fogColor: 0xffdcb0,
    fogDensity: 0.0062,
    skyTop: 0x3f74c4,
    skyBottom: 0x8fc8ee,
    skyHorizon: 0xffc48a,
    sunColor: 0xffdca8,
    ambientColor: 0x93a8c8,
    ambientIntensity: 0.8,
    sunDir: [-58, 26, -20],
    particle: 'spark',
    particleColor: 0xffd88a,
    particleCount: 380,
    river: { color: 0x3fb6d8 },
    bushes: SHARED_BUSHES,
    walls: SHARED_WALLS,
    decor: [
      { kind: 'tower-ruin', x: -24, z: -32, s: 1.2, r: 0.4 },
      { kind: 'tower-ruin', x: 26, z: 34, s: 1.2, r: -0.6 },
      { kind: 'pillar', x: -42, z: 32 },
      { kind: 'pillar', x: 42, z: -32 },
      { kind: 'banner', x: -16, z: 30, r: 0.9 },
      { kind: 'banner', x: -4, z: 18, r: 0.3 },
      { kind: 'banner', x: 16, z: -30, r: -0.9 },
      { kind: 'banner', x: 4, z: -18 },
      { kind: 'campfire', x: -30, z: -14 },
      { kind: 'campfire', x: 30, z: 16 },
      { kind: 'rubble', x: -46, z: 30, s: 1 },
      { kind: 'rubble', x: 46, z: -30, s: 1 },
      { kind: 'rubble', x: -2, z: -20, s: 0.8 },
      { kind: 'rubble', x: 2, z: 20, s: 0.8 },
      { kind: 'rock', x: -22, z: 44, s: 1.4 },
      { kind: 'rock', x: 22, z: -44, s: 1.4 },
      { kind: 'rock', x: -44, z: -14, s: 1.1 },
      { kind: 'rock', x: 44, z: 12, s: 1.1 },
      { kind: 'rock', x: -50, z: 34, s: 1 },
      { kind: 'rock', x: 50, z: -34, s: 1 },
      { kind: 'crystal', x: -34, z: -20, s: 1.3 },
      { kind: 'crystal', x: 34, z: 22, s: 1.3 },
      { kind: 'crystal', x: 0, z: -34, s: 1 },
      { kind: 'crystal', x: 0, z: 34, s: 1 },
      { kind: 'shard', x: -12, z: -8, s: 1 },
      { kind: 'shard', x: 12, z: 8, s: 1.1, r: 1.2 },
      { kind: 'shard', x: -38, z: 8, s: 0.9, r: 2.1 },
      { kind: 'shard', x: 38, z: -8, s: 0.95, r: 0.6 },
      { kind: 'lantern', x: -46, z: 48 },
      { kind: 'lantern', x: 46, z: -48 },
    ],
    gimmick: 'orbs',
    accentLights: [
      { x: -34, z: -20, color: 0x8a6aff, intensity: 20, dist: 24 },
      { x: 34, z: 22, color: 0x8a6aff, intensity: 20, dist: 24 },
      { x: -30, z: -14, color: 0xffb35c, intensity: 15, dist: 18 },
      { x: 30, z: 16, color: 0xffb35c, intensity: 15, dist: 18 },
      { x: 0, z: 0, color: 0x7ec8ff, intensity: 16, dist: 30 },
    ],
  },

  // ----------------------------------------------------------
  // 廃坑 - 奈落の上の木橋だけが戦場
  // 落ちると 600 ダメージ + 最寄りの足場へ戻される
  // ギミック: 暴走トロッコ / 銀鉱脈 (ゴールド) / 落下
  // ----------------------------------------------------------
  {
    id: 'mine',
    name: 'アビス・廃坑橋',
    subtitle: 'MINE - ABYSS',
    desc: '深い奈落の上に木橋が架かる廃坑マップ。橋から落ちると大ダメージ！ 暴走トロッコと輝く銀鉱脈が戦いをざわめかせる。足場の確認を忘れるな。',
    groundColor: 0x14101c,
    groundAccent: 0x1d1728,
    laneColor: 0x8a6a44,
    fogColor: 0x241c30,
    fogDensity: 0.0092,
    skyTop: 0x1a1034,
    skyBottom: 0x43265a,
    skyHorizon: 0xff8a5c,
    sunColor: 0xffb08a,
    ambientColor: 0x6a5588,
    ambientIntensity: 0.68,
    sunDir: [-40, 32, -18],
    particle: 'ember',
    particleColor: 0xff9a5c,
    particleCount: 260,
    bushes: MINE_BUSHES,
    walls: SHARED_WALLS,
    platforms: MINE_PLATFORMS,
    walkways: MINE_WALKWAYS,
    decor: [
      // 橋の上の坑木 (支柱フレーム)
      laneDecor(0.12, 'top', 'pitprop', 1),
      laneDecor(0.5, 'top', 'pitprop', 1),
      laneDecor(0.85, 'top', 'pitprop', 1),
      laneDecor(0.15, 'mid', 'pitprop', 1),
      laneDecor(0.82, 'mid', 'pitprop', 1),
      laneDecor(0.12, 'bot', 'pitprop', 1),
      laneDecor(0.5, 'bot', 'pitprop', 1),
      laneDecor(0.85, 'bot', 'pitprop', 1),
      // 脱線したトロッコ (背景小物)
      laneDecor(0.32, 'mid', 'cart'),
      laneDecor(0.68, 'mid', 'cart', 0.9),
      // 足場の上の提灯・クリスタル・岩
      { kind: 'lantern', x: -24, z: 8.5 },
      { kind: 'lantern', x: 20, z: -6 },
      { kind: 'lantern', x: -20, z: -32 },
      { kind: 'lantern', x: 20, z: 32 },
      { kind: 'lantern', x: 0, z: 0 },
      { kind: 'crystal', x: -6, z: -36, s: 1.1 },
      { kind: 'crystal', x: 6, z: 36, s: 1.1 },
      { kind: 'crystal', x: 32, z: -12, s: 0.9 },
      { kind: 'crystal', x: -4, z: 35, s: 0.9 },
      { kind: 'orevein', x: -29, z: 3 },
      { kind: 'orevein', x: 28, z: -6 },
      { kind: 'rock', x: -42, z: 36, s: 1.2 },
      { kind: 'rock', x: 42, z: -36, s: 1.2 },
      { kind: 'rock', x: -24, z: 3, s: 1 },
      { kind: 'rock', x: 24, z: -3, s: 1 },
      { kind: 'rubble', x: -20, z: -27, s: 0.9 },
      { kind: 'rubble', x: 20, z: 27, s: 0.9 },
      { kind: 'rubble', x: 4, z: 0, s: 0.8 },
      { kind: 'rubble', x: -4, z: 0, s: 0.8 },
    ],
    gimmick: 'mine',
    accentLights: [
      { x: -24, z: 8.5, color: 0xffb35c, intensity: 14, dist: 20 },
      { x: 20, z: -6, color: 0xffb35c, intensity: 14, dist: 20 },
      { x: -20, z: -32, color: 0x9a6aff, intensity: 16, dist: 20 },
      { x: 20, z: 32, color: 0x9a6aff, intensity: 16, dist: 20 },
      { x: 0, z: 0, color: 0xffb86a, intensity: 18, dist: 28 },
    ],
  },

  // ----------------------------------------------------------
  // リゾート
  // ----------------------------------------------------------
  {
    id: 'resort',
    name: 'サンリーフ・リゾート',
    subtitle: 'RESORT',
    desc: '永遠の夏が約束される楽園ビーチ。揺れる椰子の木と輝く海、島を流れる渓流の上で、爛漫のバトルを。',
    groundColor: 0xeed69e,
    groundAccent: 0xd8ba78,
    laneColor: 0xd2b284,
    fogColor: 0xffe6bc,
    fogDensity: 0.004,
    skyTop: 0x3f8fd8,
    skyBottom: 0x9ad2f8,
    skyHorizon: 0xffd8a8,
    sunColor: 0xfff0d0,
    ambientColor: 0xa8ccf0,
    ambientIntensity: 0.75,
    sunDir: [-50, 34, -14],
    particle: 'petal',
    particleColor: 0xffb0c8,
    particleCount: 300,
    river: { color: 0x2ac8e0 },
    bushes: SHARED_BUSHES,
    walls: SHARED_WALLS,
    decor: [
      { kind: 'palm', x: -36, z: 20, s: 1.2 },
      { kind: 'palm', x: 36, z: -18, s: 1.1, r: 2 },
      { kind: 'palm', x: -14, z: 36, s: 1.3 },
      { kind: 'palm', x: 14, z: -36, s: 1.2, r: 1 },
      { kind: 'palm', x: -52, z: -18, s: 1 },
      { kind: 'palm', x: 52, z: 24, s: 1.1, r: 2.4 },
      { kind: 'palm', x: -20, z: -40, s: 1.15, r: 0.8 },
      { kind: 'palm', x: 22, z: 40, s: 1.15, r: 1.7 },
      { kind: 'umbrella', x: -20, z: 30, r: 0.5 },
      { kind: 'umbrella', x: 20, z: -30, r: 2.5 },
      { kind: 'umbrella', x: -4, z: 26, r: 1.2 },
      { kind: 'umbrella', x: 6, z: -24, r: 0.2 },
      { kind: 'float', x: -14, z: -2 },
      { kind: 'float', x: 16, z: 4 },
      { kind: 'coral', x: -40, z: -24, s: 1.2 },
      { kind: 'coral', x: 40, z: 26, s: 1.1, r: 2 },
      { kind: 'coral', x: -30, z: 44, s: 0.9 },
      { kind: 'coral', x: 30, z: -44, s: 0.9, r: 1 },
      { kind: 'torch', x: -40, z: 36 },
      { kind: 'torch', x: 40, z: -36 },
      { kind: 'beachball', x: -10, z: 20, s: 1 },
      { kind: 'beachball', x: 10, z: -20, s: 0.8 },
      { kind: 'crab', x: -24, z: -6 },
      { kind: 'crab', x: 24, z: 8, r: 2 },
      { kind: 'crab', x: 0, z: -26, r: 4 },
      { kind: 'surf', x: -30, z: 18, r: 0.5 },
      { kind: 'surf', x: 28, z: -14, r: 2.2 },
      { kind: 'sign', x: -50, z: 44, r: 0.4 },
      { kind: 'lantern', x: -46, z: 48 },
      { kind: 'lantern', x: 46, z: -48 },
      { kind: 'crystal', x: 0, z: 0, s: 1.6 },
    ],
    gimmick: 'wave',
    water: { y: 0.02, color: 0x2ab8e8, size: [150, 150] },
    accentLights: [
      { x: -20, z: 30, color: 0xffb04d, intensity: 12, dist: 18 },
      { x: 20, z: -30, color: 0xffb04d, intensity: 12, dist: 18 },
      { x: 0, z: 0, color: 0x4fd1ff, intensity: 16, dist: 30 },
      { x: -40, z: -24, color: 0xff5c9d, intensity: 10, dist: 16 },
      { x: 40, z: 26, color: 0xff5c9d, intensity: 10, dist: 16 },
    ],
  },
  // ----------------------------------------------------------
  // ステーション - 夕暮れの終着駅
  // 高架線路を暴走する急行電車が最大の個性 (踏切警告→通過)
  // ----------------------------------------------------------
  {
    id: 'station',
    name: 'エクスプレス・ターミナル',
    subtitle: 'STATION - EXPRESS',
    desc: '夕暮れに沈む終着駅。駅舎の灯りと踏切の音が響くホームで、線路を爆走する急行電車が戦局を一変させる。線路に立ち止まるな。',
    groundColor: 0x4c4a56,
    groundAccent: 0x5c5a68,
    laneColor: 0x6a6478,
    fogColor: 0x2a2440,
    fogDensity: 0.0072,
    skyTop: 0x141a3c,
    skyBottom: 0x4a3a68,
    skyHorizon: 0xff9a5c,
    sunColor: 0xffb08a,
    ambientColor: 0x6a6a9a,
    ambientIntensity: 0.7,
    sunDir: [-46, 20, -30],
    particle: 'spark',
    particleColor: 0xffd88a,
    particleCount: 320,
    river: { color: 0x2a5a7a },
    bushes: SHARED_BUSHES,
    walls: SHARED_WALLS,
    decor: [
      { kind: 'platform', x: -22, z: 20, r: 0.9 },
      { kind: 'platform', x: 22, z: -14, r: -0.9 },
      { kind: 'crossgate', x: -34, z: 12 },
      { kind: 'crossgate', x: 34, z: -8 },
      { kind: 'signal', x: -12, z: 15, r: 0.4 },
      { kind: 'signal', x: 12, z: -8, r: -0.4 },
      { kind: 'bench', x: -20, z: 24, r: 0.9 },
      { kind: 'bench', x: 20, z: -18, r: -0.9 },
      { kind: 'bench', x: -2, z: 10, r: 0.2 },
      { kind: 'billboard', x: -30, z: -2, r: 0.8 },
      { kind: 'billboard', x: 30, z: 4, r: -0.8 },
      { kind: 'lantern', x: -46, z: 48 },
      { kind: 'lantern', x: 46, z: -48 },
      { kind: 'rock', x: -22, z: 44, s: 1.2 },
      { kind: 'rock', x: 22, z: -44, s: 1.2 },
      { kind: 'rubble', x: -46, z: 30, s: 1 },
      { kind: 'rubble', x: 46, z: -30, s: 1 },
      { kind: 'crystal', x: 0, z: 0, s: 1.4 },
    ],
    gimmick: 'trains',
    accentLights: [
      { x: -22, z: 20, color: 0xffd86a, intensity: 16, dist: 20 },
      { x: 22, z: -14, color: 0xffd86a, intensity: 16, dist: 20 },
      { x: -34, z: 12, color: 0xff4a5c, intensity: 10, dist: 14 },
      { x: 34, z: -8, color: 0xff4a5c, intensity: 10, dist: 14 },
      { x: 0, z: 0, color: 0x7ec8ff, intensity: 16, dist: 30 },
    ],
  },
];

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
