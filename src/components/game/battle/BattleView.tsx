'use client';

// ============================================================
// AETHER LEAGUE - 戦闘画面 (3D + HUD)
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HudSkill, HudSnapshot, MapId, SaveData, SkillGlyph, Team } from '@/game/types';
import { Battle } from '@/game/engine/battle';
import { getChar } from '@/game/characters';
import { SHOP_ITEMS } from '@/game/characters';
import { LANE_SAMPLES, RIVER_SAMPLES } from '@/game/maps';
import { audio } from '@/game/audio';
import type { NetAdapter, NetPeer } from '@/game/net/online';
import { CoinIcon, DynButton } from '../ui';
import { SkillIcon } from '../SkillIcon';
import { PINGS, PingIcon, PlayIcon, type PingKey } from '../Icons';

// ------------------------------------------------------------
// メイン
// ------------------------------------------------------------

export interface BattleViewProps {
  save: SaveData;
  charId: string;
  mapId: MapId;
  mode: 'bot' | 'online';
  side?: Team;
  net?: NetAdapter | null;
  netPeers?: NetPeer[];    // online: 自分以外の参加者 (人間+bot)
  myPid?: string;          // online: 自分のpid
  oppCharId?: string;      // (後方互換・未使用)
  allyCharIds?: string[];  // bot: 味方AI
  allyNames?: (string | undefined)[];  // bot: パーティメンバーの表示名
  enemyCharIds?: string[]; // bot: 敵AI
  onEnd: (stats: HudLessResult) => void;
  onExit: () => void;
}

export interface HudLessResult {
  kills: number; deaths: number; assists: number; cs: number;
  damage: number; towers: number; duration: number;
  win: boolean; charId: string; mapId: MapId; mode: 'bot' | 'online';
}

interface FeedItem { id: number; killer: string; victim: string; killerTeam: Team; victimTeam: Team; firstBlood?: boolean }
interface AnnItem { id: number; text: string; sub?: string; color?: string }
interface DmgNum { id: number; x: number; y: number; amount: number; heal?: boolean }
interface PingItem { id: number; text: string; mine: boolean }

let feedSeq = 0;

