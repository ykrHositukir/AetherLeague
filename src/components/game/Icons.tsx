'use client';

// ============================================================
// AETHER LEAGUE - SVG アイコンセット (絵文字の代わり)
// すべてのアイコンは SVG で描画する (絵文字不使用方針)
// ============================================================

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor', stroke: 'none' } as const;

function Svg({ size = 16, className, style, children, vb = 24 }: IconProps & { children: ReactNode; vb?: number }) {
  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} className={className} style={style} aria-hidden>
      {children}
    </svg>
  );
}

// ------------------------------------------------------------
// 汎用 UI アイコン
// ------------------------------------------------------------

export function PlayIcon(p: IconProps) {
  return <Svg {...p}><path {...F} d="M8 5.2 L18.6 12 L8 18.8 Z" /></Svg>;
}
export function SwordsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M4.5 4.5 L14 14 M14 14 l2.5 2.5 M16.5 16.5 l-2 2 a1.4 1.4 0 0 1 -2 -2 l2 -2 M4.5 4.5 l0 4 2.5 2.5" />
      <path {...S} d="M19.5 4.5 L10 14 M10 14 l-2.5 2.5 M7.5 16.5 l2 2 a1.4 1.4 0 0 0 2 -2 l-2 -2 M19.5 4.5 l0 4 -2.5 2.5" />
    </Svg>
  );
}
export function GlobeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...S} cx="12" cy="12" r="8.2" />
      <ellipse {...S} cx="12" cy="12" rx="3.6" ry="8.2" />
      <path {...S} d="M4 9.4 h16 M4 14.6 h16" />
    </Svg>
  );
}
export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M7 4.5 h10 v5 a5 5 0 0 1 -10 0 Z" />
      <path {...S} d="M7 6 H4.2 a2.8 2.8 0 0 0 2.9 4 M17 6 h2.8 a2.8 2.8 0 0 1 -2.9 4" />
      <path {...S} d="M12 14.5 v3 M8.5 20 h7 M9.5 17.5 h5" />
    </Svg>
  );
}
export function TicketIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M4 8.5 a1.8 1.8 0 0 0 0 7 v2.2 a1 1 0 0 0 1 1 h14 a1 1 0 0 0 1 -1 v-2.2 a1.8 1.8 0 0 1 0 -7 V6.3 a1 1 0 0 0 -1 -1 H5 a1 1 0 0 0 -1 1 Z" />
      <path {...S} d="M14.5 6 v2.2 M14.5 10.9 v2.2 M14.5 15.8 V18" strokeDasharray="2.4 2.2" />
    </Svg>
  );
}
export function GearIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...S} cx="12" cy="12" r="3" />
      <path {...S} d="M12 3.2 l1 2.4 2.5 -.6 1 1.7 -1.5 2 1.5 2 -1 1.7 -2.5 -.6 -1 2.4 h-2 l-1 -2.4 -2.5 .6 -1 -1.7 1.5 -2 -1.5 -2 1 -1.7 2.5 .6 1 -2.4 Z" transform="translate(0 3.4) scale(0.86) translate(1.7 1.7)" />
    </Svg>
  );
}
export function GiftIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="4.5" y="10" width="15" height="9.5" rx="1" />
      <path {...S} d="M3.5 7.2 h17 V10 h-17 Z M12 7.2 V19.5" />
      <path {...S} d="M12 7 C10 7 7.6 6.4 7.6 4.8 a1.9 1.9 0 0 1 4.4 -0.6 C12 4.2 12 7 12 7 Z M12 7 c2 0 4.4 -.6 4.4 -2.2 a1.9 1.9 0 0 0 -4.4 -.6 C12 4.2 12 7 12 7 Z" />
    </Svg>
  );
}
export function MailIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="3.5" y="5.5" width="17" height="13" rx="1.6" />
      <path {...S} d="M4.5 7 L12 13 L19.5 7" />
    </Svg>
  );
}
export function BotIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="5" y="7.5" width="14" height="10" rx="2.4" />
      <circle {...F} cx="9.4" cy="12" r="1.25" />
      <circle {...F} cx="14.6" cy="12" r="1.25" />
      <path {...S} d="M9.5 15.2 h5 M12 7.5 V4.6 M12 4.6 a1.3 1.3 0 1 0 -.01 -2.6 M12 4.6 a1.3 1.3 0 0 0 0 -2.6" transform="translate(0 .2)" />
      <path {...S} d="M5 11 H3 M21 11 h-2" />
    </Svg>
  );
}
export function ShopBagIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M5.5 8.5 h13 l-1.1 10.2 a1.6 1.6 0 0 1 -1.6 1.4 H8.2 a1.6 1.6 0 0 1 -1.6 -1.4 Z" />
      <path {...S} d="M9 10.5 V7.6 a3 3 0 0 1 6 0 v2.9" />
    </Svg>
  );
}
export function WarningIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 4 L21 19.5 H3 Z" />
      <path {...S} d="M12 10 v4.4" strokeWidth={2.1} />
      <circle {...F} cx="12" cy="17.2" r="1.05" />
    </Svg>
  );
}
export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...S} cx="12" cy="12" r="8.4" />
      <path {...S} d="M12 11 v5" strokeWidth={2} />
      <circle {...F} cx="12" cy="8" r="1.1" />
    </Svg>
  );
}
export function CheckIcon(p: IconProps) {
  return <Svg {...p}><path {...S} strokeWidth={2.4} d="M5 12.5 L10 17.5 L19 7" /></Svg>;
}
export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="6" y="10.5" width="12" height="9" rx="1.6" />
      <path {...S} d="M8.5 10.5 V8 a3.5 3.5 0 0 1 7 0 v2.5" />
      <circle {...F} cx="12" cy="14.8" r="1.3" />
    </Svg>
  );
}
export function RefreshIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M19.5 12 a7.5 7.5 0 1 1 -2.2 -5.3 M17.5 3.5 v3.6 h-3.6" />
    </Svg>
  );
}
export function ScreenIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="3.5" y="5" width="17" height="11.5" rx="1.4" />
      <path {...S} d="M9 20 h6 M12 16.5 V20" />
    </Svg>
  );
}
export function GamepadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M7.5 7 h9 a4.5 4.5 0 0 1 4.4 5.4 l-.8 4 a2.6 2.6 0 0 1 -4.6 1 L14.2 15 H9.8 l-1.3 2.4 a2.6 2.6 0 0 1 -4.6 -1 l-.8 -4 A4.5 4.5 0 0 1 7.5 7 Z" />
      <path {...S} d="M8.4 10.4 v2.8 M7 11.8 h2.8" />
      <circle {...F} cx="15.6" cy="10.9" r="1.05" />
      <circle {...F} cx="17.6" cy="12.9" r="1.05" />
    </Svg>
  );
}
export function WrenchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M14.2 6.2 a4 4 0 0 1 5 -5 L16.6 3.8 l3.6 3.6 2.6 -2.6 a4 4 0 0 1 -5 5 L9.4 18.2 a2.1 2.1 0 0 1 -3 -3 Z" transform="translate(-2 1.4) scale(0.92)" />
    </Svg>
  );
}
export function PhoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect {...S} x="7" y="3.5" width="10" height="17" rx="2" />
      <path {...S} d="M10.5 18 h3" />
    </Svg>
  );
}
export function LeafIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M19.5 4.5 C12 4.5 5.5 8 5 19 c8 -.5 12.5 -5 14.5 -14.5 Z" />
      <path {...S} d="M7.5 16.5 C10 12 13.5 9 17 7.5" opacity={0.7} />
    </Svg>
  );
}
export function StarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3.5 l2.5 5.2 5.7 .7 -4.2 3.9 1.1 5.6 -5.1 -2.8 -5.1 2.8 1.1 -5.6 -4.2 -3.9 5.7 -.7 Z" />
    </Svg>
  );
}
export function GemIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M7 4.5 h10 l4 5 -9 10.5 L3 9.5 Z" />
      <path {...S} d="M3 9.5 h18 M7 4.5 L9.5 9.5 L12 20 M17 4.5 L14.5 9.5 L12 20 M9.5 9.5 h5" opacity={0.75} />
    </Svg>
  );
}
export function FlameIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3.5 c1 3 -2.6 4.6 -2.6 7.6 a4.6 4.6 0 0 0 9.2 .4 c1.5 -3.5 -1.6 -5.5 -2.6 -8 c-.6 1.6 -1.6 2.2 -2.4 2.6 C13 5.2 12.4 4.6 12 3.5 Z" />
      <path {...S} d="M12 20.5 a3.2 3.2 0 0 0 3.2 -3.2 c0 -1.7 -1.6 -2.4 -2.4 -4 c-1 1.4 -3.2 2 -3.2 4 A3.2 3.2 0 0 0 12 20.5 Z" opacity={0.65} />
    </Svg>
  );
}
export function GalaxyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...F} cx="12" cy="12" r="2" />
      <path {...S} d="M12 4 a8 8 0 0 1 8 8 M12 20 a8 8 0 0 1 -8 -8" strokeWidth={2.2} />
      <circle {...F} cx="19" cy="6.5" r="1" />
      <circle {...F} cx="5" cy="17.5" r="1" />
    </Svg>
  );
}
export function SkullIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3.5 a7 7 0 0 1 7 7 c0 2.4 -1.2 4 -2.6 5 v2.6 a1 1 0 0 1 -1 1 H8.6 a1 1 0 0 1 -1 -1 V15.5 C6.2 14.5 5 12.9 5 10.5 a7 7 0 0 1 7 -7 Z" />
      <circle {...F} cx="9.3" cy="11" r="1.5" />
      <circle {...F} cx="14.7" cy="11" r="1.5" />
      <path {...S} d="M10.4 16.8 h3.2" />
    </Svg>
  );
}
export function CastleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M5 20 V8.5 l1.6 -2 v1.6 h2.4 V6.5 l3 -2.4 3 2.4 v1.6 h2.4 V6.5 l1.6 2 V20 Z" />
      <path {...S} d="M10 20 v-4 a2 2 0 0 1 4 0 v4 M3.5 20 h17" />
    </Svg>
  );
}
export function BoomIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3.5 v3.4 M12 17.1 v3.4 M3.5 12 h3.4 M17.1 12 h3.4 M6 6 l2.4 2.4 M15.6 15.6 L18 18 M18 6 l-2.4 2.4 M8.4 15.6 L6 18" strokeWidth={2.1} />
      <circle {...S} cx="12" cy="12" r="3.4" />
    </Svg>
  );
}
export function MedalIcon(p: IconProps & { star?: boolean }) {
  return (
    <Svg {...p}>
      <path {...S} d="M8 3.5 l2.4 4.6 M16 3.5 l-2.4 4.6" />
      <circle {...S} cx="12" cy="14" r="6" />
      {p.star ? (
        <path {...S} d="M12 11 l1 2 2.2 .3 -1.6 1.5 .4 2.2 -2 -1 -2 1 .4 -2.2 -1.6 -1.5 2.2 -.3 Z" />
      ) : (
        <path {...S} d="M9.5 14.6 l1.8 1.8 3.4 -3.6" />
      )}
    </Svg>
  );
}
export function ShieldIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3 L19 5.8 v5.6 q0 5 -7 9.2 q-7 -4.2 -7 -9.2 V5.8 Z" />
    </Svg>
  );
}
export function PalmIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 21 c-.4 -5 .2 -9.5 1.5 -13" />
      <path {...S} d="M13.5 8 C11 4.5 7 4.8 5.5 7.5 c3 -.6 5 .2 8 .5 Z M13.5 8 c-.6 -4 2.6 -6 5.8 -5 -1.6 1.4 -2.8 3 -3.6 5.4 Z M13.5 8 c3.6 -1.4 6.4 .4 7 3 -2.6 -1.2 -5 -1.4 -7 -.4 Z" />
    </Svg>
  );
}
export function WheatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 21 V7" />
      <path {...S} d="M12 7 C12 4.6 13.4 3.4 15.5 3.2 c-.2 2.2 -1.4 3.6 -3.5 3.8 Z M12 10.5 c0 -2.4 -1.4 -3.6 -3.5 -3.8 .2 2.2 1.4 3.6 3.5 3.8 Z M12 10.5 c0 -2.4 1.4 -3.6 3.5 -3.8 -.2 2.2 -1.4 3.6 -3.5 3.8 Z M12 14 c0 -2.4 -1.4 -3.6 -3.5 -3.8 .2 2.2 1.4 3.6 3.5 3.8 Z M12 14 c0 -2.4 1.4 -3.6 3.5 -3.8 -.2 2.2 -1.4 3.6 -3.5 3.8 Z" opacity={0.85} />
    </Svg>
  );
}
export function BloodIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 3.5 c3.2 4.4 5.6 7.6 5.6 10.6 a5.6 5.6 0 0 1 -11.2 0 c0 -3 2.4 -6.2 5.6 -10.6 Z" />
    </Svg>
  );
}
export function CrownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...S} d="M4 8 l3.4 3 L12 5 l4.6 6 3.4 -3 -1.6 10.5 H5.6 Z" />
      <path {...S} d="M6.4 18.5 h11.2" opacity={0.7} />
    </Svg>
  );
}
export function CoinRewardIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle {...S} cx="12" cy="12" r="8" />
      <path {...S} d="M14.6 9.2 a3.4 3.4 0 1 0 0 5.6 M9.8 12 h4.4" />
    </Svg>
  );
}

