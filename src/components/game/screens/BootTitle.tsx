'use client';

// ============================================================
// AETHER LEAGUE - HoshiNetスプラッシュ + ブート(ロード)画面 + OPタイトル画面
// ※ 絵文字不使用: すべて SVG アイコンで描画
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { DynButton } from '../ui';
import { TitleBg } from '../TitleBg';
import { GearIcon, HoshiNetLogo } from '../Icons';

const TIPS = [
  'マップはトップ・ミッド・ボトの3レーン！ジャングルの草むらはすべてつながっている。',
  '川沿いのエーテルゴーレムを倒すと75秒間の強力なバフを獲得！',
  '自然回復は3倍に強化済み。戦闘を離れるとさらに2.6倍にアップ！',
  'グラフィック設定「アルティメット」では草木のポリゴンが激増して超鮮明！それでいて軽い！',
  'T キー (PC) で指令ホイール！6角形の6項目から味方へ指令を送れる。',
  'マウスホイール (PC) で視野を調整。0にすると一人称視点！',
  'タワーはミニオンを優先攻撃。タワー下での無謀なダイブに注意。',
  '体力が10%を切ると画面が赤くなる。危険信号だ！',
  '倒した敵は天使になって昇天していく…。',
  'F ガードで被ダメージ65%減。ただし移動速度が半減する。',
  'Tabキー長押しで自分のステータスをいつでも確認できる。',
  'スマホはボタン長押しでTABを出せる。ショップは専用ボタンから直接開ける。',
  '設定の「操作」タブからキーコンフィグを自由に変更可能。',
  'ボルトは大弱体化された。今は他のレジェンドも輝ける…！',
];

// ------------------------------------------------------------
// ©HoshiNet スプラッシュ — 起動一番最初に表示し、PLAY画面(タイトル)へ続く
// ------------------------------------------------------------

