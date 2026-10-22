'use client';

// ============================================================
// AETHER LEAGUE - メインメニュー
// 背景: ぼかした夕景イメージ / パーティ招待 (◇+) / 敵チーム & デュエル選択
// ============================================================

import { useMemo, useState } from 'react';
import type { SaveData } from '@/game/types';
import type { PlayerInfo, PartyState } from '@/game/net/online';
import { getChar, CHARACTERS } from '@/game/characters';
import { getMap } from '@/game/maps';
import { playerExpNeed, TROPHIES } from '@/game/storage';
import { audio } from '@/game/audio';
import { DynButton, CoinIcon, ROLE_COLOR } from '../ui';
import { CharPreview } from '../TitleBg';
import {
  SwordsIcon, GlobeIcon, TrophyIcon, TicketIcon, GearIcon, GiftIcon,
  BotIcon, MailIcon, PlayIcon,
} from '../Icons';

export interface MainMenuOnline {
  ok: boolean;
  myPid: string;
  players: PlayerInfo[];
  party: PartyState | null;
  onInviteOnline: (pid: string) => void;
  onAddBotOnline: (name: string, charId: string) => void;
  onDuelOnline: (pid: string) => void;
  onLeaveParty: () => void;
  onKickPartyOnline: (pid: string) => void;
  onStartParty: (mapId: string) => void;
}

interface Props {
  save: SaveData;
  onNav: (s: 'charselect' | 'mapselect' | 'trophies' | 'battlepass' | 'settings' | 'online' | 'title') => void;
  onQuickPlay: (opts?: { duelEnemy?: string }) => void;
  onInvite: (name: string, charId: string) => void;
  onKickParty: (idx: number) => void;
  onLoginBonus: () => void;
  online: MainMenuOnline;
}