// ------------------------------------------------------------
// 属性アイコン (炎/氷/雷/土/光/闇/水/風) — ELEMENT_ICON の代替
// ------------------------------------------------------------

export function ElementIcon({ element, size = 16, className }: { element: string } & IconProps) {
  switch (element) {
    case '炎':
      return <FlameIcon size={size} className={className} />;
    case '氷':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M12 3 v18 M4.2 7.5 l15.6 9 M19.8 7.5 l-15.6 9 M12 3 l-1.8 1.8 M12 3 l1.8 1.8 M12 21 l-1.8 -1.8 M12 21 l1.8 -1.8 M4.2 7.5 l.5 2.5 M4.2 7.5 l2.5 -.5 M19.8 16.5 l-.5 -2.5 M19.8 16.5 l-2.5 .5 M19.8 7.5 l-2.5 -.5 M19.8 7.5 l.5 2.5 M4.2 16.5 l2.5 .5 M4.2 16.5 l-.5 -2.5" opacity={0.95} />
        </Svg>
      );
    case '雷':
      return (
        <Svg size={size} className={className}>
          <path {...F} d="M13.4 2.5 L6 13.4 h4.4 L9.6 21.5 L18 10 h-4.8 Z" />
        </Svg>
      );
    case '土':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M3 19 L9 8 l3.4 5.4 L15 10 l6 9 Z" />
          <path {...S} d="M7.4 12.4 l1.8 -1.4" opacity={0.6} />
        </Svg>
      );
    case '光':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M12 3.2 v2.6 M12 18.2 v2.6 M3.2 12 h2.6 M18.2 12 h2.6 M5.8 5.8 l1.9 1.9 M16.3 16.3 l1.9 1.9 M18.2 5.8 l-1.9 1.9 M7.7 16.3 l-1.9 1.9" strokeWidth={2} />
          <circle {...S} cx="12" cy="12" r="3.4" />
        </Svg>
      );
    case '闇':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M19.5 14.2 A8 8 0 1 1 9.8 4.5 a6.6 6.6 0 0 0 9.7 9.7 Z" />
          <path {...S} d="M16.5 4.5 l.5 1.4 1.4 .5 -1.4 .5 -.5 1.4 -.5 -1.4 -1.4 -.5 1.4 -.5 Z" strokeWidth={1.2} />
        </Svg>
      );
    case '水':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M12 3.5 c3.4 4.6 5.8 8 5.8 11 a5.8 5.8 0 0 1 -11.6 0 c0 -3 2.4 -6.4 5.8 -11 Z" />
          <path {...S} d="M9.4 14.4 a2.8 2.8 0 0 0 2.2 2.7" opacity={0.65} />
        </Svg>
      );
    case '風':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M3.5 9 h9.4 a2.7 2.7 0 1 0 -2.7 -2.7 M3.5 13.5 h13.8 a2.9 2.9 0 1 1 -2.9 2.9 M3.5 18 h6.8 a2.4 2.4 0 1 1 -2.4 2.4" strokeWidth={1.9} />
        </Svg>
      );
    default:
      return <StarIcon size={size} className={className} />;
  }
}

