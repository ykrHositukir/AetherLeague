'use client';

// ============================================================
// AETHER LEAGUE - 共通UI (動的ボタン等)
// ============================================================

import { type ReactNode, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'gold' | 'danger' | 'ghost' | 'play';

interface DynButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  /** タッチ用に押下判定をボタン外周まで拡大する (スマホの押しづらさ対策) */
  hit?: boolean;
}

export function DynButton({ variant = 'primary', className = '', children, hit, ...rest }: DynButtonProps) {
  const v = variant === 'play' ? 'dyn-btn--play' : variant === 'gold' ? 'dyn-btn--gold' : variant === 'danger' ? 'dyn-btn--danger' : variant === 'ghost' ? 'dyn-btn--ghost' : '';
  return (
    <button {...rest} className={`dyn-btn ${v} ${className}`}>
      {hit && <span aria-hidden className="pointer-events-auto absolute -inset-x-2.5 -inset-y-2" />}
      <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-slate-400">{label}</span>
      <div className="stat-bar flex-1">
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] font-bold text-slate-200">{value}</span>
    </div>
  );
}

export function CoinIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[10px] font-black text-amber-950 shadow-[0_0_8px_rgba(255,198,92,0.5)] ${className}`}>
      ¢
    </span>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-bold tracking-widest text-white">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      <div className="mt-2 h-px w-full bg-gradient-to-r from-sky-400/60 via-indigo-400/20 to-transparent" />
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hud-panel rounded-xl ${className}`}>{children}</div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-7 w-13 shrink-0 rounded-full border transition-colors ${on ? 'border-sky-400/70 bg-sky-500/40' : 'border-slate-600 bg-slate-800'}`}
      style={{ width: 52 }}
    >
      <span
        className={`absolute top-0.5 h-5.5 w-5.5 rounded-full transition-all ${on ? 'left-[26px] bg-sky-300 shadow-[0_0_10px_rgba(79,209,255,0.8)]' : 'left-0.5 bg-slate-400'}`}
        style={{ height: 22, width: 22 }}
      />
    </button>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-2 w-40 cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400
        [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-300
        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(79,209,255,0.8)]"
    />
  );
}

export const ROLE_COLOR: Record<string, string> = {
  ファイター: '#ff6a4d', メイジ: '#5cd6ff', アサシン: '#c86aff',
  タンク: '#a8d86a', サポーター: '#ffd86a', マークスマン: '#7ce8a8',
};
