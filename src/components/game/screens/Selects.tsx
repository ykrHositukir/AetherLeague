'use client';

// ============================================================
// AETHER LEAGUE - キャラ選択 / マップ選択
// ============================================================

import { useState } from 'react';
import type { MapId } from '@/game/types';
import { CHARACTERS, getChar } from '@/game/characters';
import { MAPS } from '@/game/maps';
import { DynButton, StatBar, ROLE_COLOR } from '../ui';
import { CharPreview } from '../TitleBg';
import { ElementIcon, SwordsIcon } from '../Icons';
import { SkillIcon } from '../SkillIcon';

export function CharSelect({
  initialChar, ownedSkins, selectedSkin, onBack, onConfirm,
}: {
  initialChar: string;
  ownedSkins: string[];
  selectedSkin: Record<string, string>;
  onBack: () => void;
  onConfirm: (charId: string) => void;
}) {
  const [sel, setSel] = useState(initialChar);
  const char = getChar(sel);
  const skin = selectedSkin[char.id] && ownedSkins.includes(selectedSkin[char.id]) ? selectedSkin[char.id] : undefined;

  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between gap-2 border-b border-sky-400/10 bg-[#0a1024]/80 px-3 py-2 sm:px-4 sm:py-3" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}>
        <h1 className="whitespace-nowrap font-display text-base font-bold tracking-widest text-white sm:text-lg">キャラクター選択</h1>
        <div className="flex gap-1.5 sm:gap-2">
          <DynButton variant="ghost" className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4" onClick={onBack}>← 戻る</DynButton>
          <DynButton variant="play" className="whitespace-nowrap px-5 py-2.5 text-xs sm:px-8 sm:py-2.5 sm:text-sm" onClick={() => onConfirm(sel)}>決定 ▶</DynButton>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 一覧: スマホ=横スワイプできる大きなカード / PC=左2列 */}
        <div className="game-scroll w-full shrink-0 overflow-x-auto border-b border-sky-400/10 bg-[#0a0f22]/60 p-2 lg:h-auto lg:w-72 lg:overflow-x-hidden lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3" style={{ touchAction: 'pan-x pan-y' }}>
          <div className="flex snap-x gap-2 lg:grid lg:grid-cols-2 lg:gap-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={`char-card relative w-[116px] shrink-0 snap-start overflow-hidden rounded-lg border p-2.5 text-left lg:w-auto ${sel === c.id ? 'selected' : 'border-sky-400/15 bg-white/[0.03]'}`}
                style={sel === c.id ? { borderColor: c.colors.aura } : undefined}
              >
                <div
                  className="absolute inset-0 opacity-40"
                  style={{ background: `linear-gradient(135deg, ${c.colors.primary}22, transparent 55%)` }}
                />
                <div className="relative flex flex-col items-center gap-1.5 text-center lg:flex-row lg:gap-2 lg:text-left">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `linear-gradient(135deg, ${c.colors.primary}, ${c.colors.secondary})`, boxShadow: `0 0 12px ${c.colors.aura}55` }}
                  >
                    <ElementIcon element={c.element} size={22} />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="truncate text-xs font-bold text-white">{c.name}</div>
                    <div className="text-[9px]" style={{ color: ROLE_COLOR[c.role] }}>{c.role}</div>
                  </div>
                </div>
                <div className="relative mt-1.5 flex gap-0.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < c.difficulty ? c.colors.aura : '#2a3450' }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* 中央: 3D */}
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0"><CharPreview charId={char.id} skin={skin} /></div>
          <div className="absolute left-4 top-4 lg:left-6 lg:top-6">
            <div className="text-xs tracking-widest" style={{ color: ROLE_COLOR[char.role] }}>{char.role}</div>
            <h2 className="font-display text-3xl font-black text-white text-glow-blue lg:text-5xl">{char.name}</h2>
            <div className="text-xs text-slate-300 sm:text-sm">{char.title}</div>
            <div className="short-hide mt-2 hidden max-w-md text-xs leading-5 text-slate-400 sm:block">{char.desc}</div>
            <div className="short-hide mt-2 hidden inline-block rounded border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200 sm:inline-block">
              「{char.voice}」
            </div>
          </div>
        </div>
        {/* 右: 詳細 (スマホは下部・広め) */}
        <div className="game-scroll h-[36%] w-full shrink-0 overflow-y-auto border-t border-sky-400/10 bg-[#0a0f22]/60 p-3 lg:h-auto lg:w-80 lg:border-l lg:border-t-0 lg:p-4" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mb-3 text-xs font-bold tracking-widest text-sky-300">ステータス</div>
          <div className="space-y-1.5">
            <StatBar label="HP" value={char.stats.hp} max={1800} color="linear-gradient(90deg,#3ae87c,#2fd86a)" />
            <StatBar label="マナ" value={char.stats.mana} max={450} color="linear-gradient(90deg,#4fa8ff,#3a8aff)" />
            <StatBar label="攻撃力" value={char.stats.atk} max={145} color="linear-gradient(90deg,#ffb02e,#ff8c2e)" />
            <StatBar label="攻撃速度" value={Math.round(char.stats.atkSpeed * 100)} max={120} color="linear-gradient(90deg,#ffe14d,#ffc62e)" />
            <StatBar label="射程" value={char.stats.range} max={13} color="linear-gradient(90deg,#c86aff,#a84dff)" />
            <StatBar label="移動速度" value={char.stats.speed} max={9} color="linear-gradient(90deg,#7ce8a8,#5cd88a)" />
            <StatBar label="防御力" value={char.stats.armor} max={50} color="linear-gradient(90deg,#9aa8c8,#7a88a8)" />
            <StatBar label="回復力" value={Math.round(char.stats.hpRegen * 10) / 10} max={5} color="linear-gradient(90deg,#ff9db0,#ff7a9a)" />
          </div>
          <div className="mt-2 rounded border border-sky-400/15 bg-white/[0.03] p-2 text-[10px] text-slate-400">
            攻撃タイプ: <span className="inline-flex items-center gap-1 font-bold text-slate-200">{char.attack.type === 'melee' ? <><SwordsIcon size={12} /> 近接</> : '遠距離'}</span> /
            武器: <span className="font-bold text-slate-200">{{ sword: '剣', staff: 'スタッフ', daggers: '双短剣', hammer: 'ハンマー', wand: 'ワンド', shuriken: '手裏剣', trident: 'トライデント', bow: '弓', plush: 'ぬいぐるみ' }[char.weapon]}</span> /
            弾形状: <span className="font-bold text-slate-200">{char.attack.shape}</span> /
            発光: <span className="font-bold text-slate-200">{char.attack.glow === 'white' ? '白発光' : '黒発光'}</span>
          </div>
          <div className="mb-2 mt-4 text-xs font-bold tracking-widest text-sky-300">スキル</div>
          <div className="space-y-2">
            {char.skills.map((s) => (
              <div key={s.slot} className="rounded-lg border border-sky-400/15 bg-white/[0.03] p-2.5">
                <div className="flex items-center gap-2">
                  {/* スキルの絵アイコン + 小さなスロットバッジ */}
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sky-400/20 bg-[#0b1230]">
                    <SkillIcon glyph={s.glyph} color={s.color} size={22} />
                    <span className={`absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-black leading-none ${s.ult ? 'bg-amber-400 text-amber-950' : 'bg-sky-500 text-white'}`}>
                      {s.slot}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-white">{s.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500">CD {s.cooldown}s / MP {s.manaCost}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapSelect({
  initialMap, onBack, onStart,
}: {
  initialMap: MapId;
  onBack: () => void;
  onStart: (mapId: MapId) => void;
}) {
  const [sel, setSel] = useState<MapId>(initialMap);
  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between gap-2 border-b border-sky-400/10 bg-[#0a1024]/80 px-3 py-2 sm:px-4 sm:py-3" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}>
        <h1 className="whitespace-nowrap font-display text-base font-bold tracking-widest text-white sm:text-lg">マップ選択</h1>
        <div className="flex gap-1.5 sm:gap-2">
          <DynButton variant="ghost" className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4" onClick={onBack}>← 戻る</DynButton>
          <DynButton variant="play" className="whitespace-nowrap px-5 py-2.5 text-xs sm:px-8 sm:py-2.5 sm:text-sm" onClick={() => onStart(sel)}>バトル開始 ▶</DynButton>
        </div>
      </header>
      <div className="game-scroll flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:flex-row sm:gap-6 sm:p-8">
        {MAPS.map((m) => {
          const active = sel === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSel(m.id)}
              className={`char-card relative h-[300px] w-full max-w-[420px] shrink-0 overflow-hidden rounded-2xl border-2 text-left transition-all sm:h-[380px] sm:w-[420px] sm:max-w-[44%] ${active ? 'scale-[1.02] border-sky-400' : 'border-sky-400/15'}`}
            >
              {/* プレビュー背景 */}
              {m.id === 'battlefield' ? (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0a0e22 0%, #1a2242 55%, #3a3040 100%)' }}>
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-orange-600/40 to-transparent" />
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="title-particle absolute h-1 w-1 rounded-full bg-orange-400/80"
                      style={{ left: `${(i * 37 + 10) % 100}%`, bottom: 0, animationDuration: `${3 + (i % 4)}s`, animationDelay: `${i * 0.4}s`, boxShadow: '0 0 6px #ff8a3c' }} />
                  ))}
                  <div className="absolute left-[20%] top-[30%] h-16 w-3 rotate-12 rounded bg-slate-600/70" />
                  <div className="absolute right-[24%] top-[36%] h-12 w-3 -rotate-6 rounded bg-slate-600/70" />
                  <div className="absolute left-[30%] bottom-[22%] h-3 w-3 rotate-45 bg-violet-400 shadow-[0_0_20px_#7a5cff] pulse-glow" />
                  <div className="absolute right-[32%] bottom-[30%] h-2.5 w-2.5 rotate-45 bg-violet-300 shadow-[0_0_16px_#7a5cff] pulse-glow" />
                </div>
              ) : m.id === 'station' ? (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0d1233 0%, #2a2150 45%, #6a3a58 78%, #ff8a5c 100%)' }}>
                  <div className="absolute left-[14%] top-[30%] h-10 w-8 rounded-t bg-slate-700/80" />
                  <div className="absolute left-[16%] top-[34%] h-2 w-6 rounded bg-amber-300 shadow-[0_0_10px_#ffd86a]" />
                  <div className="absolute right-[16%] top-[24%] h-14 w-10 rounded-t bg-slate-800/90" />
                  <div className="absolute right-[18%] top-[28%] h-2.5 w-7 rounded bg-amber-300 shadow-[0_0_10px_#ffd86a]" />
                  {/* 線路 */}
                  <div className="absolute bottom-[24%] left-0 right-0 h-1 bg-slate-500" />
                  <div className="absolute bottom-[22%] left-0 right-0 h-1 bg-slate-600" />
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="absolute h-3 w-1 bg-slate-700" style={{ left: `${i * 7.4}%`, bottom: '21%' }} />
                  ))}
                  {/* 暴走電車 */}
                  <div className="absolute bottom-[26%] left-[8%] h-8 w-28 rounded-md bg-slate-200 shadow-[0_0_26px_rgba(140,220,255,0.7)]">
                    <div className="absolute inset-x-1 top-1 h-2.5 rounded bg-cyan-300 shadow-[0_0_10px_#7ce8ff]" />
                    <div className="absolute inset-x-1 bottom-1.5 h-1.5 rounded bg-blue-800" />
                    <div className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-100 shadow-[0_0_14px_#fff2cc]" />
                  </div>
                  <div className="absolute bottom-[19%] left-[46%] h-5 w-5 rotate-45 border-2 border-white bg-rose-500/80 shadow-[0_0_12px_rgba(255,80,100,0.8)]" />
                </div>
              ) : m.id === 'mine' ? (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #150e28 0%, #2a1a44 40%, #4a2a4a 72%, #6a3a34 100%)' }}>
                  {/* 奈落 */}
                  <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: 'linear-gradient(180deg, transparent, #0b0812 70%)' }} />
                  {/* 木の橋 (ミッド) */}
                  <div className="absolute bottom-[30%] left-[6%] right-[6%] h-4 rotate-[-6deg] rounded-sm" style={{ background: 'repeating-linear-gradient(90deg, #8a6a44 0 14px, #7a5c38 14px 16px)', boxShadow: '0 3px 10px rgba(0,0,0,0.6)' }} />
                  {/* 橋の手すり */}
                  <div className="absolute bottom-[calc(30%+1.1rem)] left-[8%] right-[8%] h-1 rotate-[-6deg] rounded bg-[#4e3820]" />
                  {/* トロッコ */}
                  <div className="absolute bottom-[calc(30%+0.9rem)] left-[52%] h-6 w-12 rounded-sm bg-[#6a4a2e] shadow-[0_0_18px_rgba(255,179,71,0.55)]">
                    <div className="absolute inset-x-1.5 -top-2 h-2.5 rounded-sm bg-amber-400 shadow-[0_0_12px_#ffb347] pulse-glow" />
                    <div className="absolute -bottom-1 left-1 h-2 w-2 rounded-full bg-slate-800" />
                    <div className="absolute -bottom-1 right-1 h-2 w-2 rounded-full bg-slate-800" />
                  </div>
                  {/* 足場 (円形の岩棚) */}
                  <div className="absolute bottom-[20%] left-[14%] h-10 w-10 rounded-full bg-[#352c40] shadow-[0_4px_0_#241e30]" />
                  <div className="absolute bottom-[24%] right-[18%] h-8 w-8 rounded-full bg-[#352c40] shadow-[0_4px_0_#241e30]" />
                  {/* 奈落に浮かぶ結晶 */}
                  <div className="absolute bottom-[14%] left-[40%] h-3 w-3 rotate-45 bg-violet-400 shadow-[0_0_14px_#8a6cff] pulse-glow" />
                  <div className="absolute bottom-[9%] left-[62%] h-2 w-2 rotate-45 bg-violet-300 shadow-[0_0_10px_#8a6cff] pulse-glow" />
                  <div className="absolute bottom-[11%] left-[24%] h-2.5 w-2.5 rotate-45 bg-fuchsia-300 shadow-[0_0_10px_#c86aff] pulse-glow" />
                  {/* 銀鉱脈 */}
                  <div className="absolute bottom-[26%] left-[22%] flex gap-0.5">
                    <div className="h-2.5 w-2.5 rotate-45 bg-amber-300 shadow-[0_0_10px_#ffb347]" />
                    <div className="mt-1 h-1.5 w-1.5 rotate-45 bg-amber-200 shadow-[0_0_8px_#ffb347]" />
                  </div>
                  {/* 坑木 */}
                  <div className="absolute bottom-[34%] left-[30%] flex gap-8">
                    <div className="h-9 w-1.5 rounded-t bg-[#6a4a2e]" />
                    <div className="h-9 w-1.5 rounded-t bg-[#6a4a2e]" />
                  </div>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="title-particle absolute h-1 w-1 rounded-full bg-orange-400/80"
                      style={{ left: `${(i * 29 + 12) % 100}%`, bottom: 0, animationDuration: `${3 + (i % 3)}s`, animationDelay: `${i * 0.5}s`, boxShadow: '0 0 6px #ff9a5c' }} />
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #3a9ae8 0%, #7cc8f8 45%, #e8d29a 100%)' }}>
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cyan-500/50 to-transparent" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="title-particle absolute h-1.5 w-1.5 rounded-full bg-pink-300/90"
                      style={{ left: `${(i * 41 + 8) % 100}%`, bottom: 0, animationDuration: `${4 + (i % 3)}s`, animationDelay: `${i * 0.5}s`, boxShadow: '0 0 6px #ffb0c8' }} />
                  ))}
                  {/* ヤシの木 (SVG) */}
                  <svg viewBox="0 0 24 24" className="absolute left-[16%] top-[36%]" width={44} height={44} aria-hidden>
                    <path d="M12 21 c-.4 -5 .2 -9.5 1.5 -13" stroke="#8a6a48" strokeWidth={1.6} fill="none" strokeLinecap="round" />
                    <path d="M13.5 8 C11 4.5 7 4.8 5.5 7.5 c3 -.6 5 .2 8 .5 Z M13.5 8 c-.6 -4 2.6 -6 5.8 -5 -1.6 1.4 -2.8 3 -3.6 5.4 Z M13.5 8 c3.6 -1.4 6.4 .4 7 3 -2.6 -1.2 -5 -1.4 -7 -.4 Z" fill="#3cae5c" />
                  </svg>
                  {/* パラソル (SVG) */}
                  <svg viewBox="0 0 24 24" className="absolute right-[20%] top-[40%]" width={38} height={38} aria-hidden>
                    <path d="M12 4 a8 8 0 0 1 8 8 H4 a8 8 0 0 1 8 -8 Z" fill="#ff6a7a" />
                    <path d="M12 3.4 v0.6 M12 12 v8.6" stroke="#d8d0c0" strokeWidth={1.4} strokeLinecap="round" />
                  </svg>
                  {/* 浮き輪 (SVG) */}
                  <svg viewBox="0 0 24 24" className="absolute left-[38%] bottom-[16%] float-y" width={30} height={30} aria-hidden>
                    <circle cx="12" cy="12" r="8" fill="none" stroke="#ffe14d" strokeWidth={4} />
                    <circle cx="12" cy="12" r="8" fill="none" stroke="#ff6a7a" strokeWidth={4} strokeDasharray="6.3 6.3" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
              {m.main && (
                <div className="absolute right-3 top-3 rounded bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">メイン</div>
              )}
              {active && <div className="absolute left-3 top-3 rounded bg-sky-400 px-2 py-0.5 text-[10px] font-black text-sky-950">選択中</div>}
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                <div className="font-display text-[10px] tracking-[0.4em] text-sky-300">{m.subtitle}</div>
                <div className="font-display text-lg font-black text-white sm:text-xl">{m.name}</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-300">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