export function BattleView({ save, charId, mapId, mode, net, netPeers, myPid, allyCharIds, allyNames, enemyCharIds, onEnd, onExit }: BattleViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Battle | null>(null);
  const menuOpenRef = useRef(false);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [ann, setAnn] = useState<AnnItem | null>(null);
  const [dmgs, setDmgs] = useState<DmgNum[]>([]);
  // ダメージ数字の一括フラッシュ用バッファ (イベントのたびの再レンダーを回避 → 激戦でもフレームレートが安定)
  const dmgBufRef = useRef<DmgNum[]>([]);
  const dmgExpRef = useRef<{ id: number; at: number }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [pings, setPings] = useState<PingItem[]>([]);
  const [pingWheel, setPingWheel] = useState(false);
  const [hudReady, setHudReady] = useState(false);
  const endedRef = useRef(false);
  const char = getChar(charId);
  const mobile = save.settings.mobile.enabled;
  const autoAttack = mobile || (save.settings.mobile.autoDetect && typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);

  // HUD表示後にマウントされる頭上HPバーキャンバスをエンジンへ接続
  const attachPlates = useCallback((cv: HTMLCanvasElement | null) => {
    engineRef.current?.attachPlates(cv);
  }, []);

  // エンジン起動
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Battle;
    try {
      engine = new Battle({
        canvas,
        mapId,
        playerCharId: charId,
        graphics: save.settings.graphics,
        keybinds: save.settings.keybinds,
        allyCharIds: allyCharIds ?? [],
        allyNames,
        enemyCharIds: enemyCharIds ?? [],
        netPeers,
        myPid,
        playerName: save.playerName,
        mode,
        side: mode === 'online' ? net?.side : undefined,
        net: net ?? null,
        cameraShake: save.settings.cameraShake,
        autoAttack,
        onHud: (h) => {
          setHud(h);
          setShowStatus(engine.isStatusHeld());
        },
        onPauseRequest: () => {
          // C キーでメニュー開閉 (メニュー中のみ一時停止)
          if (endedRef.current) return;
          const next = !menuOpenRef.current;
          menuOpenRef.current = next;
          engine.pause(next);
          if (next) setShopOpen(false);
          setMenuOpen(next);
        },
        onShopRequest: () => {
          // G キーでショップ開閉 — ゲームは一時停止しない (戦闘継続)
          if (endedRef.current) return;
          setShopOpen((v) => !v);
        },
        onPingRequest: () => {
          // T キーで指令ホイール開閉
          if (endedRef.current) return;
          setPingWheel((v) => !v);
        },
        onEvent: (e) => {
          if (e.type === 'killfeed') {
            const item: FeedItem = {
              id: ++feedSeq,
              killer: e.killer as string, victim: e.victim as string,
              killerTeam: e.killerTeam as Team, victimTeam: e.victimTeam as Team,
              firstBlood: e.firstBlood as boolean,
            };
            setFeed((f) => [...f.slice(-3), item]);
            setTimeout(() => setFeed((f) => f.filter((x) => x.id !== item.id)), 6500);
          } else if (e.type === 'ping') {
            // 指令表示 (右側に3秒だけ小さな字で)
            const item: PingItem = { id: ++feedSeq, text: e.text as string, mine: (e.from as string) === save.playerName };
            setPings((f) => [...f.slice(-2), item]);
            setTimeout(() => setPings((f) => f.filter((x) => x.id !== item.id)), 3000);
          } else if (e.type === 'announce') {
            if (!save.settings.announcements && !(e.text as string).includes('勝利') && !(e.text as string).includes('敗北')) return;
            const item: AnnItem = { id: ++feedSeq, text: e.text as string, sub: e.sub as string, color: e.color as string };
            setAnn(item);
            setTimeout(() => setAnn((a) => (a?.id === item.id ? null : a)), 2400);
          } else if (e.type === 'sfx') {
          // エンジン発の効果音
          audio.sfx(e.name as string);
        } else if (e.type === 'levelup') {
          audio.sfx('levelup');
        } else if (e.type === 'dmg') {
            const p = engine.project(e.x as number, e.y as number, e.z as number);
            const d: DmgNum = { id: ++feedSeq, x: p.x, y: p.y, amount: e.amount as number, heal: e.heal as boolean };
            dmgBufRef.current.push(d);
            dmgExpRef.current.push({ id: d.id, at: performance.now() + 1000 });
          } else if (e.type === 'end') {
            const result = e.result as { win: boolean; stats: { kills: number; deaths: number; assists: number; cs: number; damage: number; towers: number; duration: number; charId: string; mapId: MapId; mode: 'bot' | 'online' } };
            if (endedRef.current) return;
            endedRef.current = true;
            setShopOpen(false);
            setPingWheel(false);
            setTimeout(() => {
              onEnd({ ...result.stats, win: result.win });
            }, 2200);
          }
        },
        perf: save.settings.perf,
      });
    } catch (err) {
      console.error('Battle init failed', err);
      return;
    }
    engineRef.current = engine;
    engine.start();
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);

    // ハプティクス
    const haptic = (ev: Event) => {
      const e = ev as CustomEvent;
      if (save.settings.mobile.haptics && navigator.vibrate) navigator.vibrate(e.detail || 20);
    };
    window.addEventListener('al-haptic', haptic);

    return () => {
      ro.disconnect();
      window.removeEventListener('al-haptic', haptic);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // ミニマップ描画
  useEffect(() => {
    const iv = setInterval(() => {
      const cv = miniRef.current;
      const engine = engineRef.current;
      if (!cv || !engine) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(6,10,22,0.82)';
      ctx.fillRect(0, 0, W, H);
      const toX = (x: number) => ((x + 58) / 116) * W;
      const toY = (z: number) => ((z + 58) / 116) * H;
      // 3レーン道路
      ctx.strokeStyle = 'rgba(150,180,255,0.4)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      for (const lane of [LANE_SAMPLES.top, LANE_SAMPLES.mid, LANE_SAMPLES.bot]) {
        ctx.beginPath();
        lane.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.z));
          else ctx.lineTo(toX(p.x), toY(p.z));
        });
        ctx.stroke();
      }
      // 川
      ctx.strokeStyle = 'rgba(90,200,235,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      RIVER_SAMPLES.forEach((p, i) => {
        if (i === 0) ctx.moveTo(toX(p.x), toY(p.z));
        else ctx.lineTo(toX(p.x), toY(p.z));
      });
      ctx.stroke();
      // 草むら
      ctx.fillStyle = 'rgba(60,174,92,0.5)';
      for (const b of engine.getBushes()) {
        ctx.fillRect(toX(b.x - b.rx), toY(b.z - b.rz), (b.rx * 2 / 116) * W, (b.rz * 2 / 116) * H);
      }
      // ドット
      for (const d of engine.getMinimapDots()) {
        if (!d.visible) continue;
        const x = toX(d.x), y = toY(d.z);
        if (d.kind === 'nexus') {
          ctx.fillStyle = d.team === 'blue' ? '#3a8aff' : '#ff4a5c';
          ctx.fillRect(x - 4, y - 4, 8, 8);
        } else if (d.kind === 'tower') {
          ctx.fillStyle = d.team === 'blue' ? '#3a8aff' : '#ff4a5c';
          ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        } else if (d.kind === 'champ') {
          ctx.beginPath();
          ctx.arc(x, y, d.isPlayer ? 4.5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = d.isPlayer ? '#ffffff' : d.team === 'blue' ? '#6ab8ff' : '#ff8a9a';
          ctx.fill();
          if (d.isPlayer) { ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 2; ctx.stroke(); }
        } else if (d.kind === 'minion') {
          ctx.fillStyle = d.team === 'blue' ? 'rgba(100,170,255,0.6)' : 'rgba(255,120,140,0.6)';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        } else {
          ctx.fillStyle = '#b08aff';
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }, 200);
    return () => clearInterval(iv);
  }, []);

  // ダメージ数字のフラッシュ (140msごとにまとめて反映 — 激戦時の再レンダーストーム防止)
  useEffect(() => {
    const iv = setInterval(() => {
      const buf = dmgBufRef.current;
      const exp = dmgExpRef.current;
      if (!buf.length && !exp.length) return;
      const now = performance.now();
      const expired = exp.filter((x) => x.at <= now).map((x) => x.id);
      if (expired.length) dmgExpRef.current = exp.filter((x) => x.at > now);
      const add = buf.splice(0, buf.length);
      if (!add.length && !expired.length) return;
      setDmgs((ds) => {
        let next = ds;
        if (expired.length) next = next.filter((x) => !expired.includes(x.id));
        if (add.length) next = [...next, ...add].slice(-26);
        return next;
      });
    }, 140);
    return () => clearInterval(iv);
  }, []);

  const openMenu = useCallback(() => {
    menuOpenRef.current = true;
    setMenuOpen(true);
    setPingWheel(false);
    engineRef.current?.pause(true);
  }, []);
  const closeMenu = useCallback(() => {
    menuOpenRef.current = false;
    setMenuOpen(false);
    setShopOpen(false);
    setPingWheel(false);
    engineRef.current?.pause(false);
  }, []);
  const closeShop = useCallback(() => setShopOpen(false), []);
  const sendPing = useCallback((text: string) => {
    engineRef.current?.sendPing(text);
    setPingWheel(false);
  }, []);

  // ===== 開戦カウントダウン (残り8秒から大きな数字 + 効果音) =====
  const [countNum, setCountNum] = useState<number | null>(null);
  const lastCountRef = useRef<number | null>(null);
  useEffect(() => {
    const si = hud?.startIn ?? 0;
    if (si >= 1 && si <= 8) {
      if (lastCountRef.current !== si) {
        lastCountRef.current = si;
        setCountNum(si);
        audio.sfx(si === 1 ? 'count-final' : 'count');
      }
      // カメラ演出の最後 (残り1秒) でHUDフェードイン開始
      if (si === 1) setHudReady(true);
    } else if (si === 0 && lastCountRef.current !== null) {
      lastCountRef.current = null;
      setCountNum(null);
      setHudReady(true);
    }
  }, [hud?.startIn]);

  if (!hud) {
    // canvas は常に描画(エンジン初期化に必要)。ローディングはオーバーレイ表示
    return (
      <div className={`game-root ${save.settings.mobile.preventCopy ? 'no-touch-copy' : ''} ${mobile ? 'touch-skill' : ''}`}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="font-display animate-pulse text-xl tracking-widest text-sky-300">LOADING BATTLE…</div>
            <div className="mx-auto mt-3 h-2.5 w-56 overflow-hidden" style={{ transform: 'skewX(-18deg)' }}>
              <div className="para-frame h-full w-full bg-slate-900">
                <div className="para-stripes h-full w-full opacity-60" />
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">{char.name} - 出撃準備中</div>
          </div>
        </div>
      </div>
    );
  }

  const skillSlot = (i: number) => {
    const s = hud.skills[i];
    const def = char.skills[i];
    if (!s || !def) return null;
    const cdPct = s.cdMax > 0 ? Math.min(1, s.cd / s.cdMax) : 0;
    const stacks = hud.stacks[i] ?? 0;
    return (
      <button
        key={s.slot}
        onClick={() => engineRef.current?.pressSkillTouch(i)}
        className={`skill-slot ${s.ready ? (def.ult ? 'ult-ready' : 'ready') : ''} flex h-14 w-14 items-center justify-center rounded-lg`}
        aria-label={s.name}
      >
        {/* スキルの絵 (Q/E/R 文字ではなくアイコン) */}
        <span className="relative z-[3] flex items-center justify-center">
          <SkillIcon glyph={def.glyph} color={def.color} size={30} dim={!s.ready} />
        </span>
        {/* スタック (パルの召喚チャージ等) */}
        {stacks > 0 && (
          <span className="absolute -right-0.5 -top-0.5 z-[6] flex gap-0.5">
            {Array.from({ length: stacks }).map((_, k) => (
              <span key={k} className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,240,200,0.9)]" />
            ))}
          </span>
        )}
        {/* 縁クールダウンリング (残り時間が縁を時計回りに満ちる/減る) */}
        {cdPct > 0 && <CooldownRing pct={cdPct} color={def.color} ult={def.ult} />}
        {cdPct > 0 && <span className="absolute z-[5] font-display text-[11px] font-black text-white" style={{ textShadow: '0 1px 3px #000, 0 0 6px rgba(0,0,0,0.8)' }}>{s.cd}</span>}
        {!s.ready && cdPct <= 0 && <span className="cd-veil" />}
        {/* 小さなスロットキーバッジ */}
        <span className="absolute left-1 top-0.5 z-[5] text-[8px] font-bold leading-none text-slate-400/90">{s.slot}</span>
        <span className="absolute bottom-0.5 right-1 z-[5] text-[8px] leading-none text-sky-300/70">{s.manaCost}</span>
      </button>
    );
  };

  // HUDフェードイン (開戦カウントダウン中は非表示・残り1秒でフェードイン)
  const hudOp = hudReady ? 1 : 0;

  return (
    <div className={`game-root ${save.settings.mobile.preventCopy ? 'no-touch-copy' : ''} ${mobile ? 'touch-skill' : ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />
      <canvas ref={attachPlates} className="pointer-events-none absolute inset-0 z-[5] h-full w-full" />
      <div className="vignette pointer-events-none absolute inset-0" />

      {/* ===== 体力10%以下: 危険の赤ビネット ===== */}
      {hud.hp > 0 && hud.hp / hud.maxHp <= 0.1 && (
        <div className="low-hp-vignette pointer-events-none absolute inset-0 z-[8]" />
      )}

      {/* ===== 上部バー (スコア) — スマホはコンパクト / 開戦演出中はフェードイン ===== */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex justify-center p-2 transition-opacity duration-1000" style={{ opacity: hudOp }}>
        <div className="hud-panel flex items-center gap-2.5 rounded-lg px-3 py-1.5 sm:gap-4 sm:rounded-xl sm:px-5 sm:py-2">
          <NexusBar team="blue" hp={hud.nexusHp.blue} max={hud.nexusHp.blueMax} align="right" />
          <div className="text-center">
            <div className="font-display text-lg font-black leading-none sm:text-2xl">
              <span className="text-sky-400">{hud.teamScore.blue}</span>
              <span className="mx-1.5 text-slate-500 sm:mx-2">:</span>
              <span className="text-rose-400">{hud.teamScore.red}</span>
            </div>
            <div className="mt-0.5 text-[9px] text-slate-400 sm:text-[10px]">{fmtTime(hud.time)}</div>
          </div>
          <NexusBar team="red" hp={hud.nexusHp.red} max={hud.nexusHp.redMax} align="left" />
        </div>
      </div>

      {/* FPS (スマホ: 左下 / PC: 左上) */}
      {save.settings.showFps && (
        <div className={`pointer-events-none absolute rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 ${mobile ? 'bottom-2 left-2' : 'left-2 top-2'}`}>{hud.fps} FPS</div>
      )}

      {/* 開戦カウントダウン (集合フェーズ: 全員ファウンテンからスタート) — スマホは名前パネルの下 */}
      {hud.startIn > 0 && !hud.hidden && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center ${mobile ? 'top-[7.75rem]' : 'top-16'}`}>
          <div className={`hud-panel flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 ${mobile ? 'px-3 py-1' : 'px-4 py-1.5'}`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-300" />
            </span>
            <span className={`font-display font-black tracking-wider text-sky-200 ${mobile ? 'text-xs' : 'text-sm'}`}>
              開戦まで {hud.startIn}秒
            </span>
            {!mobile && <span className="text-[11px] text-slate-300">全員ファウンテン集合</span>}
          </div>
        </div>
      )}

      {/* ファウンテン回復中表示 */}
      {hud.inFountain && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 animate-pulse rounded-full border border-emerald-400/40 bg-emerald-500/15 font-bold text-emerald-300 ${mobile ? 'top-[10.5rem] px-3 py-1 text-[10px]' : 'top-[104px] px-3 py-1 text-[11px]'}`}>
          {mobile ? '✚ 基地回復中 +100/秒' : '✚ 基地回復中 HP/MP +100/秒'}
        </div>
      )}

      {/* 草むら表示 */}
      {hud.hidden && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/15 font-bold text-emerald-300 ${mobile ? 'top-[7.75rem] px-3 py-1 text-[10px]' : 'top-16 px-3 py-1 text-[11px]'}`}>
          <span className="inline-flex items-center gap-1"><BushGlyph /> 隠密中{mobile ? ' (回復2倍)' : ' - 草むらの外からは見えていない'}</span>
        </div>
      )}

      {/* 危険警告 (電車/大波接近) */}
      {hud.warn && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 animate-pulse rounded-full border border-rose-400/60 bg-rose-500/25 font-black text-rose-200 shadow-[0_0_18px_rgba(255,80,100,0.45)] ${mobile ? 'top-[9.5rem] px-3 py-1 text-[10px]' : 'top-28 px-4 py-1.5 text-[12px]'}`}>
          <span className="inline-flex items-center gap-1"><WarnGlyph /> {hud.warn}</span>
        </div>
      )}

      {/* 気絶中表示 (電車/ベッド接触等) */}
      {hud.stunned > 0 && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-violet-400/60 bg-violet-500/25 font-black text-violet-200 ${mobile ? 'top-[11rem] px-3 py-1 text-[10px]' : 'top-36 px-4 py-1.5 text-[12px]'}`}>
          <span className="mr-1 inline-block animate-spin align-[-2px]" style={{ animationDuration: '1.2s' }}><StarGlyph /></span> 気絶中… {hud.stunned.toFixed(1)}秒
        </div>
      )}

      {/* フリル技でひよっている表示 */}
      {hud.cowered > 0 && (
        <div className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-amber-300/60 bg-amber-500/25 font-black text-amber-100 ${mobile ? 'top-[12.5rem] px-3 py-1 text-[10px]' : 'top-40 px-4 py-1.5 text-[12px]'}`}>
          <span className="mr-1 inline-flex items-center align-[-3px] animate-pulse"><ChickGlyph size={13} /></span> ひよってる… {hud.cowered.toFixed(1)}秒
        </div>
      )}

      {/* キルフィード (スマホ: 左側ミニマップの下 / PC: 右上) */}
      <div className={`pointer-events-none absolute z-10 flex flex-col gap-1 transition-opacity duration-1000 ${mobile ? 'left-2 top-[6.5rem] items-start' : 'right-3 top-14 items-end'}`} style={{ opacity: hudOp }}>
        {feed.map((f) => (
          <div key={f.id} className="kill-feed-in hud-panel flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold sm:gap-2 sm:px-2.5 sm:py-1 sm:text-[11px]">
            <span className={f.killerTeam === 'blue' ? 'text-sky-300' : 'text-rose-300'}>{f.killer}</span>
            <span className="text-slate-500"><SwordsGlyph size={11} /></span>
            <span className={f.victimTeam === 'blue' ? 'text-sky-300' : 'text-rose-300'}>{f.victim}</span>
            {f.firstBlood && <span className="rounded bg-rose-500/80 px-1 text-[9px] text-white">FB</span>}
          </div>
        ))}
      </div>

      {/* ===== 指令表示 (右側に3秒だけ小さな字で) ===== */}
      <div className="pointer-events-none absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end gap-1">
        {pings.map((p) => (
          <div key={p.id} className="ping-slide rounded-md border border-sky-400/25 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-sky-100 backdrop-blur-sm">
            <span className="text-sky-400">{p.mine ? 'あなた' : '味方'}:</span> {p.text}
          </div>
        ))}
      </div>

      {/* アナウンス (レジェンダリー等はフェードアウトでかっこよく消える) */}
      {ann && (
        <div key={ann.id} className="pointer-events-none absolute left-0 right-0 top-[22%] z-10 text-center">
          <div className={`announce-cool font-display font-black tracking-widest ${mobile ? 'text-2xl' : 'text-4xl'}`} style={{ color: ann.color ?? '#fff', textShadow: `0 0 24px ${ann.color ?? '#fff'}88` }}>
            {ann.text}
          </div>
          {ann.sub && <div className="announce-cool mt-1 text-sm text-slate-300">{ann.sub}</div>}
        </div>
      )}

      {/* ダメージ数字 (スマホは小さめ) */}
      {dmgs.map((d) => (
        <div
          key={d.id}
          className={`dmg-float pointer-events-none absolute z-10 font-display font-black ${d.heal ? 'text-emerald-300' : 'text-amber-200'}`}
          style={{ left: d.x, top: d.y, fontSize: (d.heal ? 15 : d.amount > 120 ? 22 : 16) * (mobile ? 0.78 : 1), textShadow: '0 0 8px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)' }}
        >
          {d.heal ? '+' : ''}{d.amount}
        </div>
      ))}

      {/* ===== ミニマップ (スマホ: 左上・小さめ / PC: 右上) ===== */}
      <div className={`absolute z-10 transition-opacity duration-1000 ${mobile ? 'left-2 top-2' : 'right-2 top-2'}`} style={{ opacity: hudOp }}>
        <canvas ref={miniRef} width={150} height={150} className={`hud-panel rounded-lg ${mobile ? 'h-[72px] w-[72px]' : 'h-[150px] w-[150px]'}`} />
      </div>

      {/* ===== Tab 状態パネル ===== */}
      {showStatus && (
        <div className="absolute left-1/2 top-1/2 z-30 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2">
          <StatusPanel hud={hud} charId={charId} onClose={() => setShowStatus(false)} />
        </div>
      )}

      {/* ===== 開戦カウントダウン 3・2・1 ===== */}
      {countNum !== null && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div key={countNum} className={`count-pop font-display font-black leading-none text-white drop-shadow-[0_0_34px_rgba(80,200,255,0.95)] ${mobile ? 'text-[92px]' : 'text-[130px] sm:text-[170px]'}`}>
            {countNum}
          </div>
        </div>
      )}

      {/* ===== リスポーン表示 (死亡中は観戦モード) ===== */}      {hud.respawnIn > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35">
          <div className="text-center">
            {hud.spectateName && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
                <span className="font-display text-xs tracking-widest text-slate-300">SPECTATING</span>
                <span className="text-xs font-bold text-white">{hud.spectateName}</span>
              </div>
            )}
            <div className="font-display text-sm tracking-widest text-slate-400">RESPAWN IN</div>
            <div className={`font-display font-black text-white text-glow-blue ${mobile ? 'text-5xl' : 'text-7xl'}`}>{hud.respawnIn}</div>
            <div className="mt-1 text-[11px] text-slate-400">味方の戦況を観戦中…</div>
          </div>
        </div>
      )}

      {/* ===== ステータスパネル (スマホ: 右上にコンパクト / PC: 下部HUD内) ===== */}
      {mobile && (
        <div className="hud-panel pointer-events-auto absolute right-2 top-11 z-10 w-36 rounded-xl p-1.5 transition-opacity duration-1000" style={{ opacity: hudOp }}>
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 font-display text-[9px] font-black text-white">
              Lv{hud.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold leading-tight text-white">{char.name}</div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-amber-400" style={{ width: `${(hud.xp / hud.xpNeed) * 100}%` }} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-amber-200"><CoinIcon className="h-3 w-3" />{hud.gold}</div>
          </div>
          {/* ステラ: 負荷メータ (体力バーの上) */}
          {charId === 'stella' && hud.anger > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[8px] font-bold">
                <span className={hud.anger >= 85 ? 'animate-pulse text-white' : 'text-amber-200'}>{hud.anger >= 85 ? '負荷MAX！！ 剣舞可' : '負荷'}</span>
                <span className="text-amber-200/70">{hud.anger}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${hud.anger >= 85 ? 'animate-pulse bg-gradient-to-r from-amber-200 to-yellow-100' : 'bg-gradient-to-r from-yellow-500 to-amber-300'}`}
                  style={{ width: `${hud.anger}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-1.5">
            <div className="hp-bar-shell h-3 rounded-md">
              <div className="hp-bar-fill relative h-full rounded-md bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}>
                {hud.shield > 0 && (
                  <div className="absolute right-0 top-0 h-full rounded-md bg-slate-200/80" style={{ width: `${Math.min(100, (hud.shield / hud.maxHp) * 100)}%` }} />
                )}
              </div>
              <div className="relative -mt-3 text-center font-mono text-[8px] font-bold text-white" style={{ textShadow: '0 1px 2px #000' }}>
                {hud.hp} / {hud.maxHp}
              </div>
            </div>
            <div className="hp-bar-shell mt-1 h-1.5 rounded-md">
              <div className="hp-bar-fill h-full rounded-md bg-gradient-to-r from-sky-500 to-blue-400" style={{ width: `${(hud.mana / hud.maxMana) * 100}%` }} />
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[8px] text-slate-400">
            <span>K{hud.kda.k} D{hud.kda.d} A{hud.kda.a}</span>
            <span>CS {hud.cs}</span>
          </div>
        </div>
      )}

      {/* ===== 下部HUD (PC のみ。スマホは下中央スキル行 + 右上パネル + 右側スティック) ===== */}
      {!mobile && (
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between p-3 transition-opacity duration-1000" style={{ opacity: hudOp }}>
        {/* 左: ステータス */}
        <div className="hud-panel pointer-events-auto w-64 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 font-display text-xs font-black text-white">
              Lv{hud.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold text-white">{char.name}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-amber-400" style={{ width: `${(hud.xp / hud.xpNeed) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs font-bold text-amber-200"><CoinIcon className="h-3.5 w-3.5" />{hud.gold}</div>
              <div className="text-[9px] text-slate-400">CS {hud.cs}</div>
            </div>
          </div>
          {/* ステラ: 負荷メータ (体力バーの上) */}
          {charId === 'stella' && hud.anger > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className={hud.anger >= 85 ? 'animate-pulse text-white' : 'text-amber-200'}>{hud.anger >= 85 ? '負荷MAX！！ 剣舞可 (攻撃で発動)' : '負荷メータ'}</span>
                <span className="text-amber-200/70">{hud.anger}%</span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${hud.anger >= 85 ? 'animate-pulse bg-gradient-to-r from-amber-200 to-yellow-100' : 'bg-gradient-to-r from-yellow-500 to-amber-300'}`}
                  style={{ width: `${hud.anger}%` }}
                />
              </div>
            </div>
          )}
          {/* HP / マナ */}
          <div className={charId === 'stella' && hud.anger > 0 ? 'mt-1' : 'mt-2'}>
            <div className="hp-bar-shell h-4 rounded-md">
              <div className="hp-bar-fill relative h-full rounded-md bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}>
                {hud.shield > 0 && (
                  <div className="absolute right-0 top-0 h-full rounded-md bg-slate-200/80" style={{ width: `${Math.min(100, (hud.shield / hud.maxHp) * 100)}%` }} />
                )}
              </div>
              <div className="relative -mt-4 text-center font-mono text-[10px] font-bold text-white" style={{ textShadow: '0 1px 2px #000' }}>
                {hud.hp} / {hud.maxHp}{hud.shield > 0 ? ` (+${hud.shield})` : ''}
              </div>
            </div>
            <div className="hp-bar-shell mt-1 h-2.5 rounded-md">
              <div className="hp-bar-fill h-full rounded-md bg-gradient-to-r from-sky-500 to-blue-400" style={{ width: `${(hud.mana / hud.maxMana) * 100}%` }} />
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 text-[9px] text-slate-400">
            <span className="inline-flex items-center gap-0.5"><SwordsGlyph size={10} className="text-rose-300/90" />{hud.atk}</span>
            <span className="inline-flex items-center gap-0.5"><ShieldGlyph size={10} className="text-sky-300/90" />{hud.armor}</span>
            <span className="inline-flex items-center gap-0.5"><BootsGlyph size={10} className="text-emerald-300/90" />{hud.speed}</span>
            <span className="inline-flex items-center gap-0.5"><HeartGlyph size={10} className="text-green-300/90" />{hud.hpRegen}/s</span>
            <span>K {hud.kda.k}/D {hud.kda.d}/A {hud.kda.a}</span>
          </div>
          {/* フリル: 怒りゲージ */}
          {charId === 'frill' && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className={hud.anger >= 85 ? 'animate-pulse text-rose-300' : 'text-orange-300'}>{hud.anger >= 85 ? '怒りMAX！！' : '怒りゲージ'}</span>
                <span className="text-orange-300/70">{hud.anger}%</span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${hud.anger >= 85 ? 'animate-pulse bg-gradient-to-r from-orange-500 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                  style={{ width: `${hud.anger}%` }}
                />
              </div>
            </div>
          )}
          {hud.buffs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hud.buffs.map((b, i) => (
                <span key={i} className="rounded bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">{b.name} {b.t}s</span>
              ))}
            </div>
          )}
        </div>

        {/* 中央: スキルバー */}
        <div className="pointer-events-auto flex items-end gap-2">
          <div className="hud-panel flex flex-col items-center rounded-lg px-2 py-1.5">
            {/* 指令ホイール (T) */}
            <button
              onClick={() => setPingWheel((v) => !v)}
              className="skill-slot mb-1.5 flex h-12 w-12 items-center justify-center rounded-lg"
              aria-label="指令ホイール"
              title="指令ホイール (T)"
            >
              <span className="relative flex items-center justify-center text-sky-300">
                <PingIcon k="help" size={22} />
              </span>
              <span className="absolute left-1 top-0.5 z-[5] text-[8px] font-bold leading-none text-slate-400/90">T</span>
            </button>
            <span className="mt-0.5 text-[8px] tracking-wider text-slate-500">PING</span>
          </div>
          <div className="hud-panel flex flex-col items-center rounded-lg px-2 py-1.5">
            <button
              onMouseDown={() => engineRef.current?.setTouchInput({ guard: true })}
              onMouseUp={() => engineRef.current?.setTouchInput({ guard: false })}
              onTouchStart={(e) => { e.preventDefault(); engineRef.current?.setTouchInput({ guard: true }); }}
              onTouchEnd={() => engineRef.current?.setTouchInput({ guard: false })}
              className="skill-slot flex h-12 w-12 items-center justify-center rounded-lg"
            >
              <span className="font-display text-sm font-black text-slate-200">F</span>
            </button>
            <span className="mt-0.5 text-[8px] tracking-wider text-slate-500">GUARD</span>
          </div>
          {skillSlot(0)}{skillSlot(1)}{skillSlot(2)}
          <div className="hud-panel flex flex-col items-center rounded-lg px-2 py-1.5">
            <button
              onMouseDown={() => engineRef.current?.setTouchInput({ attack: true })}
              onMouseUp={() => engineRef.current?.setTouchInput({ attack: false })}
              onTouchStart={(e) => { e.preventDefault(); engineRef.current?.setTouchInput({ attack: true }); }}
              onTouchEnd={() => engineRef.current?.setTouchInput({ attack: false })}
              className="skill-slot ready flex h-14 w-14 items-center justify-center rounded-full"
            >
              <span className="inline-flex items-center justify-center text-white"><SwordsGlyph size={22} /></span>
              {autoAttack && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-1 text-[7px] font-black tracking-wider text-white shadow-[0_0_6px_rgba(52,211,153,0.9)]">AUTO</span>}
            </button>
            <span className="mt-0.5 text-[8px] tracking-wider text-slate-500">ATTACK</span>
          </div>
        </div>

        {/* 右: KDA & メニュー */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="hud-panel flex items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] font-bold">
            <span className="text-sky-300">{hud.kda.k}</span><span className="text-slate-500">/</span>
            <span className="text-rose-300">{hud.kda.d}</span><span className="text-slate-500">/</span>
            <span className="text-slate-300">{hud.kda.a}</span>
          </div>
          <button onClick={openMenu} className="hud-panel rounded-lg px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:text-white">
            ☰ メニュー (C)
          </button>
        </div>
      </div>
      )}

      {/* ===== タッチ操作 ===== */}
      {mobile && (
        <TouchControls
          engineRef={engineRef}
          settings={save.settings.mobile}
          skills={char.skills.map((s) => ({ glyph: s.glyph as SkillGlyph, color: s.color, ult: !!s.ult, name: s.name }))}
          hudSkills={hud.skills}
          stacks={hud.stacks}
          zoom={hud.zoom}
          initialAuto={autoAttack}
          onMenu={openMenu}
          onStatus={() => setShowStatus(true)}
          onShop={() => { if (!endedRef.current) setShopOpen((v) => !v); }}
          onPing={() => { if (!endedRef.current) setPingWheel((v) => !v); }}
          onZoom={(z) => engineRef.current?.setZoom(z)}
        />
      )}

      {/* ===== 指令ホイール (PC: T / スマホ: ピンボタン) — 6角形ラジアルメニュー ===== */}
      {pingWheel && (
        <div className="absolute inset-0 z-40" onClick={() => setPingWheel(false)}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <PingWheel onSend={sendPing} onClose={() => setPingWheel(false)} />
          </div>
        </div>
      )}

      {/* ===== メニュー (開いている間のみ一時停止) ===== */}
      {menuOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="slide-up-in hud-panel w-96 max-w-[92vw] rounded-2xl p-6">
            <h2 className="font-display text-center text-xl font-black tracking-widest text-white">MENU</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              <DynButton variant="primary" className="py-3" onClick={closeMenu}><PlayIcon size={13} /> 再開する</DynButton>
              <DynButton variant="gold" className="py-3" onClick={() => { closeMenu(); setShopOpen(true); }}><ShopGlyph size={14} /> ショップ ({hud.gold}¢)</DynButton>
              <DynButton variant="ghost" className="py-3" onClick={onExit}><GearGlyph size={14} /> 操作設定を見る</DynButton>
              {mode === 'bot' && <DynButton variant="danger" className="py-3" onClick={() => { engineRef.current?.surrender(); closeMenu(); }}><FlagGlyph size={14} /> 降参する</DynButton>}
              <DynButton variant="danger" className="py-3" onClick={onExit}><HomeGlyph size={14} /> メニューに戻る</DynButton>
            </div>
            <div className="mt-3 text-center text-[10px] text-slate-500">G キーでもショップを開閉できます (戦闘は継続)</div>
          </div>
        </div>
      )}

      {/* ===== ショップ (G キー / メニューから — ゲームは継続中・一時停止しない) ===== */}
      {shopOpen && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="hud-panel pointer-events-auto absolute right-2 top-1/2 flex w-64 max-h-[52vh] -translate-y-1/2 flex-col rounded-2xl p-3 sm:right-3 sm:w-80 sm:max-h-[70vh]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-black tracking-wider text-white"><ShopGlyph size={15} /> ショップ</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-bold text-amber-200"><CoinIcon />{hud.gold}</span>
                <button
                  onClick={closeShop}
                  className="touch-hit rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/15"
                >
                  ✕ 閉じる
                </button>
              </div>
            </div>
            <div className="mt-0.5 text-[9px] text-slate-500">G で開閉・戦闘は継続中。移動しながら購入できます</div>
            <div className="game-scrollable game-scroll mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {SHOP_ITEMS.map((item) => {
                const owned = hud.items.filter((x) => x === item.id).length;
                const afford = hud.gold >= item.cost;
                return (
                  <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-sky-400/15 bg-white/[0.03] p-2 sm:gap-3 sm:p-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-sky-400/20 bg-[#0b1230] text-sky-300"><ShopGlyph id={item.icon} size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">{item.name} {owned > 0 && <span className="text-[9px] text-sky-300">x{owned}</span>}</div>
                      <div className="text-[10px] text-slate-400">{item.desc}</div>
                    </div>
                    <DynButton
                      variant={afford ? 'gold' : 'ghost'}
                      disabled={!afford}
                      hit
                      className="min-h-[52px] min-w-[88px] shrink-0 px-4 py-2 text-sm"
                      onClick={(ev) => {
                        engineRef.current?.buyItem(item);
                        audio.sfx('buy');
                        ev.currentTarget.blur();
                        setHud((h) => (h ? { ...h, gold: h.gold - item.cost, items: [...h.items, item.id] } : h));
                      }}
                    >
                      {item.cost}¢
                    </DynButton>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// サブコンポーネント
// ------------------------------------------------------------

function NexusBar({ team, hp, max, align }: { team: Team; hp: number; max: number; align: 'left' | 'right' }) {
  const pct = Math.max(0, (hp / max) * 100);
  return (
    <div className={`w-16 sm:w-36 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={`text-[8px] font-bold sm:text-[9px] ${team === 'blue' ? 'text-sky-400' : 'text-rose-400'}`}>{team === 'blue' ? 'BLUE' : 'RED'} NEXUS</div>
      <div className="hp-bar-shell mt-0.5 h-1.5 rounded-full sm:h-2.5">
        <div
          className={`hp-bar-fill h-full rounded-full ${team === 'blue' ? 'bg-gradient-to-r from-sky-500 to-cyan-400' : 'bg-gradient-to-r from-rose-500 to-red-400'}`}
          style={{ width: `${pct}%`, marginLeft: align === 'right' ? 'auto' : undefined }}
        />
      </div>
    </div>
  );
}

function StatusPanel({ hud, charId, onClose }: { hud: HudSnapshot; charId: string; onClose?: () => void }) {
  const char = getChar(charId);
  return (
    <div className="hud-panel relative rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-black tracking-widest text-white">STATUS - {char.name}</h3>
        {onClose ? (
          <button
            onClick={onClose}
            className="touch-hit rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition hover:bg-white/15"
            style={{ touchAction: 'manipulation' }}
          >
            ✕ 閉じる
          </button>
        ) : (
          <span className="text-[10px] text-slate-500">Tabを離すと閉じる</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="レベル" value={hud.level} color="text-amber-300" />
        <Stat label="攻撃力" value={hud.atk} color="text-rose-300" />
        <Stat label="防御力" value={hud.armor} color="text-sky-300" />
        <Stat label="移動速度" value={hud.speed} color="text-emerald-300" />
        <Stat label="攻撃速度" value={`${hud.atkSpeed}/s`} color="text-yellow-300" />
        <Stat label="HP回復" value={`${hud.hpRegen}/s`} color="text-green-300" />
        <Stat label="キル" value={hud.kda.k} color="text-sky-300" />
        <Stat label="デス" value={hud.kda.d} color="text-rose-300" />
        <Stat label="CS" value={hud.cs} color="text-slate-200" />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[10px] tracking-widest text-slate-400">所持アイテム</div>
        <div className="flex flex-wrap gap-1.5">
          {hud.items.length === 0 && <span className="text-[11px] text-slate-500">なし (G でショップを開いて購入)</span>}
          {hud.items.map((id, i) => {
            const item = SHOP_ITEMS.find((s) => s.id === id);
            return <span key={i} className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[10px] text-slate-200"><ShopGlyph id={item?.icon ?? ''} size={12} /> {item?.name}</span>;
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {(['blue', 'red'] as Team[]).map((team) => (
          <div key={team}>
            <div className={`mb-1 text-[10px] font-bold ${team === 'blue' ? 'text-sky-400' : 'text-rose-400'}`}>{team.toUpperCase()} チーム</div>
            {hud.teams[team].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                <span className={`h-1.5 w-1.5 rounded-full ${team === 'blue' ? 'bg-sky-400' : 'bg-rose-400'}`} />
                <span className={t.isPlayer ? 'font-bold text-white' : 'text-slate-300'}>{t.name}</span>
                <span className="ml-auto text-slate-400">Lv{t.level} {t.k}/{t.d}/{t.a}</span>
              </div>
            ))}
            <div className="mt-1.5 space-y-1">
              {hud.structures[team].map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className="w-12 text-[9px] text-slate-500">{s.type === 'nexus' ? 'ネクサス' : 'タワー'}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full ${team === 'blue' ? 'bg-sky-400' : 'bg-rose-400'}`} style={{ width: `${s.hpPct * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] py-2">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className={`font-display text-sm font-black ${color}`}>{value}</div>
    </div>
  );
}

// ------------------------------------------------------------
// 縁クールダウンリング (SVG: 残り時間が縁を満ちる/減る)
// ------------------------------------------------------------

export function CooldownRing({ pct, color, ult, thick = 2.6 }: { pct: number; color: string; ult?: boolean; thick?: number }) {
  const R = 16;
  const C = 2 * Math.PI * R;
  const ringColor = ult ? '#ffc65c' : color;
  return (
    <svg
      viewBox="0 0 36 36"
      className="pointer-events-none absolute z-[4]"
      style={{ inset: -2, width: 'calc(100% + 4px)', height: 'calc(100% + 4px)', color: ringColor }}
      aria-hidden
    >
      <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(8,13,28,0.75)" strokeWidth={thick + 1.4} />
      <circle
        cx="18" cy="18" r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={thick}
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.5, C * pct)} ${C}`}
        transform="rotate(-90 18 18)"
        style={{ filter: 'drop-shadow(0 0 3px currentColor)', transition: 'stroke-dasharray 0.12s linear' }}
      />
    </svg>
  );
}

// ------------------------------------------------------------
// タッチ操作 (スマホモード) — 左側スティック + 右下スキルクラスター
// - 移動: 画面左側のどこでもタッチした場所にスティックが出現 (左下主体)
// - スキル: 右下クラスター (F ガード | Q | E | R | ⚔攻撃 + 補助AUTO/TAB/☰)
// - スマホでは全体をひと回り小さく表示 (設定スライダーも有効)
// ------------------------------------------------------------

interface TouchSkillDef { glyph: SkillGlyph; color: string; ult: boolean; name: string }

function TouchControls({
  engineRef, settings, skills, hudSkills, stacks, zoom, initialAuto, onMenu, onStatus, onShop, onPing, onZoom,
}: {
  engineRef: React.MutableRefObject<Battle | null>;
  settings: SaveData['settings']['mobile'];
  skills: TouchSkillDef[];
  hudSkills: HudSkill[];
  stacks: number[];
  zoom: number;
  initialAuto: boolean;
  onMenu: () => void;
  onStatus: () => void;
  onShop: () => void;
  onPing: () => void;
  onZoom: (z: number) => void;
}) {
  // スマホ本体ではボタン類をひと回り小さく (0.82倍・設定値が大きすぎても上限で丸める)
  const size = Math.min(settings.buttonSize, 1.05) * 0.82;
  const rs = Math.min(size, 1.0); // スキル行のスケール (小画面のはみ出し防止)
  const op = settings.opacity;
  const SAFE_B = 'env(safe-area-inset-bottom, 0px)';
  const SAFE_R = 'env(safe-area-inset-right, 0px)';
  // フローティングスティック
  const [stick, setStick] = useState<{ x: number; y: number } | null>(null);
  const stickIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  // 一人称の視点ドラッグ (スマホ: 画面をなぞって見回す)
  const lookIdRef = useRef<number | null>(null);
  const lookPrevRef = useRef({ x: 0, y: 0 });
  const [autoAtk, setAutoAtk] = useState(initialAuto);
  // TAB長押し検出 (スマホ: 長押しでステータスを出す)
  const tabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabFiredRef = useRef(false);
  const tabPressStart = () => {
    tabFiredRef.current = false;
    tabTimerRef.current = setTimeout(() => {
      tabFiredRef.current = true;
      buzz(22);
      onStatus();
    }, 380);
  };
  const tabPressEnd = () => {
    if (tabTimerRef.current) { clearTimeout(tabTimerRef.current); tabTimerRef.current = null; }
  };

  const buzz = (ms = 12) => { if (settings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); };
  const RADIUS = 52 * size;

  const moveStick = (cx: number, cy: number) => {
    let dx = (cx - originRef.current.x) / RADIUS;
    let dy = (cy - originRef.current.y) / RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    engineRef.current?.setTouchInput({ mx: dx, mz: dy });
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * RADIUS * 0.55}px, ${dy * RADIUS * 0.55}px)`;
  };

  const stickEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (stickIdRef.current === t.identifier) {
        stickIdRef.current = null;
        setStick(null);
        engineRef.current?.setTouchInput({ mx: 0, mz: 0 });
        if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
      }
    }
  };

  const btn = 'touch-hit relative flex select-none items-center justify-center border-2 font-display font-black text-white active:scale-95';
  const btnBase: React.CSSProperties = {
    background: 'linear-gradient(160deg, rgba(22,34,74,0.88), rgba(12,19,48,0.88))',
    boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
    touchAction: 'none',
  };

  /** スキルボタン (絵 + 縁CDリング + 残り秒) */
  const SkillBtn = ({ i, px, ult }: { i: number; px: number; ult?: boolean }) => {
    const def = skills[i];
    const s = hudSkills[i];
    const ready = s?.ready ?? false;
    const cdPct = s && s.cdMax > 0 ? Math.min(1, s.cd / s.cdMax) : 0;
    return (
      <button
        type="button"
        aria-label={def?.name}
        className={`${btn} rounded-xl ${ready ? '' : 'brightness-[0.72]'}`}
        style={{
          ...btnBase,
          width: px * rs,
          height: px * rs,
          opacity: Math.min(1, op + 0.18),
          borderColor: ult ? 'rgba(255,198,92,0.75)' : ready ? 'rgba(140,220,255,0.65)' : 'rgba(120,160,255,0.3)',
          boxShadow: ready ? `0 0 14px ${ult ? 'rgba(255,190,80,0.45)' : 'rgba(79,209,255,0.35)'}, 0 2px 10px rgba(0,0,0,0.45)` : btnBase.boxShadow,
        }}
        onTouchStart={(e) => { e.preventDefault(); buzz(); engineRef.current?.pressSkillTouch(i); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {def && <SkillIcon glyph={def.glyph} color={def.color} size={px * 0.52 * rs} dim={!ready} />}
        {cdPct > 0 && def && <CooldownRing pct={cdPct} color={def.color} ult={def.ult} thick={3} />}
        {cdPct > 0 && s && (
          <span className="absolute z-[5] font-display font-black text-white" style={{ fontSize: 12 * rs, textShadow: '0 1px 3px #000' }}>
            {s.cd}
          </span>
        )}
        {/* スタック (パルの召喚チャージ等) */}
        {s && (stacks[i] ?? 0) > 0 && (
          <span className="absolute -right-0.5 -top-0.5 z-[6] flex gap-0.5">
            {Array.from({ length: stacks[i] }).map((_, k) => (
              <span key={k} className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_4px_rgba(110,240,200,0.9)]" />
            ))}
          </span>
        )}
        {/* スロットキー / MP コストバッジ (PC のスキルスロットと同じ表記) */}
        {s && <span className="absolute left-1 top-0.5 z-[5] text-[8px] font-bold leading-none text-slate-400/90">{s.slot}</span>}
        {s && <span className="absolute bottom-0.5 right-1 z-[5] text-[8px] leading-none text-sky-300/70">{s.manaCost}</span>}
      </button>
    );
  };

  return (
    <>
      {/* ===== 一人称視点: 画面をなぞって視点移動 (マインクラフト方式・右側2/3) ===== */}
      {zoom < 0.3 && (
        <div
          className="absolute z-[9]"
          style={{ left: '30%', right: 0, top: 0, bottom: 0, touchAction: 'none' }}
          onTouchStart={(e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            lookIdRef.current = t.identifier;
            lookPrevRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
              if (lookIdRef.current !== t.identifier) continue;
              const dx = t.clientX - lookPrevRef.current.x;
              const dy = t.clientY - lookPrevRef.current.y;
              lookPrevRef.current = { x: t.clientX, y: t.clientY };
              engineRef.current?.lookDelta(dx, dy);
            }
          }}
          onTouchEnd={(e) => {
            for (const t of Array.from(e.changedTouches)) {
              if (lookIdRef.current === t.identifier) lookIdRef.current = null;
            }
          }}
          onTouchCancel={(e) => {
            for (const t of Array.from(e.changedTouches)) {
              if (lookIdRef.current === t.identifier) lookIdRef.current = null;
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 見回し中のヒント */}
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-sky-300/25 bg-black/30 px-2.5 py-1 text-[9px] tracking-wider text-sky-200/80" style={{ opacity: op * 0.9 }}>
            なぞって見回す
          </div>
        </div>
      )}

      {/* ===== フローティング移動ゾーン (左画面のどこでも・左下主体) ===== */}
      <div
        ref={zoneRef}
        className="absolute left-0 z-20"
        style={{ width: '44%', height: '54%', bottom: `calc(12px + ${SAFE_B})`, touchAction: 'none' }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (stickIdRef.current !== null) return;
          const t = e.changedTouches[0];
          stickIdRef.current = t.identifier;
          // ゾーン内にクランプして基準点にする (描画はゾーン相対・入力はクライアント座標)
          const zr = zoneRef.current?.getBoundingClientRect();
          const x = zr ? Math.max(zr.left + 20, Math.min(zr.right - 66, t.clientX)) : t.clientX;
          const y = zr ? Math.max(zr.top + 66, Math.min(zr.bottom - 20, t.clientY)) : t.clientY;
          originRef.current = { x, y };
          setStick({ x: x - (zr?.left ?? 0), y: y - (zr?.top ?? 0) });
          moveStick(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          for (const t of Array.from(e.changedTouches)) {
            if (stickIdRef.current === t.identifier) moveStick(t.clientX, t.clientY);
          }
        }}
        onTouchEnd={stickEnd}
        onTouchCancel={stickEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 待機時のヒントスティック (左下) */}
        {stick === null && (
          <div className="pointer-events-none absolute bottom-6 left-7" style={{ opacity: op * 0.55 }}>
            <div className="flex items-center justify-center rounded-full border-2 border-dashed border-sky-300/40" style={{ width: 104 * size, height: 104 * size }}>
              <div className="h-12 w-12 rounded-full border-2 border-sky-300/50 bg-sky-400/15" />
            </div>
          </div>
        )}
        {/* アクティブスティック */}
        {stick !== null && (
          <div
            className="pointer-events-none absolute"
            style={{ left: stick.x, top: stick.y, transform: 'translate(-50%, -50%)', width: RADIUS * 2, height: RADIUS * 2, opacity: Math.min(1, op + 0.2) }}
          >
            <div className="h-full w-full rounded-full border-2 border-sky-400/45 bg-black/25 backdrop-blur-[2px]" />
            <div
              ref={knobRef}
              className="absolute left-1/2 top-1/2 rounded-full border-2 border-sky-300/70 bg-sky-400/35 shadow-[0_0_18px_rgba(79,209,255,0.5)]"
              style={{ width: 52 * size, height: 52 * size, marginLeft: -26 * size, marginTop: -26 * size, transition: 'transform 0.04s linear' }}
            />
          </div>
        )}
      </div>

      {/* ===== 右下: スキルクラスター (F ガード | Q | E | R | ⚔攻撃) ===== */}
      <div
        className="absolute z-20 flex flex-col items-end"
        style={{ right: `calc(8px + ${SAFE_R})`, bottom: `calc(10px + ${SAFE_B})`, touchAction: 'none' }}
      >
        {/* 補助ボタン行 (スキル行の上) */}
        <div className="mb-1.5 flex items-center gap-2 pr-0.5">
          <button
            type="button"
            className={`${btn} rounded-full ${autoAtk ? 'border-emerald-400/80 text-emerald-200' : 'text-slate-400'}`}
            style={{ ...btnBase, width: 52 * size, height: 30 * size, fontSize: 10 * size, opacity: Math.min(1, op + 0.15), borderColor: autoAtk ? 'rgba(52,211,153,0.8)' : 'rgba(120,160,255,0.35)', background: autoAtk ? 'linear-gradient(160deg, rgba(6,58,42,0.9), rgba(4,34,26,0.9))' : btnBase.background }}
            onTouchStart={(e) => {
              e.preventDefault();
              const next = !autoAtk;
              setAutoAtk(next);
              engineRef.current?.setAutoAttack(next);
              buzz(18);
            }}
            onContextMenu={(e) => e.preventDefault()}
          >AUTO</button>
          <button type="button" className={`${btn} rounded-full`}
            style={{ ...btnBase, width: 46 * size, height: 46 * size, fontSize: 10 * size, opacity: op, borderColor: 'rgba(120,160,255,0.4)' }}
            onTouchStart={(e) => { e.preventDefault(); buzz(); tabPressStart(); }}
            onTouchEnd={(e) => { e.preventDefault(); tabPressEnd(); }}
            onTouchCancel={tabPressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >TAB</button>
          {/* 指令ホイール (6角形ラジアルメニュー) */}
          <button type="button" aria-label="指令" className={`${btn} rounded-full`}
            style={{ ...btnBase, width: 46 * size, height: 46 * size, opacity: op, borderColor: 'rgba(110,230,255,0.55)', color: '#8adcff' }}
            onTouchStart={(e) => { e.preventDefault(); buzz(14); onPing(); }}
            onContextMenu={(e) => e.preventDefault()}
          ><PingIcon k="help" size={20} /></button>
          {/* スマホ専用: ショップ直接ボタン (メニューを経由せず開ける) */}
          <button type="button" aria-label="ショップ" className={`${btn} rounded-full`}
            style={{
              ...btnBase,
              width: 48 * size, height: 48 * size, opacity: Math.min(1, op + 0.1),
              borderColor: 'rgba(253,224,71,0.75)',
              background: 'linear-gradient(160deg, rgba(92,66,10,0.92), rgba(50,35,5,0.92))',
              boxShadow: '0 0 14px rgba(250,204,21,0.35), 0 2px 10px rgba(0,0,0,0.45)',
              color: '#fde68a',
            }}
            onTouchStart={(e) => { e.preventDefault(); buzz(16); onShop(); }}
            onContextMenu={(e) => e.preventDefault()}
          ><ShopGlyph size={22} /></button>
          <button type="button" className={`${btn} rounded-full`}
            style={{ ...btnBase, width: 42 * size, height: 42 * size, fontSize: 12 * size, opacity: op, borderColor: 'rgba(120,160,255,0.4)' }}
            onTouchStart={(e) => { e.preventDefault(); onMenu(); }}
            onContextMenu={(e) => e.preventDefault()}
          >☰</button>
        </div>
        {/* スキル行: F ガード | Q | E | R(金縁ULT) | ⚔攻撃 */}
        <div className="hud-panel flex items-end gap-1.5 rounded-2xl px-2.5 py-2">
          <button type="button" className={`${btn} rounded-lg`} aria-label="ガード"
            style={{ ...btnBase, width: 40 * rs, height: 40 * rs, opacity: op, borderColor: 'rgba(140,220,255,0.7)' }}
            onTouchStart={(e) => { e.preventDefault(); engineRef.current?.setTouchInput({ guard: true }); }}
            onTouchEnd={() => engineRef.current?.setTouchInput({ guard: false })}
            onTouchCancel={() => engineRef.current?.setTouchInput({ guard: false })}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="absolute left-1 top-0.5 z-[5] text-[8px] font-bold leading-none text-slate-400/90">F</span>
            <svg viewBox="0 0 24 24" width={18 * rs} height={18 * rs} style={{ color: '#9adcff' }} aria-hidden>
              <path d="M12 3 L19 5.8 v5.6 q0 5 -7 9.2 q-7 -4.2 -7 -9.2 V5.8 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <SkillBtn i={0} px={48} />
          <SkillBtn i={1} px={48} />
          <SkillBtn i={2} px={58} ult />
          <button type="button" className={`${btn} rounded-full`} aria-label="攻撃"
            style={{
              ...btnBase,
              width: 64 * rs, height: 64 * rs,
              fontSize: 22 * rs,
              opacity: Math.min(1, op + 0.2),
              borderColor: 'rgba(140,220,255,0.75)',
              background: 'linear-gradient(160deg, rgba(14,58,82,0.92), rgba(6,32,51,0.92))',
              boxShadow: '0 0 18px rgba(79,209,255,0.4), 0 2px 12px rgba(0,0,0,0.5)',
            }}
            onTouchStart={(e) => { e.preventDefault(); engineRef.current?.setTouchInput({ attack: true }); }}
            onTouchEnd={() => engineRef.current?.setTouchInput({ attack: false })}
            onTouchCancel={() => engineRef.current?.setTouchInput({ attack: false })}
            onContextMenu={(e) => e.preventDefault()}
          >
            <SwordsGlyph size={26} />
            {autoAtk && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-1 text-[7px] font-black tracking-wider text-white shadow-[0_0_6px_rgba(52,211,153,0.9)]">AUTO</span>}
          </button>
        </div>
      </div>
      {/* ===== 視野スライダー (右上の縦バー) — 下げるとズームイン・0で一人称 ===== */}
      <ZoomBar zoom={zoom} onZoom={onZoom} opacity={op} />
    </>
  );
}

// ------------------------------------------------------------
// 視野バー (スマホ: 右上の縦バー / PC: マウスホイール)
// ------------------------------------------------------------

function ZoomBar({ zoom, onZoom, opacity }: { zoom: number; onZoom: (z: number) => void; opacity: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const H = 132;
  const apply = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onZoom(v);
  };
  return (
    <div
      className="absolute z-20 flex flex-col items-center gap-1"
      style={{ right: 'calc(6px + env(safe-area-inset-right, 0px))', top: 'calc(5.6rem + env(safe-area-inset-top, 0px))', opacity }}
    >
      <span className="pointer-events-none text-[8px] font-bold tracking-widest text-slate-300/80">視野</span>
      <div
        ref={trackRef}
        className="relative w-6 overflow-hidden rounded-full border border-sky-300/35 bg-black/40 backdrop-blur-[2px]"
        style={{ height: H, touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); apply(e.clientY); }}
        onPointerMove={(e) => { if (dragging.current) apply(e.clientY); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <div className="absolute inset-x-0 top-0 h-full">
          {[0.25, 0.5, 0.75].map((m) => (
            <div key={m} className="absolute inset-x-1 h-px bg-white/10" style={{ top: m * H }} />
          ))}
        </div>
        <div
          className="absolute inset-x-1 h-4 rounded-full border border-sky-200/70 bg-sky-400/60 shadow-[0_0_8px_rgba(79,209,255,0.6)]"
          style={{ top: `calc(${(1 - zoom) * (H - 16)}px)` }}
        />
      </div>
      <span className="pointer-events-none text-[8px] font-bold text-sky-300/80">{zoom === 0 ? '1人称' : `${Math.round(zoom * 100)}%`}</span>
    </div>
  );
}

// ------------------------------------------------------------
// 指令ホイール (6角形ラジアルメニュー): PC は T キー / スマホはピンボタン
// ------------------------------------------------------------

function PingWheel({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const R = 108;
  return (
    <div className="relative flex items-center justify-center" style={{ width: R * 2 + 96, height: R * 2 + 96 }}>
      <svg viewBox="0 0 300 300" width={R * 2 + 60} height={R * 2 + 60} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <polygon
          points="150,38 251,95 251,205 150,262 49,205 49,95"
          fill="rgba(8,13,30,0.88)"
          stroke="rgba(110,200,255,0.5)"
          strokeWidth="2"
        />
        <polygon
          points="150,52 239,102 239,198 150,248 61,198 61,102"
          fill="none"
          stroke="rgba(110,200,255,0.18)"
          strokeWidth="1.2"
        />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const rad = ((a - 90) * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={150 + Math.cos(rad) * 30}
              y1={150 + Math.sin(rad) * 30}
              x2={150 + Math.cos(rad) * 100}
              y2={150 + Math.sin(rad) * 100}
              stroke="rgba(110,200,255,0.22)"
              strokeWidth="1.2"
            />
          );
        })}
        <polygon points="150,128 168,162 132,162" fill="rgba(110,200,255,0.14)" stroke="rgba(110,200,255,0.4)" strokeWidth="1.4" />
      </svg>

      {PINGS.map((p, i) => {
        const ang = ((i * 60) - 90) * (Math.PI / 180);
        const x = Math.cos(ang) * R;
        const y = Math.sin(ang) * R;
        return (
          <button
            key={p.key}
            onClick={() => onSend(p.label)}
            className="ping-seg absolute flex flex-col items-center gap-1 rounded-xl border-2 px-2.5 py-2 backdrop-blur-sm transition-transform active:scale-90"
            style={{
              left: `calc(50% + ${x}px - 46px)`,
              top: `calc(50% + ${y}px - 34px)`,
              width: 92,
              borderColor: `${p.color}88`,
              background: `linear-gradient(160deg, ${p.color}22, rgba(8,13,30,0.9))`,
              touchAction: 'manipulation',
            }}
          >
            <span style={{ color: p.color }}><PingIcon k={p.key} size={20} /></span>
            <span className="text-[9px] font-black leading-tight text-white">{p.label}</span>
          </button>
        );
      })}

      <button
        onClick={onClose}
        className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-bold text-slate-300 backdrop-blur-sm"
        style={{ touchAction: 'manipulation' }}
      >
        閉じる (T / タップ)
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// 小さな SVG グリフ (絵文字の代わり)
// ------------------------------------------------------------

export function SwordsGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M4.5 4.5 L14 14 M14 14 l2.5 2.5 M16.5 16.5 l-2 2 a1.4 1.4 0 0 1 -2 -2 l2 -2 M4.5 4.5 l0 4 2.5 2.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 4.5 L10 14 M10 14 l-2.5 2.5 M7.5 16.5 l2 2 a1.4 1.4 0 0 0 2 -2 l-2 -2 M19.5 4.5 l0 4 -2.5 2.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ShieldGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M12 3 L19 5.8 v5.6 q0 5 -7 9.2 q-7 -4.2 -7 -9.2 V5.8 Z" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" />
    </svg>
  );
}
export function BootsGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M7 4.5 v8 l-2 3.5 v2.5 a1 1 0 0 0 1 1 h5.4 l7.1 -3.4 a1.6 1.6 0 0 0 -.4 -3 l-6.6 -1.4 V4.5 Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}
export function HeartGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M12 19.5 c-4.4 -3.2 -6.8 -5.8 -6.8 -8.8 a3.8 3.8 0 0 1 6.8 -2.3 a3.8 3.8 0 0 1 6.8 2.3 c0 3 -2.4 5.6 -6.8 8.8 Z" fill="currentColor" />
    </svg>
  );
}
export function BushGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M5 17 q-2 -4 1.5 -6.5 q.4 -4 4.5 -4 q4 0 4.6 3.6 q4 .4 3.4 5 q1.6 1 -0.4 1.9 Z" fill="currentColor" opacity={0.9} />
    </svg>
  );
}
export function WarnGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 4 L21 19.5 H3 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M12 10 v4.4" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.05" fill="currentColor" />
    </svg>
  );
}
export function StarGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 3.5 l2.5 5.2 5.7 .7 -4.2 3.9 1.1 5.6 -5.1 -2.8 -5.1 2.8 1.1 -5.6 -4.2 -3.9 5.7 -.7 Z" fill="currentColor" />
    </svg>
  );
}
export function ChickGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="11" cy="12.5" r="6.5" fill="#ffe14d" />
      <path d="M16.8 11.5 L21.5 12.8 L16.8 14.4 Z" fill="#ff9a3c" />
      <circle cx="13.2" cy="10.6" r="1.15" fill="#231a10" />
      <path d="M4.6 6.4 q1.6 1 2 2.8" fill="none" stroke="#bfeaff" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