export function HoshiNetSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const done = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 550);
  }, [onDone]);

  // 約2.6秒で自動遷移 / タップ・クリックでスキップ
  useEffect(() => {
    const t = setTimeout(done, 2600);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div
      className={`game-root flex items-center justify-center bg-[#04060d] transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      onClick={done}
      onTouchStart={done}
    >
      {/* 流れる星のパーティクル */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="title-particle absolute rounded-full"
            style={{
              left: `${(i * 53) % 100}%`,
              bottom: '-2%',
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              background: i % 4 === 0 ? '#ffd86a' : '#7dd3fc',
              boxShadow: `0 0 10px ${i % 4 === 0 ? 'rgba(255,216,106,0.9)' : 'rgba(125,211,252,0.9)'}`,
              animationDuration: `${3.6 + (i % 5)}s`,
              animationDelay: `${(i % 6) * 0.5}s`,
            }}
          />
        ))}
        {/* 中心の柔らかな光 */}
        <div
          className="absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(79,150,255,0.16), transparent 62%)' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="logo-in" style={{ filter: 'drop-shadow(0 0 26px rgba(255,216,106,0.65))' }}>
          <HoshiNetLogo size={110} />
        </div>
        <h1 className="logo-in mt-4 font-display text-4xl font-black tracking-[0.3em] sm:text-5xl" style={{ animationDelay: '0.18s' }}>
          <span className="shimmer-text">Hoshi</span>
          <span className="text-glow-blue">Net</span>
        </h1>
        <div className="fade-in mt-2.5 text-[11px] tracking-[0.5em] text-slate-400" style={{ animationDelay: '0.45s' }}>
          ホ シ ネ ッ ト
        </div>
        <div className="fade-in mt-8 text-[10px] tracking-[0.35em] text-slate-600" style={{ animationDelay: '0.8s' }}>
          ©HoshiNet — PRESENTS
        </div>
      </div>

      <div className="fade-in absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-widest text-slate-700" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))', animationDelay: '1.1s' }}>
        tap to skip
      </div>
    </div>
  );
}

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start) / 2600;
      const p = Math.min(1, t);
      // ease
      setProgress(Math.round((1 - Math.pow(1 - p, 2.2)) * 100));
      if (p >= 1) {
        setTimeout(onDone, 350);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="game-root flex flex-col items-center justify-center bg-[#05070f]">
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="title-particle absolute h-1 w-1 rounded-full bg-sky-300/70"
            style={{
              left: `${(i * 41) % 100}%`,
              bottom: '-2%',
              animationDuration: `${4 + (i % 5)}s`,
              animationDelay: `${(i % 7) * 0.6}s`,
              boxShadow: '0 0 8px rgba(79,209,255,0.9)',
            }}
          />
        ))}
      </div>
      <div className="logo-in font-display text-4xl font-black tracking-[0.3em] text-white sm:text-6xl">
        <span className="shimmer-text">AETHER</span>{' '}
        <span className="text-glow-blue">LEAGUE</span>
      </div>
      <div className="mt-3 text-xs tracking-[0.5em] text-slate-400">エ ー テ ル リ ー グ</div>
      <div className="mt-14 w-80 sm:w-[420px]">
        <div className="flex justify-between text-[10px] tracking-widest text-slate-400">
          <span>LOADING ASSETS</span>
          <span className="text-sky-300">{progress}%</span>
        </div>
        {/* 平行四辺形ロードバー */}
        <div className="relative mt-3 h-4" style={{ transform: 'skewX(-18deg)' }}>
          <div className="para-frame absolute inset-0 overflow-hidden bg-slate-900/85">
            <div
              className="loading-bar-glow relative h-full bg-gradient-to-r from-sky-500 via-cyan-300 to-indigo-400 transition-[width] duration-100"
              style={{ width: `${progress}%`, boxShadow: '0 0 14px rgba(79,209,255,0.95)' }}
            >
              <div className="para-stripes absolute inset-0" />
              {/* 先端の光ヘッド */}
              <div className="absolute right-0 top-0 h-full w-[3px] bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.9)]" />
            </div>
          </div>
          {/* 角のアクセント */}
          <div className="absolute -left-1 top-0 h-full w-[3px] bg-sky-400/80 shadow-[0_0_8px_rgba(79,209,255,0.8)]" />
          <div className="absolute -right-1 top-0 h-full w-[3px] bg-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
        </div>
        {/* 平行四辺形セグメントチップ */}
        <div className="mt-2.5 flex gap-1.5" style={{ transform: 'skewX(-18deg)' }}>
          {Array.from({ length: 16 }).map((_, i) => {
            const lit = progress >= Math.round(((i + 1) / 16) * 100);
            return (
              <div
                key={i}
                className={`h-1.5 flex-1 transition-all duration-200 ${
                  lit
                    ? 'bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]'
                    : 'bg-slate-700/70'
                }`}
              />
            );
          })}
        </div>
        <div className="relative mt-3 h-4 overflow-hidden">
          <p className="absolute text-[11px] text-slate-400">TIP: {tip}</p>
        </div>
      </div>
      <div className="absolute bottom-4 flex flex-col items-center gap-1" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="text-[10px] tracking-widest text-slate-600">AETHER PROJECT v1.0</div>
      </div>
    </div>
  );
}

export function TitleScreen({ onPlay, onSettings }: { onPlay: () => void; onSettings: () => void }) {
  return (
    <div className="game-root">
      <TitleBg charIds={['blaze', 'frost', 'shadow', 'gale']} />
      <div className="vignette pointer-events-none absolute inset-0" />
      {/* 上部 */}
      <div className="fade-in absolute left-0 right-0 top-0 flex items-start justify-between p-5">
        <div className="hud-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] tracking-widest text-slate-300">
          AETHER PROJECT ONLINE
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-glow" />
        </div>
        <div className="flex gap-2">
          <DynButton variant="ghost" className="px-4 py-2 text-xs" onClick={onSettings}>
            <GearIcon size={13} /> 設定
          </DynButton>
        </div>
      </div>
      {/* ロゴ */}
      <div className="absolute left-0 right-0 top-[14%] select-none text-center">
        <h1 className="logo-in font-display text-5xl font-black tracking-[0.22em] sm:text-7xl">
          <span className="shimmer-text">AETHER</span>
        </h1>
        <h1 className="logo-in font-display text-5xl font-black tracking-[0.22em] text-glow-blue sm:text-7xl" style={{ animationDelay: '0.25s' }}>
          LEAGUE
        </h1>
        <p className="mt-4 text-sm tracking-[0.6em] text-slate-300" style={{ animationDelay: '0.6s' }}>エ ー テ ル ・ リ ー グ</p>
        <p className="mt-2 text-xs text-slate-500">12人のレジェンドと、頂点のエーテルへ。</p>
      </div>
      {/* 中央下: PLAY */}
      <div className="absolute bottom-[9%] left-0 right-0 flex flex-col items-center gap-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="float-y">
          <DynButton variant="play" hit onClick={onPlay} className="min-w-[300px]">
            <span className="inline-flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path fill="currentColor" d="M8 5.2 L18.6 12 L8 18.8 Z" /></svg>
              PLAY
            </span>
          </DynButton>
        </div>
        <div className="text-[10px] tracking-widest text-slate-500">SPACE / クリックで開始</div>
      </div>
      {/* ニュース風パネル (本物のゲームらしいタイトル画面) */}
      <div className="fade-in absolute bottom-[9%] left-5 hidden w-64 lg:block" style={{ animationDelay: '0.9s' }}>
        <div className="hud-panel rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-amber-300">
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5">NEWS</span>
            SEASON 1
          </div>
          <div className="mt-2 text-[11px] leading-5 text-slate-300">
            「エーテルの覚醒」開催中。新レジェンド「ステラ」参戦！ 星剣の天使が戦場に舞う。
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-4 text-slate-500">
            v1.4 — ステラ実装・廃坑Bot安定化・ボルト調整
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 text-[10px] tracking-widest text-slate-600" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>v1.4.0 - BROWSER 3D MOBA</div>
      <div className="absolute right-4 flex items-center gap-1.5 text-[10px] tracking-widest text-slate-500" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <HoshiNetLogo size={18} />
        ©HoshiNet
      </div>
    </div>
  );
}
