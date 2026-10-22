'use client';

// ============================================================
// AETHER LEAGUE - リザルト画面
// ============================================================

import { useEffect, useState } from 'react';
import type { BattleResultData } from '@/game/types';
import { getChar } from '@/game/characters';
import { getMap } from '@/game/maps';
import { TROPHIES } from '@/game/storage';
import { DynButton } from '../ui';
import { TrophyIcon, PlayIcon, RewardIcon } from '../Icons';

export function ResultScreen({
  result, playerName, onRetry, onMenu,
}: {
  result: BattleResultData;
  playerName: string;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const char = getChar(result.stats.charId);
  const map = getMap(result.stats.mapId);
  const [showCount, setShowCount] = useState(0);
  const trophies = result.rewards.trophiesUnlocked.map((id) => TROPHIES.find((t) => t.id === id)).filter(Boolean);

  useEffect(() => {
    const iv = setInterval(() => setShowCount((c) => Math.min(c + 1, 4)), 260);
    return () => clearInterval(iv);
  }, []);

  const rows: [string, string | number][] = [
    ['キル / デス / アシスト', `${result.stats.kills} / ${result.stats.deaths} / ${result.stats.assists}`],
    ['CS (ミニオン)', result.stats.cs],
    ['与ダメージ', result.stats.damage.toLocaleString()],
    ['タワー破壊', result.stats.towers],
    ['試合時間', `${Math.floor(result.stats.duration / 60)}分${result.stats.duration % 60}秒`],
  ];

  return (
    <div className="game-root game-scrollable overflow-y-auto overscroll-contain bg-[#05070f]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: result.win
            ? 'radial-gradient(900px 500px at 50% 0%, rgba(255,198,92,0.14), transparent), radial-gradient(900px 500px at 50% 110%, rgba(79,209,255,0.12), transparent)'
            : 'radial-gradient(900px 500px at 50% 0%, rgba(255,77,109,0.12), transparent)',
        }}
      />
      {result.win && Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="title-particle pointer-events-none absolute h-1.5 w-1.5 rounded-full"
          style={{
            left: `${(i * 37) % 100}%`, bottom: 0,
            background: i % 2 ? '#ffd86a' : '#4fd1ff',
            boxShadow: `0 0 8px ${i % 2 ? '#ffd86a' : '#4fd1ff'}`,
            animationDuration: `${3 + (i % 4)}s`, animationDelay: `${i * 0.2}s`,
          }} />
      ))}

      {/* スマホでも高さが足りない場合にスクロール・ボタンが必ず押せるようにする */}
      <div className="relative z-10 flex min-h-full w-full items-center justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pb-8">
        <div className="w-full max-w-2xl">
          <h1
            className={`vs-flash font-display text-center text-5xl font-black tracking-[0.16em] sm:text-7xl sm:tracking-[0.2em] ${result.win ? 'text-glow-gold' : 'text-rose-400'}`}
            style={{ textShadow: result.win ? '0 0 30px rgba(255,198,92,0.8)' : '0 0 30px rgba(255,77,109,0.6)' }}
          >
            {result.win ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="mt-2 text-center text-xs tracking-widest text-slate-400 sm:text-sm">
            {result.win ? '勝利' : '敗北'} - {playerName} / {char.name} / {map.name}
          </p>

          <div className="hud-panel mt-4 rounded-2xl p-3.5 sm:mt-6 sm:p-5">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-1.5">
              {rows.map(([k, v], i) => (
                <div key={k} className={`flex items-center justify-between border-b border-white/5 py-1.5 transition-opacity duration-500 sm:py-2 ${i < showCount + 2 ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="text-xs text-slate-400">{k}</span>
                  <span className="font-display text-sm font-bold text-white">{v}</span>
                </div>
              ))}
            </div>
            <div className={`mt-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 transition-opacity duration-500 sm:mt-4 sm:p-4 ${showCount >= 3 ? 'opacity-100' : 'opacity-0'}`}>
              <div className="mb-2 text-[10px] tracking-widest text-amber-300">リワード</div>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Reward label="プレイヤーEXP" value={`+${result.rewards.playerExp}`} color="text-sky-300" />
                <Reward label="コイン" value={`+${result.rewards.coins}`} color="text-amber-300" />
                <Reward label="バトルパスEXP" value={`+${result.rewards.bpExp}`} color="text-emerald-300" />
              </div>
            </div>
            {trophies.length > 0 && (
              <div className={`mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 transition-opacity duration-500 ${showCount >= 4 ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-amber-300"><TrophyIcon size={12} /> トロフィー獲得！</div>
                {trophies.map((t) => (
                  <div key={t!.id} className="mt-1 flex items-center gap-2 text-xs text-amber-100">
                    <span className="text-amber-300"><RewardIcon id={t!.icon} size={14} /></span>{t!.name}<span className="text-[10px] text-slate-400">- {t!.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 低い画面 (スマホ横画面) でもボタンが必ず見えるよう下部に固定表示 */}
          <div className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-[#05070f] via-[#05070f]/85 to-transparent px-1 py-3 sm:mt-6 sm:gap-3">
            <DynButton hit variant="primary" className="whitespace-nowrap px-5 py-3.5 sm:px-8" onClick={onRetry}><PlayIcon size={13} /> 再戦する</DynButton>
            <DynButton hit variant="ghost" className="whitespace-nowrap px-5 py-3.5 sm:px-8" onClick={onMenu}>メニューへ</DynButton>
          </div>
        </div>
      </div>

    </div>
  );
}

function Reward({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`font-display text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}