// ------------------------------------------------------------
// 指令 (ピン) アイコン — 6角形ホイール用
// ------------------------------------------------------------

export type PingKey = 'help' | 'attack' | 'defend' | 'gg' | 'tower' | 'gather';

export function PingIcon({ k, size = 18, className }: { k: PingKey } & IconProps) {
  switch (k) {
    case 'help':
      return (
        <Svg size={size} className={className}>
          <circle {...S} cx="12" cy="12" r="8.4" />
          <path {...S} d="M9.4 9.4 a2.7 2.7 0 1 1 3.6 2.6 c-.8 .3 -1 .9 -1 1.8" strokeWidth={2} />
          <circle {...F} cx="12" cy="16.6" r="1.15" />
        </Svg>
      );
    case 'attack':
      return <SwordsIcon size={size} className={className} />;
    case 'defend':
      return <ShieldIcon size={size} className={className} />;
    case 'gg':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M6.5 21 V4 M6.5 5 h10.5 l-2.4 3 2.4 3 H6.5" />
        </Svg>
      );
    case 'tower':
      return <CastleIcon size={size} className={className} />;
    case 'gather':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M12 4.5 v13 M12 4.5 l-4 4 M12 4.5 l4 4 M5 19.5 h14" strokeWidth={2} />
        </Svg>
      );
  }
}