export function ShopGlyph({ size = 16, id, className }: { size?: number; id?: string; className?: string }) {
  if (id) {
    return (
      <span className={`inline-flex items-center justify-center ${className ?? ''}`} style={{ width: size, height: size }}>
        <ShopIconById id={id} size={size} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M5.5 8.5 h13 l-1.1 10.2 a1.6 1.6 0 0 1 -1.6 1.4 H8.2 a1.6 1.6 0 0 1 -1.6 -1.4 Z M9 10.5 V7.6 a3 3 0 0 1 6 0 v2.9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShopIconById({ id, size }: { id: string; size: number }) {
  const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (id) {
      case 'sword': return <path {...sw} d="M5 19 L15.5 8.5 M15.5 8.5 L19 4.5 l.8 4 -2.6 2.6 Z M5 19 l-1 1" />;
      case 'staff': return <path {...sw} d="M7 20.5 L15 6.5 M15 6.5 a3 3 0 1 0 1 -5.6 3 3 0 0 0 -1 5.6 Z" />;
      case 'shield': return <path {...sw} d="M12 3 L19 5.8 v5.6 q0 5 -7 9.2 q-7 -4.2 -7 -9.2 V5.8 Z" />;
      case 'boots': return <path {...sw} d="M7 4.5 v8 l-2 3.5 v2.5 a1 1 0 0 0 1 1 h5.4 l7.1 -3.4 a1.6 1.6 0 0 0 -.4 -3 l-6.6 -1.4 V4.5 Z" />;
      case 'gem': return <path {...sw} d="M7 4.5 h10 l4 5 -9 10.5 L3 9.5 Z" />;
      case 'gauntlet': return <path {...sw} d="M6.5 20 V10 a2 2 0 0 1 4 0 V9 a2 2 0 0 1 4 0 v.6 a2 2 0 0 1 3.6 1.4 c.3 3.4 -.6 6.2 -2.6 9 Z" />;
      case 'scroll': return <path {...sw} d="M6.5 5.5 a1.8 1.8 0 0 1 3.6 0 v11.6 a2.4 2.4 0 0 1 -4.8 0 V8 M10.1 5.5 h7.4 a1.8 1.8 0 0 1 1.8 1.8 v11.4 a2.4 2.4 0 0 1 -4.2 1.6" />;
      case 'blade': return <path {...sw} d="M4.5 19.5 L14 10 M14 10 L20 3.5 l.6 5.4 -3.4 3.4 -3.2 -2.3 M4.5 19.5 l-1 1" />;
      default: return <path {...sw} d="M7 4.5 h10 l4 5 -9 10.5 L3 9.5 Z" />;
    }
  })();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="text-sky-300" aria-hidden>{body}</svg>
  );
}
export function GearGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth={1.9} />
      <path d="M12 3.6 l1 2.3 2.4 -.6 .9 1.6 -1.4 1.9 1.4 1.9 -.9 1.6 -2.4 -.6 -1 2.3 h-1.8 l-1 -2.3 -2.4 .6 -.9 -1.6 1.4 -1.9 -1.4 -1.9 .9 -1.6 2.4 .6 1 -2.3 Z" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" transform="translate(0.9 2.3) scale(0.85)" />
    </svg>
  );
}
export function FlagGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M6.5 21 V4 M6.5 5 h10.5 l-2.4 3 2.4 3 H6.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function HomeGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M4.5 11 L12 4.5 L19.5 11 M6.5 9.6 V19.5 h11 V9.6 M10 19.5 v-5 h4 v5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