export function MainMenu({ save, onNav, onQuickPlay, onInvite, onKickParty, onLoginBonus, online }: Props) {
  const char = getChar(save.lastChar);
  const map = getMap(save.lastMap);
  const expNeed = playerExpNeed(save.playerLevel);
  const unlockedCount = save.trophies.unlocked.length;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<'online' | 'bot'>('online');
  const [inviteName, setInviteName] = useState('');
  const [inviteChar, setInviteChar] = useState(CHARACTERS.find((c) => c.id !== save.lastChar)?.id ?? CHARACTERS[0].id);
  const [duelEnemy, setDuelEnemy] = useState<string | null>(null);

  const onlineParty = online.party;
  const isPartyHost = !!onlineParty && onlineParty.host === online.myPid;
  const botParty = onlineParty ? [] : save.party;
  // オンラインパーティ: 人間は最大3人 / Bot込みで最大6枠 (3v3の6スロット)
  const onlineHumans = onlineParty ? onlineParty.members.filter((m) => !m.isBot).length : 0;
  const canInviteHuman = !onlineParty || onlineHumans < 3;
  const canAddBot = !onlineParty || onlineParty.members.length < 6;
  const partyFull = onlineParty ? !canInviteHuman && !canAddBot : botParty.length >= 2;
  const others = online.players.filter((p) => p.pid !== online.myPid);
  const lobbyOthers = others.filter((p) => p.status === 'lobby');

  // 敵チームプレビュー (固定編成・編集不可。自分のキャラと重複しない3体)
  const enemyTeam = useMemo(() => {
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== save.lastChar);
    return pool.slice(0, 3);
  }, [save.lastChar]);

  const partyFullOld = save.party.length >= 2;

  const doInvite = () => {
    const name = inviteName.trim();
    if (!name) return;
    if (onlineParty) {
      // オンラインパーティ中 → サーバ側のパーティBotとして追加 (全員に配信・キック可)
      if (!canAddBot) return;
      online.onAddBotOnline(name, inviteChar);
    } else {
      if (partyFullOld) return;
      onInvite(name, inviteChar);
    }
    audio.sfx('invite');
    setInviteName('');
    setInviteOpen(false);
  };

  const toggleDuel = (id: string) => {
    audio.sfx('duel');
    setDuelEnemy((cur) => (cur === id ? null : id));
  };

  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      {/* 背景: 夕景イメージのぼかし + 被せグラデーション */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/main-bg.jpg)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(7,11,24,0.55), rgba(7,11,24,0.35) 40%, rgba(7,11,24,0.8)), radial-gradient(1200px 600px at 70% -10%, rgba(60,90,200,0.18), transparent)',
        }}
      />

      {/* 上部バー */}
      <header className="relative z-10 flex items-center gap-2 border-b border-sky-400/10 bg-[#0a1024]/80 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <button onClick={() => onNav('title')} className="menu-logo-short font-display text-sm font-black tracking-widest text-sky-300 text-glow-blue">
          AETHER LEAGUE
        </button>
        <div className="hud-panel flex items-center gap-1.5 rounded-lg px-2 py-1 sm:gap-2.5 sm:px-3 sm:py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 font-display text-xs font-black text-white sm:h-9 sm:w-9 sm:text-sm">
            {save.playerLevel}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold text-slate-100 sm:text-xs">{save.playerName}</div>
            <div className="mt-0.5 hidden h-1 w-28 overflow-hidden rounded-full bg-slate-700 sm:block">
              <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-400" style={{ width: `${(save.playerExp / expNeed) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hud-panel flex items-center gap-1 rounded-lg px-2 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5">
            <CoinIcon />
            <span className="text-xs font-bold text-amber-200 sm:text-sm">{save.coins.toLocaleString()}</span>
          </div>
          <DynButton variant={save.login.available ? 'gold' : 'ghost'} className="px-2 py-2 text-xs sm:px-3" onClick={onLoginBonus}>
            <GiftIcon size={14} /><span className="ml-1 hidden sm:inline">ログインボーナス</span>
            {save.login.available && <span className="ml-1 h-2 w-2 rounded-full bg-red-400 pulse-glow" />}
          </DynButton>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* 左ナビ (スマホはアイコンのみ) */}
        <nav className="flex w-14 shrink-0 flex-col gap-2 border-r border-sky-400/10 bg-[#0a0f22]/70 p-2 sm:w-52 sm:p-3">
          <NavBtn icon={<SwordsIcon size={17} />} label="プレイ" active onClick={() => onNav('charselect')} />
          <NavBtn icon={<GlobeIcon size={17} />} label="オンライン対戦" onClick={() => onNav('online')} />
          <NavBtn icon={<TrophyIcon size={17} />} label="トロフィー" badge={save.trophies.newUnlock.length || undefined} onClick={() => onNav('trophies')} />
          <NavBtn icon={<TicketIcon size={17} />} label="バトルパス" badge={save.battlePass.tier} onClick={() => onNav('battlepass')} />
          <NavBtn icon={<GearIcon size={17} />} label="設定" onClick={() => onNav('settings')} />
          {/* オンラインプレイヤー (デュエル申込) */}
          <div className="mt-1 hidden rounded-lg border border-emerald-400/15 bg-[#0c1430]/80 p-2.5 sm:block">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${online.ok ? 'bg-emerald-400 pulse-glow' : 'bg-slate-500'}`} />
              <span className="text-[10px] font-bold tracking-widest text-emerald-300">ONLINE {others.length}人</span>
            </div>
            <div className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {others.length === 0 && (
                <div className="text-[10px] leading-4 text-slate-500">
                  {online.ok ? '他のプレイヤーはまだいません。友人をこのゲームに呼んでみよう！' : 'サーバーに接続中…'}
                </div>
              )}
              {others.map((p) => (
                <div key={p.pid} className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1">
                  <span className={`h-1 w-1 shrink-0 rounded-full ${p.status === 'battle' ? 'bg-rose-400' : p.status === 'party' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-200">{p.name}</span>
                  {p.status === 'lobby' ? (
                    <button
                      onClick={() => { audio.sfx('duel'); online.onDuelOnline(p.pid); }}
                      className="rounded bg-rose-500/80 px-1.5 py-0.5 text-rose-50 transition-colors hover:bg-rose-400"
                      title="デュエル (1v1) を申し込む"
                    >
                      <SwordsIcon size={11} />
                    </button>
                  ) : (
                    <span className="text-[8px] font-bold text-slate-500">{p.status === 'battle' ? '戦闘中' : 'パーティ中'}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[9px] leading-3 text-slate-500"><SwordsIcon size={10} /> でデュエルを申し込む</div>
          </div>
          <div className="mt-auto hidden rounded-lg border border-sky-400/15 bg-[#0c1430]/80 p-3 sm:block">
            <div className="text-[10px] tracking-widest text-slate-400">戦績</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
              <span className="text-slate-400">勝利</span><span className="text-right font-bold text-emerald-300">{save.stats.wins}</span>
              <span className="text-slate-400">敗北</span><span className="text-right font-bold text-rose-300">{save.stats.losses}</span>
              <span className="text-slate-400">キル</span><span className="text-right font-bold text-slate-200">{save.stats.kills}</span>
              <span className="text-slate-400">トロフィー</span><span className="text-right font-bold text-amber-300">{unlockedCount}/{TROPHIES.length}</span>
            </div>
          </div>
        </nav>

        {/* 中央: キャラ展示 + PARTY + PLAY */}
        <main className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <CharPreview charId={char.id} skin={save.selectedSkin[char.id] && save.ownedSkins.includes(save.selectedSkin[char.id]) ? save.selectedSkin[char.id] : undefined} />
          </div>
          <div className="absolute left-3 top-3 sm:left-5 sm:top-4">
            <div className="text-[11px] tracking-widest" style={{ color: ROLE_COLOR[char.role] }}>{char.role}</div>
            <h1 className="font-display text-3xl font-black text-white text-glow-blue sm:text-4xl">{char.name}</h1>
            <div className="text-xs text-slate-300">{char.title} - <ElementGlyph element={char.element} /> {char.element}属性</div>
          </div>

          {/* 右上: 操作早見 */}
          <div className="hud-panel absolute right-4 top-4 hidden rounded-lg px-3 py-2 text-[10px] leading-5 text-slate-300 lg:block">
            <div className="mb-1 font-bold text-sky-300">操作 (デフォルト)</div>
            <div>WASD 移動 / SPACE 攻撃</div>
            <div>Q スキル1 / E スキル2 / R 必殺技</div>
            <div>F ガード / C メニュー / G ショップ</div>
          </div>

          {/* 右: 敵チーム & デュエル選択 / オンラインプレイヤー */}
          <div className="enemy-col-short absolute right-2 top-24 z-20 w-36 sm:right-4 sm:top-32 sm:w-44">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-rose-300">ENEMY TEAM</span>
              <span className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold text-slate-500" title="敵チームは編集できません">
                <LockGlyph size={10} /> 固定
              </span>
            </div>
            {onlineParty ? (
              <div className="rounded-lg border border-sky-400/25 bg-black/50 p-2 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-sky-300"><GlobeIcon size={10} /> オンラインパーティ中</div>
                <div className="mt-1 text-[10px] text-slate-300">{onlineParty.members.length}人で3v3・{isPartyHost ? 'あなたがホスト' : `ホスト: ${onlineParty.members.find((m) => m.pid === onlineParty.host)?.name ?? ''}`}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {enemyTeam.map((id) => {
                  const ec = getChar(id);
                  const selected = duelEnemy === id;
                  return (
                    <button
                      key={id}
                      onClick={() => toggleDuel(id)}
                      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left backdrop-blur-sm transition-all
                        ${selected
                          ? 'border-rose-400 bg-rose-500/25 shadow-[0_0_14px_rgba(255,77,109,0.4)]'
                          : 'border-rose-400/20 bg-black/45 hover:border-rose-400/60 hover:bg-rose-500/10'}`}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md font-display text-[10px] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${ec.colors.primary ?? '#475'}, ${ec.colors.secondary ?? '#789'})` }}
                      >
                        {ec.name.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-white">{ec.name}</span>
                        <span className="block text-[9px] text-slate-400">{ec.role}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {duelEnemy && !onlineParty && (
              <div className="mt-2 rounded-lg border border-rose-400/50 bg-rose-950/60 p-2 text-center backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-200"><SwordsIcon size={11} /> デュエル選択中</div>
                <div className="text-xs font-black text-white">vs {getChar(duelEnemy).name} (1v1)</div>
                <button onClick={() => { audio.sfx('click'); setDuelEnemy(null); }} className="mt-1 text-[10px] text-slate-400 underline hover:text-white">
                  取り消す (3v3に戻す)
                </button>
              </div>
            )}
          </div>

          {/* 下部: PARTY + プレイ */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 p-2.5 pt-1.5 sm:gap-3 sm:p-5 sm:pt-2">
            {/* パーティ行 (自分のキャラの隣に ◇+ とメンバー) */}
            <div className="hud-panel flex w-full max-w-xl items-center gap-2 rounded-xl px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
              <span className="text-[10px] font-bold tracking-widest text-sky-300">PARTY</span>
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                {/* 自分 */}
                <div className="flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1.5">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-md font-display text-[9px] font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${char.colors.primary ?? '#48c'}, ${char.colors.secondary ?? '#7ae'})` }}
                  >
                    {char.name.slice(0, 2)}
                  </span>
                  <span className="text-xs font-bold text-white">{save.playerName}</span>
                  <span className="rounded bg-sky-500/30 px-1 text-[8px] font-black text-sky-100">{onlineParty ? (isPartyHost ? 'HOST' : 'MEMBER') : 'LEADER'}</span>
                </div>
                {/* ◇+ 招待ボタン */}
                {!partyFull && (
                  <button
                    onClick={() => { audio.sfx('click'); setInviteTab('online'); setInviteOpen(true); }}
                    className="group relative grid h-11 w-11 shrink-0 place-items-center"
                    title="パーティに招待 (プレイヤー / ボット)"
                  >
                    <span className="block h-6 w-6 rotate-45 rounded-[4px] border-2 border-sky-300/80 bg-sky-500/10 shadow-[0_0_12px_rgba(80,200,255,0.4)] transition-transform group-hover:scale-110 group-hover:border-sky-200" />
                    <span className="absolute font-display text-base font-black leading-none text-sky-100">+</span>
                  </button>
                )}
                {/* オンラインメンバー (実プレイヤー / パーティBot) */}
                {onlineParty?.members.filter((m) => m.pid !== online.myPid).map((m) => (
                  m.isBot ? (
                    <div key={m.pid} className="relative flex items-center gap-2 rounded-lg border border-slate-400/30 bg-slate-500/10 px-2.5 py-1.5">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-md font-display text-[9px] font-black text-white opacity-90"
                        style={{ background: `linear-gradient(135deg, #556, #99a)` }}
                      >
                        <BotIcon size={14} />
                      </span>
                      <span className="max-w-24 truncate text-xs font-bold text-white">{m.name}</span>
                      <span className="rounded bg-slate-500/40 px-1 text-[8px] font-black text-slate-100">BOT</span>
                      {isPartyHost && <KickBtn onClick={() => online.onKickPartyOnline(m.pid)} />}
                    </div>
                  ) : (
                    <div key={m.pid} className="relative flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-glow" />
                      <span className="max-w-24 truncate text-xs font-bold text-white">{m.name}</span>
                      {isPartyHost && <KickBtn onClick={() => online.onKickPartyOnline(m.pid)} />}
                    </div>
                  )
                ))}
                {/* ボットメンバー (オフライン時のみ) */}
                {botParty.map((m, i) => {
                  const mc = getChar(m.charId);
                  return (
                    <div key={i} className="relative flex items-center gap-2 rounded-lg border border-slate-400/30 bg-slate-500/10 px-2.5 py-1.5">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-md font-display text-[9px] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${mc.colors.primary ?? '#4a8'}, ${mc.colors.secondary ?? '#7db'})` }}
                      >
                        {mc.name.slice(0, 2)}
                      </span>
                      <span className="max-w-24 truncate text-xs font-bold text-white">{m.name}</span>
                      <span className="rounded bg-slate-500/40 px-1 text-[8px] font-black text-slate-100">BOT</span>
                      <KickBtn onClick={() => onKickParty(i)} />
                    </div>
                  );
                })}
                {onlineParty && (
                  <button onClick={() => { audio.sfx('click'); online.onLeaveParty(); }} className="ml-auto text-[10px] text-rose-300 underline hover:text-rose-200">
                    退出
                  </button>
                )}
                {!onlineParty && botParty.length === 0 && (
                  <span className="text-[10px] text-slate-400">◇+ からプレイヤー / ボットを招待</span>
                )}
                {onlineParty && isPartyHost && (
                  <span className="ml-auto hidden text-[9px] leading-3 text-slate-500 sm:inline">メンバーの ✕ で外せる</span>
                )}
              </div>
            </div>

            <div className="hud-panel flex w-full max-w-xl items-center gap-3 rounded-xl px-2.5 py-2 sm:px-4 sm:py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-widest text-slate-400">選択マップ</div>
                <div className="truncate text-[13px] font-bold text-white sm:text-sm">
                  {map.name} {map.main && <span className="ml-1 rounded bg-rose-500/80 px-1.5 py-0.5 text-[9px] font-bold text-white">メイン</span>}
                </div>
              </div>
              <button
                onClick={() => { audio.sfx('click'); onNav('mapselect'); }}
                className="shrink-0 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-[10px] font-bold text-sky-200 transition-all hover:bg-sky-500/30 active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                変更
              </button>
              <div className="min-w-0 flex-1 border-l border-sky-400/15 pl-3">
                <div className="text-[10px] tracking-widest text-slate-400">モード</div>
                <div className="text-xs font-bold text-white">
                  {onlineParty
                    ? <span className="flex items-center gap-1 text-sky-300"><GlobeIcon size={11} /> オンライン 3v3 ({onlineParty.members.length}人)</span>
                    : duelEnemy
                      ? <span className="flex items-center gap-1 text-rose-300"><SwordsIcon size={11} /> デュエル 1v1 vs {getChar(duelEnemy).name}</span>
                      : `3v3 ${save.party.length > 0 ? '(パーティ編成)' : '(ランダム)'}`}
                </div>
              </div>
            </div>

            {onlineParty ? (
              isPartyHost ? (
                <div className="float-y">
                  <DynButton variant="play" hit className="whitespace-nowrap px-5 sm:px-10" onClick={() => { audio.sfx('click'); online.onStartParty(save.lastMap); }}>
                    <GlobeIcon size={15} /> パーティで開始 (3v3)
                  </DynButton>
                </div>
              ) : (
                <div className="hud-panel flex items-center gap-2 rounded-xl px-4 py-3 text-center text-xs font-bold text-sky-200">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 pulse-glow" />
                  ホストの開始を待っています…
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <DynButton variant="primary" className="whitespace-nowrap px-4 py-3 sm:px-8 sm:py-4" onClick={() => onNav('charselect')}>
                  キャラ選択
                </DynButton>
                <div className="float-y">
                  <DynButton
                    variant={duelEnemy ? 'danger' : 'play'}
                    hit
                    className="whitespace-nowrap px-6 sm:px-10"
                    onClick={() => onQuickPlay(duelEnemy ? { duelEnemy } : undefined)}
                  >
                    {duelEnemy
                      ? <span className="inline-flex items-center gap-2"><SwordsIcon size={15} /> デュエル開始</span>
                      : <span className="inline-flex items-center gap-2"><PlayIcon size={15} /> クイックプレイ</span>}
                  </DynButton>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 下部ニュース */}
      <footer className="relative z-10 border-t border-sky-400/10 bg-[#0a1024]/80 px-3 py-1.5" style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center gap-2 overflow-hidden text-[11px] text-slate-400">
          <span className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 font-bold text-sky-300">NEWS</span>
          <span className="hidden truncate md:inline">シーズン1「エーテルの覚醒」開催中！パーティを組んで3v3、またはデュエル1v1に挑もう。</span>
          <span className="truncate text-[10px] md:hidden">3v3 & 1v1 開催中</span>
          <span className="ml-auto hidden shrink-0 text-slate-500 sm:inline">サーバー: 接続OK</span>
        </div>
      </footer>

      {/* ===== 招待モーダル (オンライン / ボット) ===== */}
      {inviteOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
          <div className="slide-up-in hud-panel w-96 max-w-[92vw] rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-center text-lg font-black tracking-widest text-white">パーティに招待</h2>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-1">
              <button
                onClick={() => { audio.sfx('hover'); setInviteTab('online'); }}
                className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-all ${inviteTab === 'online' ? 'bg-sky-500/30 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <GlobeIcon size={12} /> オンラインで招待
              </button>
              <button
                onClick={() => { audio.sfx('hover'); setInviteTab('bot'); }}
                className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-all ${inviteTab === 'bot' ? 'bg-sky-500/30 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <BotIcon size={12} /> ボットで呼ぶ
              </button>
            </div>

            {inviteTab === 'online' ? (
              <>
                <p className="mt-3 text-center text-[11px] text-slate-400">
                  今このゲームを遊んでいるプレイヤーに招待を送る (承認されると参加)
                </p>
                {onlineParty && !canInviteHuman && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-[10px] text-amber-300/80">人間は最大3人まで (<BotIcon size={10} /> タブからボットを追加できます)</p>
                )}
                <div className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {lobbyOthers.length === 0 && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center text-[11px] leading-5 text-slate-400">
                      {online.ok
                        ? '今はオンラインのプレイヤーがいません。\n友人にこのゲームを教えて、同じ時間に遊ぼう！'
                        : 'オンラインサーバーに接続中…'}
                    </div>
                  )}
                  {lobbyOthers.map((p) => (
                    <div key={p.pid} className="flex items-center gap-2.5 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 pulse-glow" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-white">{p.name}</span>
                        <span className="block text-[9px] text-slate-400">ロビーで待機中</span>
                      </span>
                      <button
                        onClick={() => { audio.sfx('invite'); online.onInviteOnline(p.pid); setInviteOpen(false); }}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500/80 px-3 py-1.5 text-[10px] font-black text-white transition-colors hover:bg-emerald-400"
                      >
                        <MailIcon size={11} /> 招待
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-center text-[11px] text-slate-400">
                  {onlineParty
                    ? 'ボットをパーティに追加する (開始時にチームへ配属・メンバーの ✕ で外せる)'
                    : '名前を入れてボットを仲間に呼ぶ (オフライン練習用)'}
                </p>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doInvite(); }}
                  maxLength={12}
                  placeholder="プレイヤー名"
                  className="mt-4 w-full rounded-lg border border-sky-400/30 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400"
                />
                <div className="mt-3 text-[10px] tracking-widest text-slate-400">使用キャラを選択</div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {CHARACTERS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { audio.sfx('hover'); setInviteChar(c.id); }}
                      className={`rounded-lg border px-1 py-2 text-center transition-all
                        ${inviteChar === c.id
                          ? 'border-sky-400 bg-sky-500/25 shadow-[0_0_10px_rgba(79,209,255,0.35)]'
                          : 'border-white/10 bg-white/[0.03] hover:border-sky-400/40'}`}
                    >
                      <span
                        className="mx-auto grid h-8 w-8 place-items-center rounded-md font-display text-[9px] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${c.colors.primary ?? '#48c'}, ${c.colors.secondary ?? '#7ae'})` }}
                      >
                        {c.name.slice(0, 2)}
                      </span>
                      <span className="mt-1 block truncate text-[9px] font-bold text-slate-200">{c.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <DynButton variant="ghost" className="flex-1 py-2.5" onClick={() => setInviteOpen(false)}>キャンセル</DynButton>
                  <DynButton
                    variant="primary" className="flex-1 py-2.5"
                    disabled={!inviteName.trim() || !!(onlineParty && !canAddBot)}
                    onClick={doInvite}
                  >
                    <MailIcon size={13} /> 呼ぶ
                  </DynButton>
                </div>
              </>
            )}
            {inviteTab === 'online' && (
              <div className="mt-4">
                <DynButton variant="ghost" className="w-full py-2.5" onClick={() => setInviteOpen(false)}>閉じる</DynButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// キックボタン (常時表示・タップ端末でも押せるよう 22px + 拡大ヒットエリア)
function KickBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); audio.sfx('click'); onClick(); }}
      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-[0_0_8px_rgba(244,63,94,0.55)] transition-transform hover:scale-125"
      title="パーティから外す (キック)"
      style={{ touchAction: 'manipulation' }}
    >
      ✕
    </button>
  );
}

// ナビボタン (スマホはアイコンのみ・バッジは右上ドット)
function NavBtn({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-0 py-3 text-left text-sm font-bold transition-all sm:px-3.5
        ${active
          ? 'border-sky-400/60 bg-gradient-to-r from-sky-500/25 to-indigo-500/10 text-white shadow-[0_0_18px_rgba(79,209,255,0.25)]'
          : 'border-transparent bg-white/[0.03] text-slate-300 hover:translate-x-1 hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-white'}`}
    >
      <span className="mx-auto flex h-7 w-7 items-center justify-center sm:mx-0 sm:h-auto sm:w-auto">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && (
        <span className="absolute right-0.5 top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-amber-400/90 px-1 text-[8px] font-black text-amber-950 sm:static sm:ml-auto sm:h-auto sm:min-w-0 sm:text-[10px]">{badge}</span>
      )}
      <span className="absolute bottom-0 left-0 hidden h-px w-0 bg-gradient-to-r from-sky-400 to-transparent transition-all group-hover:w-full sm:block" />
    </button>
  );
}

// 属性の小さなSVGアイコン (絵文字の代わり)
function ElementGlyph({ element, size = 13 }: { element: string; size?: number }) {
  const map: Record<string, string> = {
    炎: '#ff7a3c', 氷: '#7cd8ff', 雷: '#ffe14d', 土: '#c8a05c',
    光: '#ffe9a0', 闇: '#b08aff', 水: '#4fc8ff', 風: '#8cf0c0',
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="inline-block align-[-2px]">
      <ElementInline element={element} color={map[element] ?? '#9ab4d8'} />
    </svg>
  );
}

function ElementInline({ element, color }: { element: string; color: string }) {
  switch (element) {
    case '炎': return <path d="M12 3.5 c1 3 -2.6 4.6 -2.6 7.6 a4.6 4.6 0 0 0 9.2 .4 c1.5 -3.5 -1.6 -5.5 -2.6 -8 c-.6 1.6 -1.6 2.2 -2.4 2.6 C13 5.2 12.4 4.6 12 3.5 Z" fill={color} />;
    case '氷': return <path d="M12 3 v18 M4.2 7.5 l15.6 9 M19.8 7.5 l-15.6 9" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />;
    case '雷': return <path d="M13.4 2.5 L6 13.4 h4.4 L9.6 21.5 L18 10 h-4.8 Z" fill={color} />;
    case '土': return <path d="M3 19 L9 8 l3.4 5.4 L15 10 l6 9 Z" fill={color} />;
    case '光': return <g stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.9}><path d="M12 4 v16 M4 12 h16 M6.3 6.3 l11.4 11.4 M17.7 6.3 L6.3 17.7" /></g>;
    case '闇': return <path d="M19.5 14.2 A8 8 0 1 1 9.8 4.5 a6.6 6.6 0 0 0 9.7 9.7 Z" fill={color} />;
    case '水': return <path d="M12 3.5 c3.4 4.6 5.8 8 5.8 11 a5.8 5.8 0 0 1 -11.6 0 c0 -3 2.4 -6.4 5.8 -11 Z" fill={color} />;
    case '風': return <g stroke={color} strokeWidth={2} fill="none" strokeLinecap="round"><path d="M3.5 9 h9.4 a2.7 2.7 0 1 0 -2.7 -2.7 M3.5 13.5 h13.8 a2.9 2.9 0 1 1 -2.9 2.9 M3.5 18 h6.8 a2.4 2.4 0 1 1 -2.4 2.4" /></g>;
    default: return <circle cx="12" cy="12" r="7" fill={color} />;
  }
}

function LockGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="6" y="10.5" width="12" height="9" rx="1.6" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <path d="M8.5 10.5 V8 a3.5 3.5 0 0 1 7 0 v2.5" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <circle cx="12" cy="14.8" r="1.3" fill="currentColor" />
    </svg>
  );
}