/** 指令のラベル定義 (ホイール & 表示で共用) */
export const PINGS: { key: PingKey; label: string; color: string }[] = [
  { key: 'help', label: '助けて！', color: '#ff6a7a' },
  { key: 'attack', label: '攻めよう！', color: '#ff9a4d' },
  { key: 'defend', label: '守ろう！', color: '#6ab8ff' },
  { key: 'gg', label: 'GG', color: '#b08aff' },
  { key: 'tower', label: 'タワーを壊せ！', color: '#ffd86a' },
  { key: 'gather', label: '集合！', color: '#4ff0b0' },
];

// ------------------------------------------------------------
// ショップアイテムアイコン
// ------------------------------------------------------------

export function ShopIcon({ id, size = 22, className }: { id: string } & IconProps) {
  switch (id) {
    case 'sword':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M5 19 L15.5 8.5 M15.5 8.5 L19 4.5 l.8 4 -2.6 2.6 Z M6.8 16.2 l1.6 1.6 M5 19 l-1 1" />
        </Svg>
      );
    case 'staff':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M7 20.5 L15 6.5 M15 6.5 a3 3 0 1 0 1 -5.6 3 3 0 0 0 -1 5.6 Z" />
          <path {...S} d="M12.4 9.4 l3 1.8" opacity={0.7} />
        </Svg>
      );
    case 'shield':
      return <ShieldIcon size={size} className={className} />;
    case 'boots':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M7 4.5 v8 l-2 3.5 v2.5 a1 1 0 0 0 1 1 h5.4 l7.1 -3.4 a1.6 1.6 0 0 0 -.4 -3 l-6.6 -1.4 V4.5 Z" />
          <path {...S} d="M5.4 16.4 h11.2" opacity={0.7} />
        </Svg>
      );
    case 'gem':
      return <GemIcon size={size} className={className} />;
    case 'gauntlet':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M6.5 20 V10 a2 2 0 0 1 4 0 V9 a2 2 0 0 1 4 0 v.6 a2 2 0 0 1 3.6 1.4 c.3 3.4 -.6 6.2 -2.6 9 Z" />
          <path {...S} d="M6.5 13.4 h11" opacity={0.6} />
        </Svg>
      );
    case 'scroll':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M6.5 5.5 a1.8 1.8 0 0 1 3.6 0 v11.6 a2.4 2.4 0 0 1 -4.8 0 V8 a1.4 1.4 0 0 1 1.2 -1.4 Z M10.1 5.5 h7.4 a1.8 1.8 0 0 1 1.8 1.8 v11.4 a2.4 2.4 0 0 1 -4.2 1.6 H5.9" />
          <path {...S} d="M12.8 10 h4 M12.8 13 h4" opacity={0.7} />
        </Svg>
      );
    case 'blade':
      return (
        <Svg size={size} className={className}>
          <path {...S} d="M4.5 19.5 L14 10 M14 10 L20 3.5 l.6 5.4 -3.4 3.4 -3.2 -2.3 M7.4 15.4 l2 2 M4.5 19.5 l-1 1 M10.6 13.4 l3.2 3.2" />
        </Svg>
      );
    default:
      return <GemIcon size={size} className={className} />;
  }
}

