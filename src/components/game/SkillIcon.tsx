'use client';

// ============================================================
// AETHER LEAGUE - スキルアイコン (スキルの「絵」)
// Q/E/R の文字の代わりに、スキル固有の SVG アイコンを表示する
// ============================================================

import type { ReactNode } from 'react';
import type { SkillGlyph } from '@/game/types';

/** 暗い色は白混ぜして視認性を確保 (黒発光スキル対策) */
function brighten(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const k = lum < 0.28 ? Math.max(amt, 0.55) : amt;
  const mix = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor', stroke: 'none' } as const;

/** 24x24 viewBox のスキルアイコン定義 (8キャラ x 3スキル) */
const GLYPHS: Record<SkillGlyph, ReactNode> = {
  // ---- ブレイズ (炎) ----
  'flame-thrust': (
    <>
      <path {...S} d="M3.5 20.5 L15 9" />
      <path {...F} d="M13.2 4.2 L19.8 2.6 L18.2 9.2 L14.6 7.8 Z" />
      <path {...S} d="M7.5 14.5 q-2.6 -2 -0.8 -4.4 q1.8 -2 1 -4.1 q3.4 1.6 2.6 4.6" />
      <path {...S} d="M10.5 17.5 q-1.8 -1.6 -0.4 -3.4" />
    </>
  ),
  'fire-cyclone': (
    <>
      <path {...S} d="M12 10.6 a3.4 3.4 0 1 1 -3.4 3.4 a6.2 6.2 0 1 0 6.2 -6.2" />
      <path {...F} d="M12 8.2 q1.8 -2.4 0.6 -4.6 q3.6 1.8 2.4 4.6 q-0.8 1.6 -3 1.4 Z" />
      <path {...S} d="M4 20.5 h4 M17 20.5 h3" opacity={0.6} />
    </>
  ),
  'blazing-slash': (
    <>
      <path {...S} strokeWidth={2.3} d="M3 21 Q11.5 15 20.5 3.5" />
      <path {...S} d="M15.5 8.5 l4 1.2 M17.5 5.5 l3.6 0 M13.5 11.5 l2.4 2.6" opacity={0.85} />
      <path {...S} d="M4.5 17.5 q3.5 2.5 8 2" opacity={0.55} />
    </>
  ),
  // ---- フロスト (氷) ----
  icicle: (
    <>
      <path {...S} d="M12 2.5 L15 11 L12 21.5 L9 11 Z" />
      <path {...S} d="M9 11 L5.5 14.5 L8 15.5 M15 11 L18.5 14.5 L16 15.5" opacity={0.8} />
      <path {...S} d="M12 6.5 v8" opacity={0.5} />
    </>
  ),
  'blizzard-ring': (
    <>
      <circle {...S} cx="12" cy="12" r="7" />
      <path {...S} d="M12 5 v3.2 M12 15.8 v3.2 M5 12 h3.2 M15.8 12 h3.2" opacity={0.9} />
      <path {...F} d="M12 10.4 l1.4 2.4 h-2.8 Z" />
      <path {...S} d="M7.5 7.2 l1.6 1.6 M16.5 7.2 l-1.6 1.6 M7.5 16.8 l1.6 -1.6 M16.5 16.8 l-1.6 -1.6" opacity={0.55} />
    </>
  ),
  'frozen-nova': (
    <>
      <path {...S} d="M12 3 v18 M4.2 7.5 l15.6 9 M4.2 16.5 l15.6 -9" />
      <path {...S} d="M12 6.4 l-2 -1.6 M12 6.4 l2 -1.6 M12 17.6 l-2 1.6 M12 17.6 l2 1.6" opacity={0.8} />
      <path {...S} d="M7 10.4 l-2.4 0.4 M17 13.6 l2.4 -0.4 M7 13.6 l-2.4 -0.4 M17 10.4 l2.4 0.4" opacity={0.8} />
      <circle {...F} cx="12" cy="12" r="1.7" />
    </>
  ),
  // ---- ボルト (雷) ----
  'thunder-claw': (
    <>
      <path {...F} d="M13.5 2 L6.5 13 h4.2 L8.8 22 L18.5 9.5 h-4.4 L16.6 2 Z" />
      <path {...S} d="M4 7.5 q1.6 1 3.4 1 M20 16.5 q-1.6 -1 -3.4 -1" opacity={0.7} />
    </>
  ),
  'lightning-dash': (
    <>
      <path {...S} strokeWidth={2.1} d="M4.5 5.5 L11 12 L4.5 18.5" />
      <path {...S} strokeWidth={2.1} d="M12.5 5.5 L19 12 L12.5 18.5" opacity={0.75} />
      <path {...F} d="M14.5 2.2 l3.2 -1 l-1.4 3.2 l1.8 0.6 l-4.6 3 l1.6 -2.8 l-2 -0.8 Z" />
    </>
  ),
  'thunder-god': (
    <>
      <circle {...S} cx="12" cy="12" r="3.4" />
      <path {...F} d="M12.6 9 L10 13 h1.8 L10.6 16.6 L14 12 h-1.9 L13.4 9 Z" />
      <path {...S} d="M12 3.2 v2.4 M12 18.4 v2.4 M3.2 12 h2.4 M18.4 12 h2.4 M5.8 5.8 l1.8 1.8 M16.4 16.4 l1.8 1.8 M18.2 5.8 l-1.8 1.8 M7.6 16.4 l-1.8 1.8" opacity={0.8} />
    </>
  ),
  // ---- テラ (土) ----
  'rock-throw': (
    <>
      <path {...S} d="M8.5 20.5 l-3 -4 2 -5 5.5 -1 4.5 3.5 -1.5 5 -4 1.5 Z" />
      <path {...S} d="M8 12.5 l3 2.5 M13 10.5 l1 4" opacity={0.55} />
      <path {...S} strokeDasharray="1.5 2.6" d="M3.5 6.5 q5.5 -4.5 12 -3.5" opacity={0.8} />
      <circle {...F} cx="18.5" cy="4.4" r="1.5" />
    </>
  ),
  'earth-shield': (
    <>
      <path {...S} d="M12 2.8 L19.2 5.6 v6 q0 5.4 -7.2 9.4 q-7.2 -4 -7.2 -9.4 v-6 Z" />
      <path {...S} d="M12 6.4 v10.4 M8 9.2 l4 -1.6 4 1.6" opacity={0.85} />
    </>
  ),
  'gravity-quake': (
    <>
      <path {...S} strokeWidth={2} d="M3 19 h4.4 l1.8 -2.6 1.8 2.6 2.6 -3.4 1.8 3.4 2.2 -1.8 H21" />
      <path {...S} strokeWidth={2.1} d="M12 3.4 v7.4 M8.6 7.6 L12 11 l3.4 -3.4" />
      <path {...S} d="M6 14.5 l1.6 -1.2 M18 14.5 l-1.6 -1.2" opacity={0.6} />
    </>
  ),
  // ---- ルミナ (光) ----
  'holy-ray': (
    <>
      <circle {...S} cx="16.4" cy="7.6" r="2.6" />
      <path {...S} strokeWidth={2.1} d="M13.6 10.4 L5 19" />
      <path {...S} d="M9.5 9.5 L4 11 M14.5 14.5 L13 20" opacity={0.75} />
      <path {...F} d="M5.6 15.6 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 Z" opacity={0.9} />
    </>
  ),
  'heal-wave': (
    <>
      <path {...S} d="M12 18.6 C6.8 14.6 5 11.4 6.6 8.9 q2.6 -3.4 5.4 0.6 q2.8 -4 5.4 -0.6 q1.6 2.5 -0.2 5.4" />
      <path {...S} d="M4 20 q2 -1.6 4 0 q2 1.6 4 0 q2 -1.6 4 0 q2 1.6 4 0" opacity={0.8} />
      <circle {...F} cx="17.6" cy="17.6" r="1.4" />
    </>
  ),
  'judgment-light': (
    <>
      <path {...S} d="M9 3.4 h6 M8 6.6 h8 M9.6 6.6 L8.4 17 h7.2 L14.4 6.6" />
      <path {...S} d="M12 17 v3.6 M9.4 20.6 h5.2" opacity={0.9} />
      <path {...S} d="M4.4 8.8 l2.2 1 M19.6 8.8 l-2.2 1" opacity={0.7} />
      <circle {...F} cx="12" cy="12.4" r="1.5" />
    </>
  ),
  // ---- シャドウ (闇) ----
  'triple-shuriken': (
    <>
      <path {...S} d="M12 2.8 l2.3 6.9 6.9 2.3 -6.9 2.3 -2.3 6.9 -2.3 -6.9 -6.9 -2.3 6.9 -2.3 Z" />
      <circle {...F} cx="12" cy="12" r="1.8" />
      <path {...S} d="M19 4.5 l1.8 -1.8 M20 8 l2 -0.6" opacity={0.6} />
    </>
  ),
  'shadow-step': (
    <>
      <ellipse {...S} cx="7.2" cy="16.8" rx="2.5" ry="1.7" transform="rotate(-38 7.2 16.8)" />
      <ellipse {...S} cx="12.4" cy="11.6" rx="2.2" ry="1.5" transform="rotate(-38 12.4 11.6)" opacity={0.72} />
      <ellipse {...S} cx="16.8" cy="7.2" rx="1.9" ry="1.3" transform="rotate(-38 16.8 7.2)" opacity={0.42} />
      <path {...S} strokeDasharray="1.4 2.4" d="M4 8 q4 -4 9 -3.4" opacity={0.6} />
    </>
  ),
  'dark-waltz': (
    <>
      <path {...S} d="M12 12 m-1.2 0 a1.2 1.2 0 1 1 1.2 1.2 a2.8 2.8 0 1 1 -2.8 -2.8 a4.6 4.6 0 1 0 4.6 4.6" />
      <circle {...F} cx="12" cy="12" r="0.9" />
      <path {...S} d="M19.5 5.5 l1.6 -1.6 M20.6 9.4 l2 -0.6 M3.6 18.6 l-1.8 1" opacity={0.55} />
    </>
  ),
  // ---- アクア (水) ----
  'bubble-shot': (
    <>
      <circle {...S} cx="9" cy="14.5" r="5" />
      <circle {...S} cx="17" cy="7.5" r="3" opacity={0.85} />
      <path {...S} d="M6.6 13.4 a3.4 3.4 0 0 1 2.4 -2.2" opacity={0.8} />
      <circle {...F} cx="18" cy="6.6" r="0.8" />
      <circle {...F} cx="20.6" cy="15.6" r="1.1" opacity={0.8} />
    </>
  ),
  'tide-burst': (
    <>
      <path {...S} d="M12 12 m-1.4 0 a1.4 1.4 0 1 1 1.4 1.4 a3.2 3.2 0 1 1 -3.2 -3.2 a5.4 5.4 0 1 0 5.4 5.4" />
      <path {...S} d="M17.8 4.6 q1.4 1.8 0 3.4 q-1.4 -1.6 0 -3.4 Z" />
      <path {...S} d="M4.6 17.6 q1.2 1.4 0 2.8 q-1.4 -1.4 0 -2.8 Z" opacity={0.8} />
    </>
  ),
  tsunami: (
    <>
      <path {...S} strokeWidth={2} d="M2.8 15.5 q1.2 -7.5 9.2 -7.5 q6.4 0 9.2 5.4" />
      <path {...S} d="M14.5 8.6 q2.8 0.8 3.6 3.6 q-2.4 -1.4 -4.4 -0.6" />
      <path {...S} d="M4 19 q2.4 -1.8 4.8 0 q2.4 1.8 4.8 0 q2.4 -1.8 4.8 0 q1.4 1 2.8 0.4" opacity={0.85} />
      <circle {...F} cx="8" cy="11.4" r="0.9" opacity={0.8} />
      <circle {...F} cx="10.6" cy="9.8" r="0.7" opacity={0.6} />
    </>
  ),
  // ---- ゲイル (風) ----
  'wind-arrow': (
    <>
      <path {...S} strokeWidth={2.1} d="M5 19 L17.5 6.5" />
      <path {...F} d="M13.4 4.6 L20.6 3.4 L19.4 10.6 L16.4 8.4 Z" />
      <path {...S} d="M3 13.5 q3.4 -0.6 5 1.4 M8 20 q2.6 -0.4 3.6 -2" opacity={0.7} />
    </>
  ),
  'gale-step': (
    <>
      <path {...S} d="M3.5 8.5 h9 a2.6 2.6 0 1 0 -2.4 -3.6" />
      <path {...S} d="M5 13 h13.5 a2.7 2.7 0 1 1 -2.6 3.4" />
      <path {...S} d="M7 17.5 h6" opacity={0.7} />
    </>
  ),
  'storm-arrows': (
    <>
      <path {...S} d="M6.5 3.5 q5.5 -1.5 11 0 l1.6 1.2 q-7.2 -1.6 -14.2 0 Z" opacity={0.75} />
      <path {...S} strokeWidth={1.6} d="M7.5 8.5 l-1.6 4 M7.5 8.5 l2 0.4 M7.5 8.5 l-0.4 2" />
      <path {...S} strokeWidth={1.6} d="M12.5 9.5 l-1.6 4.6 M12.5 9.5 l2 0.4 M12.5 9.5 l-0.4 2.2" />
      <path {...S} strokeWidth={1.6} d="M17 9 l-1.6 4.4 M17 9 l2 0.4 M17 9 l-0.4 2" />
      <path {...S} d="M4 20 h16" opacity={0.6} />
    </>
  ),
  // ---- フリル (水) ----
  'surprise-bomb': (
    <>
      {/* びっくり爆弾 (ぱかっと開いた球 + 火花) */}
      <circle {...S} cx="11.4" cy="13.6" r="5.6" />
      <path {...S} strokeWidth={1.5} d="M6.4 10.2 q5 -3.4 10 0" opacity={0.85} />
      <path {...F} d="M9 12.6 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 Z" opacity={0.9} />
      {/* 導火線 + 火花 */}
      <path {...S} strokeWidth={1.5} d="M14.8 8.6 q1.6 -2.4 3.8 -2.6" opacity={0.8} />
      <path {...F} d="M19.8 3.8 l0.6 1.5 1.5 0.6 -1.5 0.6 -0.6 1.5 -0.6 -1.5 -1.5 -0.6 1.5 -0.6 Z" opacity={0.9} />
      {/* びっくり線 */}
      <path {...S} strokeWidth={1.6} d="M3.2 5.4 l1.8 1.8 M4.6 2.8 l0.9 2.4 M2 4.2 l2.4 0.9" opacity={0.75} />
    </>
  ),
  'rage-burst': (
    <>
      {/* 怒り爆発: 衝撃波リング + 怒りマーク */}
      <circle {...S} cx="12" cy="12" r="3.2" opacity={0.95} />
      <path {...S} d="M12 4.4 v2.4 M12 17.2 v2.4 M4.4 12 h2.4 M17.2 12 h2.4" strokeWidth={1.8} />
      <path {...S} d="M6.6 6.6 l1.7 1.7 M15.7 15.7 l1.7 1.7 M17.4 6.6 l-1.7 1.7 M8.3 15.7 l-1.7 1.7" opacity={0.8} />
      <path {...F} d="M12 9.4 l0.7 1.5 1.5 0.7 -1.5 0.7 -0.7 1.5 -0.7 -1.5 -1.5 -0.7 1.5 -0.7 Z" />
    </>
  ),
  'nap-bed': (
    <>
      <path {...S} d="M3.5 19.5 v-4.6 q0 -1.4 1.4 -1.4 h14.2 q1.4 0 1.4 1.4 v4.6" />
      <path {...S} d="M5 13.5 v-2 q0 -1.2 1.2 -1.2 h11.6 q1.2 0 1.2 1.2 v2" opacity={0.8} />
      <circle {...S} cx="7.2" cy="16.8" r="1.5" opacity={0.9} />
      {/* 三日月 + Zzz (お昼寝) */}
      <path {...F} d="M15.4 3.2 q2.6 1 2.6 3.6 q0 2.4 -2.2 3.2 q1 -1.4 0.5 -3 q-0.5 -1.6 -2.2 -2.2 q0.7 -0.8 1.3 -1.6 Z" opacity={0.9} />
      <path {...S} d="M11.6 4.2 h2.6 l-2.6 3.4 h2.6" opacity={0.9} />
    </>
  ),
  // ---- パル (闇) ----
  'void-fang': (
    <>
      {/* 闇の牙 (三連の鋭い爪痕) */}
      <path {...S} strokeWidth={2} d="M5 5.5 L12.5 19 M10 4.5 L17.5 18 M15 4.5 L20.5 15" />
      <path {...F} d="M18.5 17.5 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 Z" transform="translate(-2 -4) scale(0.72)" />
      <path {...S} d="M4 21 h7" opacity={0.5} />
    </>
  ),
  'hound-call': (
    <>
      {/* 猟犬のシルエット + 召喚リング */}
      <path {...S} strokeWidth={1.6} d="M4 16.5 q0 -3.4 3.2 -4 l2.4 -2.2 q1.4 -3 4.6 -2.6 l.6 -2 1.6 2.4 q2.4 1.4 2.2 4.4 q-.2 2.6 -2.6 3.4" />
      <path {...F} d="M17.6 9.8 l1.4 -1.8 .3 2.2 Z" />
      <ellipse {...S} cx="11" cy="20" rx="7.5" ry="1.6" opacity={0.6} strokeDasharray="3 2.4" />
      <path {...F} d="M20.5 13.5 l.5 1.3 1.3 .5 -1.3 .5 -.5 1.3 -.5 -1.3 -1.3 -.5 1.3 -.5 Z" opacity={0.9} />
    </>
  ),
  'phantom-reap': (
    <>
      {/* 影の鎌 (大きな死神鎌) + 衝撃弧 */}
      <path {...S} strokeWidth={2} d="M6 20.5 q6 -3 8.5 -9 q1.8 -4.4 -.5 -8.5" />
      <path {...S} d="M14 3 q5.5 1.8 5.4 7.4 q-.1 4 -3.4 6.2" strokeWidth={1.6} />
      <path {...S} d="M3.5 12.5 q2.6 3.4 6.5 4.4" opacity={0.65} strokeDasharray="2.6 2" />
    </>
  ),
  // ---- アイゼン (土) ----
  'iron-smash': (
    <>
      {/* 大鉄鎚の振り下ろし + 地面衝撃 */}
      <path {...S} strokeWidth={2} d="M5 4.5 L15.5 15" />
      <rect {...F} x="12.6" y="9.4" width="7" height="7" rx="1" transform="rotate(45 16.1 12.9)" />
      <path {...S} d="M4 19.5 h5.4 M3 22 h4" opacity={0.8} />
      <path {...S} d="M12 21.5 h9" opacity={0.6} />
    </>
  ),
  'taunt-horn': (
    <>
      {/* 挑発の咆哮 (角笛 + 音波) */}
      <path {...S} strokeWidth={1.8} d="M4.5 10.5 L11 8 l0 8 -6.5 -2.5 Z M11 8 l7 -3 v14 l-7 -3" />
      <path {...S} d="M20.5 9 a5.4 5.4 0 0 1 0 6 M18.4 10.4 a3 3 0 0 1 0 3.2" opacity={0.85} />
    </>
  ),
  'fortress-wall': (
    <>
      {/* 城壁 (レンガ積み) + 盾紋 */}
      <path {...S} strokeWidth={1.7} d="M4 20 V8 l2.4 -1.8 v1.4 h3 V6.2 l2.6 -1.8 2.6 1.8 v1.4 h3 V6.2 L20 8 v12 Z" />
      <path {...S} strokeWidth={1.3} d="M4 13 h16 M10 8 v12 M15 8 v12 M6.8 13 v7 M17.6 13 v7" opacity={0.7} />
    </>
  ),
  // ---- ルーミー (光) ----
  'heart-beam': (
    <>
      {/* ハートビーム (光弾 + ハート) */}
      <path {...F} d="M12 17.5 c-3.2 -2.4 -5 -4.2 -5 -6.4 a2.8 2.8 0 0 1 5 -1.7 a2.8 2.8 0 0 1 5 1.7 c0 2.2 -1.8 4 -5 6.4 Z" />
      <path {...S} strokeWidth={1.6} d="M4 5.5 l2 2 M12 2.5 v2.6 M20 5.5 l-2 2" opacity={0.85} />
      <path {...S} strokeWidth={1.4} d="M5.5 20 h13" opacity={0.5} />
    </>
  ),
  'heal-cyclone': (
    <>
      {/* 回復の渦 (ハート + 渦巻き) */}
      <path {...S} strokeWidth={1.8} d="M12 5 a7 7 0 1 1 -6.6 9.3" />
      <path {...F} d="M14.8 16.2 c-2.1 -1.6 -3.3 -2.8 -3.3 -4.2 a1.85 1.85 0 0 1 3.3 -1.15 a1.85 1.85 0 0 1 3.3 1.15 c0 1.4 -1.2 2.6 -3.3 4.2 Z" />
      <path {...S} strokeWidth={1.5} d="M12 2.2 l.9 1.9 M4.6 7.4 l1.9 .9" opacity={0.8} />
    </>
  ),
  'star-hymn': (
    <>
      {/* 星の歌 (大きな星 + 音符) */}
      <path {...S} strokeWidth={1.7} d="M10.4 4.4 l1.9 3.9 4.3 .6 -3.1 3 .7 4.3 -3.8 -2 -3.8 2 .7 -4.3 -3.1 -3 4.3 -.6 Z" />
      <circle {...F} cx="18.6" cy="16.8" r="1.5" />
      <path {...S} strokeWidth={1.6} d="M20 16.6 V8.4 l2 -.8" opacity={0.85} />
    </>
  ),
  // ---- ステラ (光/星) ----
  'star-ring': (
    <>
      {/* スターバースト: 360度に飛び出す6つの星 */}
      <circle {...S} cx="12" cy="12" r="3.1" opacity={0.85} />
      {[[12, 3.2], [20.1, 8.1], [20.1, 15.9], [12, 20.8], [3.9, 15.9], [3.9, 8.1]].map(([x, y], i) => (
        <path key={i} {...F} d={`M${x} ${y - 1.7} l0.5 1.1 1.2 0.2 -0.9 0.9 0.2 1.2 -1 -0.6 -1 0.6 0.2 -1.2 -0.9 -0.9 1.2 -0.2 Z`} />
      ))}
      <path {...F} d="M12 9.8 l0.9 1.9 2 0.3 -1.5 1.4 0.4 2 -1.8 -1 -1.8 1 0.4 -2 -1.5 -1.4 2 -0.3 Z" />
    </>
  ),
  'star-slash': (
    <>
      {/* ステラッシュ: 背後→前→背後の三段斬り (交差する斬撃線 + 星) */}
      <path {...S} strokeWidth={2.1} d="M4 19 L14.5 5.5" />
      <path {...S} strokeWidth={1.7} d="M8.5 19.5 L19 6.5" opacity={0.75} />
      <path {...S} strokeWidth={1.3} d="M13 19 L20.5 9.5" opacity={0.5} />
      <path {...F} d="M17.2 15.2 l0.6 1.3 1.3 0.6 -1.3 0.6 -0.6 1.3 -0.6 -1.3 -1.3 -0.6 1.3 -0.6 Z" />
    </>
  ),
  'star-ride': (
    <>
      {/* ステライド: 十角形の星路 + 天に昇るビーム */}
      <path {...S} strokeWidth={1.4} d="M12 3.2 L16.8 6.1 L16.8 11.4 L12 14.3 L7.2 11.4 L7.2 6.1 Z" opacity={0.9} />
      <path {...S} strokeWidth={1.2} d="M12 3.2 L16.8 11.4 M16.8 6.1 L7.2 11.4 M7.2 6.1 L12 14.3 M12 3.2 L7.2 11.4" opacity={0.45} />
      <path {...S} strokeWidth={2} d="M12 14.3 V21" />
      <path {...F} d="M12 14.9 l0.8 1.7 1.7 0.8 -1.7 0.8 -0.8 1.7 -0.8 -1.7 -1.7 -0.8 1.7 -0.8 Z" />
    </>
  ),
};


export function SkillIcon({
  glyph,
  color,
  size = 28,
  dim = false,
  glow = true,
}: {
  glyph: SkillGlyph;
  color: string;
  size?: number;
  dim?: boolean;
  glow?: boolean;
}) {
  const stroke = brighten(color, 0.18);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      style={{
        color: dim ? '#5b647e' : stroke,
        filter: glow && !dim ? `drop-shadow(0 0 3px ${stroke}) drop-shadow(0 0 7px ${stroke}55)` : undefined,
        transition: 'color 0.2s, filter 0.2s',
      }}
    >
      {GLYPHS[glyph] ?? null}
    </svg>
  );
}