// ------------------------------------------------------------
// HoshiNet ロゴマーク (星 + オーブ軌道リング)
// ------------------------------------------------------------

export function HoshiNetLogo({ size = 64, className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="hn-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.45" stopColor="#ffd86a" />
          <stop offset="1" stopColor="#e8963c" />
        </linearGradient>
        <linearGradient id="hn-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9adfff" />
          <stop offset="1" stopColor="#3a7ad8" />
        </linearGradient>
      </defs>
      {/* 外周リング (軌道) */}
      <ellipse cx="48" cy="48" rx="40" ry="16" fill="none" stroke="url(#hn-blue)" strokeWidth="3" opacity="0.85" transform="rotate(-18 48 48)" />
      {/* 軌道上の衛星 */}
      <circle cx="84" cy="38" r="4.6" fill="url(#hn-blue)" />
      <circle cx="13" cy="58" r="2.8" fill="#9adfff" opacity="0.85" />
      {/* 中央の星 (4方向スパイク + 斜め短スパイク) */}
      <path
        d="M48 12 L53.5 40.5 L82 46 L53.5 51.5 L48 80 L42.5 51.5 L14 46 L42.5 40.5 Z"
        fill="url(#hn-gold)"
        stroke="#fff8e0"
        strokeWidth="1.4"
      />
      <path
        d="M48 30 L50 44 L64 46 L50 48 L48 62 L46 48 L32 46 L46 44 Z"
        fill="#fffdf4"
        opacity="0.9"
      />
      {/* 輝き */}
      <circle cx="70" cy="24" r="2.2" fill="#fff3c4" />
      <circle cx="27" cy="30" r="1.6" fill="#ffd86a" opacity="0.9" />
    </svg>
  );
}

// ------------------------------------------------------------
// 実績/報酬アイコン (キー → SVG) — TrophyDef.icon / LOGIN_REWARDS.icon 用
// ------------------------------------------------------------

export function RewardIcon({ id, size = 20, className }: { id: string } & IconProps) {
  switch (id) {
    case 'blood': return <BloodIcon size={size} className={className} />;
    case 'medal': return <MedalIcon size={size} className={className} />;
    case 'medalstar': return <MedalIcon star size={size} className={className} />;
    case 'swords': return <SwordsIcon size={size} className={className} />;
    case 'skull': return <SkullIcon size={size} className={className} />;
    case 'castle': return <CastleIcon size={size} className={className} />;
    case 'boom': return <BoomIcon size={size} className={className} />;
    case 'crown': return <CrownIcon size={size} className={className} />;
    case 'flame': return <FlameIcon size={size} className={className} />;
    case 'shield': return <ShieldIcon size={size} className={className} />;
    case 'palm': return <PalmIcon size={size} className={className} />;
    case 'wheat': return <WheatIcon size={size} className={className} />;
    case 'coin': return <CoinRewardIcon size={size} className={className} />;
    case 'gem': return <GemIcon size={size} className={className} />;
    case 'gift': return <GiftIcon size={size} className={className} />;
    default: return <StarIcon size={size} className={className} />;
  }
}
