'use client';

// ============================================================
// AETHER LEAGUE - アプリ統括 (画面遷移 / セーブ / 報酬)
// 起動 → ロード → OPタイトル(PLAY) → メインメニュー → バトル → リザルト
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleResultData, MapId, SaveData, Team } from '@/game/types';
import {
  addBpExp, addPlayerExp, bpRewardFor, claimLoginBonus, checkLoginBonus,
  loadSave, persistSave, resetSave, TROPHIES,
} from '@/game/storage';
import { CHARACTERS } from '@/game/characters';
import {
  GameClient, BattleNet,
  type PlayerInfo, type PartyState, type DuelMatchInfo, type PartyMatchInfo, type NetPeer,
} from '@/game/net/online';
import { audio } from '@/game/audio';

import { BootScreen, HoshiNetSplash, TitleScreen } from './screens/BootTitle';
import { MainMenu } from './screens/MainMenu';
import { CharSelect, MapSelect } from './screens/Selects';
import { SettingsScreen } from './screens/Settings';
import { BattlePassScreen, LoginBonusModal, TrophyScreen } from './screens/Extras';
import { OnlineLobby } from './screens/OnlineLobby';
import { ResultScreen } from './screens/Result';
import { BattleView, type HudLessResult } from './battle/BattleView';
import { DynButton } from './ui';
import { MailIcon, SwordsIcon, HoshiNetLogo, PlayIcon, GlobeIcon } from './Icons';
import { getChar } from '@/game/characters';

const CHAR_NAME = (id: string) => getChar(id).name;

type Screen =
  | 'splash' | 'boot' | 'title' | 'menu' | 'charselect' | 'mapselect'
  | 'settings' | 'trophies' | 'battlepass' | 'online'
  | 'matching' | 'battle' | 'result';

/** マッチング画面に渡す編成情報 */
interface MatchIntro {
  charId: string;
  mapId: MapId;
  allyIds: string[];
  allyNames: (string | undefined)[];
  enemyIds: string[];
  duelEnemy?: string;
}

interface BattleConfig {
  charId: string;
  mapId: MapId;
  mode: 'bot' | 'online';
  side?: Team;
  net?: BattleNet | null;
  netPeers?: NetPeer[];
  myPid?: string;
  allyIds: string[];
  allyNames?: (string | undefined)[];
  enemyIds: string[];
}

  // ===== ボットチーム編成 (プレイヤー以外のキャラから3v3) =====

  function makeBotTeams(charId: string): { allyIds: string[]; allyNames: (string | undefined)[]; enemyIds: string[] } {
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== charId);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { allyIds: pool.slice(0, 2), allyNames: [undefined, undefined], enemyIds: pool.slice(2, 5) };
  }

  // ===== パーティ込みの編成: 招待メンバーを味方に、残りをランダム補完 (3v3) =====

  function makePartyTeams(charId: string, party: { name: string; charId: string }[]) {
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== charId && !party.some((m) => m.charId === id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const allyIds: string[] = [];
    const allyNames: (string | undefined)[] = [];
    for (const m of party) { allyIds.push(m.charId); allyNames.push(m.name); }
    while (allyIds.length < 2) {
      allyIds.push(pool.shift() ?? 'aqua');
      allyNames.push(undefined);  // ランダム補完分はデフォルト名「味方・○○」
    }
    const enemyIds = pool.filter((id) => !allyIds.includes(id)).slice(0, 3);
    while (enemyIds.length < 3) {
      const rest = CHARACTERS.map((c) => c.id).find((id) => id !== charId && !enemyIds.includes(id) && !allyIds.includes(id));
      if (!rest) break;
      enemyIds.push(rest);
    }
    return { allyIds, allyNames, enemyIds };
  }

  // ===== オンラインパーティ開始時の bot 補完編成 (host が決定して全員に配布) =====
  // パーティに追加済みのボット (isBot メンバー) を優先し、足りない枠をランダム補完

  function buildPartyBots(party: PartyState, myCharId: string): NetPeer[] {
    const humans = party.members.filter((m) => !m.isBot);
    const preBots = party.members.filter((m) => m.isBot);
    const usedBlue = humans.filter((_, i) => i % 2 === 0).length;
    const usedRed = humans.length - usedBlue;
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== myCharId && !humans.some((m) => m.charId === id) && !preBots.some((m) => m.charId === id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const charName = (id: string) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
    const bots: NetPeer[] = [];
    let bi = 0;
    let pi = 0;
    const makeBot = (side: 'blue' | 'red', fallback: string): NetPeer => {
      const pb = preBots[pi++];
      if (pb) return { pid: pb.pid, name: pb.name || charName(pb.charId), charId: pb.charId, side, isBot: true };
      return { pid: `bot${bots.length + 1}`, name: '', charId: pool[bi++] ?? fallback, side, isBot: true };
    };
    for (let i = 0; i < 3 - usedBlue; i++) bots.push(makeBot('blue', 'blaze'));
    for (let i = 0; i < 3 - usedRed; i++) bots.push(makeBot('red', 'aqua'));
    return bots;
  }

// ------------------------------------------------------------
// 試合結果 → 報酬計算 & セーブ反映
// ------------------------------------------------------------

function computeBattleResult(
  save: SaveData,
  stats: HudLessResult,
): { save: SaveData; result: BattleResultData } {
  const win = stats.win;
  const playerExp = Math.round(
    60 + stats.kills * 8 + stats.assists * 4 + stats.cs * 0.5 + stats.towers * 30 + (win ? 120 : 30),
  );
  const coins = Math.round(
    40 + stats.kills * 6 + stats.cs * 0.3 + stats.towers * 15 + (win ? 80 : 25),
  );
  const bpExp = 30 + (win ? 60 : 30) + stats.kills * 6;

  let next: SaveData = { ...save };

  // 戦績
  next.stats = {
    ...next.stats,
    wins: next.stats.wins + (win ? 1 : 0),
    losses: next.stats.losses + (win ? 0 : 1),
    kills: next.stats.kills + stats.kills,
    deaths: next.stats.deaths + stats.deaths,
    towers: next.stats.towers + stats.towers,
    matches: next.stats.matches + 1,
    bestSpree: Math.max(next.stats.bestSpree, stats.kills),
  };

  // デイリーミッション
  const dmp = next.dailyMissionProgress;
  next.dailyMissionProgress = {
    ...dmp,
    kills: dmp.kills + stats.kills,
    wins: dmp.wins + (win ? 1 : 0),
    matches: dmp.matches + 1,
    towers: dmp.towers + stats.towers,
    cs: (dmp.cs ?? 0) + stats.cs,
  };

  // 通貨 / プレイヤーEXP / バトルパスEXP
  next.coins += coins;
  next = addPlayerExp(next, playerExp).save;
  next.battlePass = addBpExp(next.battlePass, bpExp).bp;

  // トロフィー判定
  const prevUnlocked = new Set(next.trophies.unlocked);
  const newly = TROPHIES.filter(
    (t) => !prevUnlocked.has(t.id) && t.check(next, next.dailyMissionProgress),
  );
  if (newly.length > 0) {
    next.coins += newly.reduce((a, t) => a + t.reward, 0);
    next.trophies = {
      unlocked: [...next.trophies.unlocked, ...newly.map((t) => t.id)],
      newUnlock: newly.map((t) => t.id),
    };
  }

  const result: BattleResultData = {
    win,
    stats: { ...stats },
    rewards: { playerExp, coins, bpExp, trophiesUnlocked: newly.map((t) => t.id) },
  };
  return { save: next, result };
}

// ------------------------------------------------------------
// メインアプリ
// ------------------------------------------------------------

export default function GameApp() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [save, setSave] = useState<SaveData | null>(() => {
    // クライアント専用 (ssr:false) のためレンダー初期化可能
    if (typeof window === 'undefined') return null;
    const s = loadSave();
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (s.settings.mobile.autoDetect) s.settings.mobile.enabled = isTouch;
    s.login = checkLoginBonus(s);
    return s;
  });
  const [battleCfg, setBattleCfg] = useState<BattleConfig | null>(null);
  const [result, setResult] = useState<BattleResultData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [battleSeq, setBattleSeq] = useState(0);

  const saveRef = useRef<SaveData | null>(null);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // ===== オンライン常駐クライアント =====
  const netRef = useRef<GameClient | null>(null);
  if (typeof window !== 'undefined' && !netRef.current) netRef.current = new GameClient();
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerInfo[]>([]);
  const [onlineOk, setOnlineOk] = useState(false);
  const [myPid, setMyPid] = useState('');
  const [party, setParty] = useState<PartyState | null>(null);
  const partyRef = useRef<PartyState | null>(null);
  useEffect(() => { partyRef.current = party; }, [party]);
  const [partyInvite, setPartyInvite] = useState<{ from: PlayerInfo; partyId: string } | null>(null);
  const [duelInvite, setDuelInvite] = useState<{ from: PlayerInfo } | null>(null);
  const [netToast, setNetToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNetToast = useCallback((msg: string) => {
    setNetToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNetToast(''), 3500);
  }, []);

  // ===== 初期ロードは useState 初期化子で実施済み =====

  // ===== 永続化 =====
  useEffect(() => {
    if (save) persistSave(save);
  }, [save]);

  // ===== オーディオ: 初回ユーザー操作で初期化 (自動再生ポリシー対策) =====
  useEffect(() => {
    const h = () => audio.init();
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, []);

  // ===== オーディオ: 設定スライダーを即時反映 =====
  useEffect(() => {
    audio.setVolumes(save?.settings.bgm ?? 60, save?.settings.se ?? 80);
  }, [save?.settings.bgm, save?.settings.se]);
  // デバッグ/検証用プローブ
  useEffect(() => {
    (window as unknown as { __alAudio?: typeof audio }).__alAudio = audio;
    (window as unknown as { __alNet?: GameClient | null }).__alNet = netRef.current;
  }, []);

  // ===== BGM: 画面ごとに切替 (バトル=激しい曲 / それ以外=タイトル曲) =====
  useEffect(() => {
    if (screen === 'battle') {
      audio.playBgm('battle');
    } else if (screen === 'boot' || screen === 'splash') {
      audio.stopBgm();
    } else {
      audio.playBgm('title');
    }
  }, [screen]);

  // ===== 長押しコピー対策 (スマホオプション) =====
  useEffect(() => {
    if (!save?.settings.mobile.preventCopy) return;
    const noCtx = (e: Event) => e.preventDefault();
    const noSelect = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
    };
    const noDrag = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', noCtx);
    document.addEventListener('selectstart', noSelect);
    document.addEventListener('dragstart', noDrag);
    return () => {
      document.removeEventListener('contextmenu', noCtx);
      document.removeEventListener('selectstart', noSelect);
      document.removeEventListener('dragstart', noDrag);
    };
  }, [save?.settings.mobile.preventCopy]);

  // ===== OPタイトル: SPACEでも開始 =====
  useEffect(() => {
    if (screen !== 'title') return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setScreen('menu');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen]);

  // ===== オンライン常駐: ハンドラ接続 (一回のみ) =====
  const startDuelRef = useRef<(info: DuelMatchInfo) => void>(() => {});
  const startPartyRef = useRef<(info: PartyMatchInfo) => void>(() => {});
  useEffect(() => {
    const gc = netRef.current;
    if (!gc) return;
    gc.onConn = (ok) => { setOnlineOk(ok); setMyPid(gc.pid); };
    gc.onOnline = (ps) => setOnlinePlayers(ps);
    gc.onParty = (p) => setParty(p);
    gc.onPartyInvite = (from, partyId) => { audio.sfx('invite'); setPartyInvite({ from, partyId }); };
    gc.onPartyDeclined = (name) => showNetToast(`${name} さんがパーティ招待を辞退しました`);
    gc.onPartyKicked = () => { setParty(null); showNetToast('パーティから外されました'); };
    gc.onPartyError = (msg) => showNetToast(msg);
    gc.onDuelInvite = (from) => { audio.sfx('duel'); setDuelInvite({ from }); };
    gc.onDuelDeclined = (name) => showNetToast(`${name} さんがデュエルを辞退しました`);
    gc.onDuelError = (msg) => showNetToast(msg);
    gc.onDuelStart = (info) => startDuelRef.current(info);
    gc.onPartyStart = (info) => startPartyRef.current(info);
    gc.onMatch = (info) => {
      // ランダムマッチ成立 → マッチ演出を見せるため少し遅らせて遷移
      audio.sfx('duel');
      setTimeout(() => startDuelRef.current(info), 1200);
    };
  }, [showNetToast]);

  // ===== オンライン常駐: 接続 (名前/キャラ変更時も再登録) =====
  useEffect(() => {
    if (!save) return;
    netRef.current?.connect(save.playerName, save.lastChar);
  }, [save?.playerName, save?.lastChar]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ===== オンライン対戦終了後: バトルNetだけ後片付け =====
  useEffect(() => {
    if (screen === 'battle' || screen === 'result' || !battleCfg?.net) return;
    try { battleCfg.net.dispose(); } catch { /* noop */ }
  }, [screen]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ===== メニュー遷移 (ログボ表示感谢なし) =====
  const goMenu = useCallback(() => {
    setScreen('menu');
    if (saveRef.current?.login.available) setShowLogin(true);
  }, []);

  // ===== バトル開始 (Bot戦): パーティ対応 + デュエル (1v1) — マッチング画面を挟む =====
  const [matchIntro, setMatchIntro] = useState<MatchIntro | null>(null);

  const startBotBattle = useCallback((charId: string, mapId: MapId, opts?: { duelEnemy?: string }) => {
    let intro: MatchIntro;
    if (opts?.duelEnemy) {
      // デュエル: 自分 vs 選んだ相手の1v1
      intro = { charId, mapId, allyIds: [], allyNames: [], enemyIds: [opts.duelEnemy], duelEnemy: opts.duelEnemy };
    } else {
      const cur = saveRef.current;
      const party = cur?.party ?? [];
      const teams = party.length > 0 ? makePartyTeams(charId, party) : makeBotTeams(charId);
      intro = { charId, mapId, allyIds: teams.allyIds, allyNames: teams.allyNames, enemyIds: teams.enemyIds };
    }
    setSave((s) => (s ? { ...s, lastChar: charId, lastMap: mapId } : s));
    setMatchIntro(intro);
    setScreen('matching');
  }, []);

  // ===== マッチング演出: Bot対戦は1秒でマッチ成立 =====
  useEffect(() => {
    if (screen !== 'matching' || !matchIntro) return;
    const t = setTimeout(() => {
      const it = matchIntro;
      setBattleCfg({
        charId: it.charId,
        mapId: it.mapId,
        mode: 'bot',
        allyIds: it.allyIds,
        allyNames: it.allyNames,
        enemyIds: it.enemyIds,
        net: null,
      });
      setBattleSeq((n) => n + 1);
      setScreen('battle');
      setMatchIntro(null);
    }, 1000);
    return () => clearTimeout(t);
  }, [screen, matchIntro]);

  // ===== オンラインデュエル開始 (1v1) =====
  const startOnlineDuel = useCallback((info: DuelMatchInfo) => {
    const net = netRef.current?.createBattleNet(info.roomId, info.side) ?? null;
    const myChar = saveRef.current?.lastChar ?? 'blaze';
    setSave((s) => (s ? { ...s, lastMap: 'battlefield' } : s));
    setBattleCfg({
      charId: myChar,
      mapId: 'battlefield',
      mode: 'online',
      side: info.side,
      net,
      myPid: info.myPid,
      netPeers: [{ pid: info.opp.pid, name: info.opp.name, charId: info.opp.charId, side: info.side === 'blue' ? 'red' : 'blue' }],
      allyIds: [],
      enemyIds: [],
    });
    setBattleSeq((n) => n + 1);
    setScreen('battle');
  }, []);
  startDuelRef.current = startOnlineDuel;

  // ===== オンラインパーティ開始 (3v3) =====
  const startOnlineParty = useCallback((info: PartyMatchInfo) => {
    const net = netRef.current?.createBattleNet(info.roomId, info.side) ?? null;
    const me = info.peers.find((p) => p.pid === info.myPid);
    const others = info.peers.filter((p) => p.pid !== info.myPid);
    const mapId: MapId = info.mapId === 'resort' ? 'resort' : info.mapId === 'station' ? 'station' : 'battlefield';
    setSave((s) => (s ? { ...s, lastMap: mapId } : s));
    setBattleCfg({
      charId: me?.charId ?? saveRef.current?.lastChar ?? 'blaze',
      mapId,
      mode: 'online',
      side: info.side,
      net,
      myPid: info.myPid,
      netPeers: others.map((p) => ({ pid: p.pid, name: p.name, charId: p.charId, side: p.side, isBot: p.isBot })),
      allyIds: [],
      enemyIds: [],
    });
    setBattleSeq((n) => n + 1);
    setScreen('battle');
  }, []);
  startPartyRef.current = startOnlineParty;

  // ===== バトル終了 → 報酬計算 =====
  const handleBattleEnd = useCallback((stats: HudLessResult) => {
    const cur = saveRef.current;
    if (!cur) return;
    audio.stopBgm();
    audio.sfx(stats.win ? 'victory' : 'defeat');
    const { save: next, result: r } = computeBattleResult(cur, stats);
    setSave(next);
    setResult(r);
    setScreen('result');
    // サーバへロビー復帰を通知 (パーティ維持)
    netRef.current?.back(partyRef.current ? 'party' : 'lobby');
  }, []);

  // ===== ログインボーナス受取 =====
  const handleClaimLogin = useCallback(() => {
    setSave((s) => {
      if (!s) return s;
      const { save: next } = claimLoginBonus(s);
      return next;
    });
  }, []);

  // ===== バトルパス =====
  const claimBp = useCallback((tier: number, premium: boolean) => {
    setSave((s) => {
      if (!s) return s;
      const bp = s.battlePass;
      if (tier > bp.tier) return s;
      if (premium) {
        if (!bp.premium || bp.claimedPremium.includes(tier)) return s;
      } else if (bp.claimedFree.includes(tier)) return s;
      const reward = premium ? bpRewardFor(tier).premium : bpRewardFor(tier).free;
      let coins = s.coins;
      let ownedSkins = s.ownedSkins;
      if (reward.type === 'coins' && typeof reward.value === 'number') coins += reward.value;
      if (reward.type === 'skin' && typeof reward.value === 'string' && !ownedSkins.includes(reward.value)) {
        ownedSkins = [...ownedSkins, reward.value];
      }
      return {
        ...s,
        coins,
        ownedSkins,
        battlePass: premium
          ? { ...bp, claimedPremium: [...bp.claimedPremium, tier] }
          : { ...bp, claimedFree: [...bp.claimedFree, tier] },
      };
    });
  }, []);

  const buyPremium = useCallback(() => {
    setSave((s) => {
      if (!s || s.battlePass.premium || s.coins < 980) return s;
      return {
        ...s,
        coins: s.coins - 980,
        battlePass: { ...s.battlePass, premium: true },
      };
    });
  }, []);

  // ===== ナビゲーション =====
  const nav = useCallback((s: 'charselect' | 'mapselect' | 'trophies' | 'battlepass' | 'settings' | 'online' | 'title') => {
    if (s === 'trophies') {
      setSave((cur) => (cur && cur.trophies.newUnlock.length
        ? { ...cur, trophies: { ...cur.trophies, newUnlock: [] } }
        : cur));
    }
    setScreen(s);
  }, []);

  // ===== 描画 =====
  if (!save) {
    return (
      <div className="game-root flex items-center justify-center bg-[#05070f]">
        <div className="font-display animate-pulse text-xl tracking-widest text-sky-300">AETHER LEAGUE</div>
      </div>
    );
  }

  const preventCopy = save.settings.mobile.preventCopy;

  return (
    <div className={preventCopy ? 'no-touch-copy' : ''}>
      {screen === 'splash' && <HoshiNetSplash onDone={() => setScreen('boot')} />}

      {screen === 'boot' && <BootScreen onDone={() => setScreen('title')} />}

      {screen === 'title' && (
        <TitleScreen
          onPlay={goMenu}
          onSettings={() => setScreen('settings')}
        />
      )}

      {screen === 'menu' && (
        <MainMenu
          save={save}
          onNav={nav}
          onQuickPlay={(opts) => startBotBattle(save.lastChar, save.lastMap, opts)}
          onInvite={(name, cid) => setSave((s) => (s && s.party.length < 2 ? { ...s, party: [...s.party, { name, charId: cid }] } : s))}
          onKickParty={(idx) => setSave((s) => (s ? { ...s, party: s.party.filter((_, i) => i !== idx) } : s))}
          onLoginBonus={() => setShowLogin(true)}
          online={{
            ok: onlineOk,
            myPid,
            players: onlinePlayers,
            party,
            onInviteOnline: (pid) => { netRef.current?.inviteParty(pid); const nm = onlinePlayers.find((p) => p.pid === pid)?.name ?? ''; showNetToast(`${nm} さんに招待を送りました`); },
            onAddBotOnline: (name, cid) => { netRef.current?.addPartyBot(name, cid); showNetToast(`${name} (BOT) をパーティに追加しました`); },
            onDuelOnline: (pid) => { netRef.current?.inviteDuel(pid); const nm = onlinePlayers.find((p) => p.pid === pid)?.name ?? ''; showNetToast(`${nm} さんにデュエルを申し込みました`); },
            onLeaveParty: () => netRef.current?.leaveParty(),
            onKickPartyOnline: (pid) => netRef.current?.kickParty(pid),
            onStartParty: (mapId) => {
              const p = partyRef.current;
              if (p) netRef.current?.startParty(mapId, buildPartyBots(p, save.lastChar));
            },
          }}
        />
      )}

      {screen === 'charselect' && (
        <CharSelect
          initialChar={save.lastChar}
          ownedSkins={save.ownedSkins}
          selectedSkin={save.selectedSkin}
          onBack={goMenu}
          onConfirm={(charId) => {
            setSave((s) => (s ? { ...s, lastChar: charId } : s));
            setScreen('mapselect');
          }}
        />
      )}

      {screen === 'mapselect' && (
        <MapSelect
          initialMap={save.lastMap}
          onBack={() => setScreen('charselect')}
          onStart={(mapId) => startBotBattle(save.lastChar, mapId)}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          save={save}
          onBack={goMenu}
          onChange={(patch) => setSave((s) => (s ? patch(s) : s))}
          onReset={() => {
            const fresh = resetSave();
            persistSave(fresh);
            setSave(fresh);
          }}
        />
      )}

      {screen === 'trophies' && (
        <TrophyScreen save={save} onBack={goMenu} />
      )}

      {screen === 'battlepass' && (
        <BattlePassScreen
          save={save}
          onBack={goMenu}
          onClaim={claimBp}
          onBuyPremium={buyPremium}
        />
      )}

      {screen === 'online' && (
        <OnlineLobby
          save={save}
          onBack={goMenu}
          client={netRef.current}
        />
      )}

      {screen === 'matching' && matchIntro && (
        <MatchingScreen intro={matchIntro} playerName={save.playerName} />
      )}

      {screen === 'battle' && battleCfg && (
        <BattleView
          key={`${battleCfg.mode}-${battleCfg.mapId}-${battleCfg.charId}-${battleSeq}`}
          save={save}
          charId={battleCfg.charId}
          mapId={battleCfg.mapId}
          mode={battleCfg.mode}
          side={battleCfg.side}
          net={battleCfg.net}
          netPeers={battleCfg.netPeers}
          myPid={battleCfg.myPid}
          allyCharIds={battleCfg.allyIds}
          allyNames={battleCfg.allyNames}
          enemyCharIds={battleCfg.enemyIds}
          onEnd={handleBattleEnd}
          onExit={() => {
            if (battleCfg.mode === 'online') {
              try { battleCfg.net?.dispose(); } catch { /* noop */ }
              netRef.current?.back(partyRef.current ? 'party' : 'lobby');
            }
            goMenu();
          }}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          playerName={save.playerName}
          onRetry={() => startBotBattle(result.stats.charId, result.stats.mapId)}
          onMenu={goMenu}
        />
      )}

      {showLogin && (
        <LoginBonusModal
          save={save}
          onClaim={handleClaimLogin}
          onClose={() => setShowLogin(false)}
        />
      )}

      {/* ===== パーティ招待 受信モーダル ===== */}
      {partyInvite && screen !== 'battle' && screen !== 'boot' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="slide-up-in hud-panel w-96 max-w-[92vw] rounded-2xl border-emerald-400/40 p-6 text-center">
            <div className="mx-auto flex justify-center text-emerald-300"><MailIcon size={30} /></div>
            <h2 className="mt-2 font-display text-lg font-black tracking-widest text-white">パーティ招待</h2>
            <p className="mt-2 text-sm text-slate-200">
              <span className="font-black text-emerald-300">{partyInvite.from.name}</span>
              <span className="ml-1 text-slate-400">({CHAR_NAME(partyInvite.from.charId)})</span>
              がパーティに招待しました
            </p>
            <p className="mt-1 text-[11px] text-slate-400">参加すると 3v3 を一緒にプレイできます</p>
            <div className="mt-5 flex gap-2">
              <DynButton variant="ghost" className="flex-1 py-3" onClick={() => { netRef.current?.declineParty(partyInvite.from.pid); setPartyInvite(null); }}>辞退</DynButton>
              <DynButton
                variant="play" className="flex-1 py-3"
                onClick={() => { netRef.current?.acceptParty(partyInvite.partyId); setPartyInvite(null); }}
              >
                参加する
              </DynButton>
            </div>
          </div>
        </div>
      )}

      {/* ===== デュエル申込 受信モーダル ===== */}
      {duelInvite && screen !== 'battle' && screen !== 'boot' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="slide-up-in hud-panel w-96 max-w-[92vw] rounded-2xl border-rose-400/40 p-6 text-center">
            <div className="mx-auto flex justify-center text-rose-300"><SwordsIcon size={30} /></div>
            <h2 className="mt-2 font-display text-lg font-black tracking-widest text-white">デュエル申込</h2>
            <p className="mt-2 text-sm text-slate-200">
              <span className="font-black text-rose-300">{duelInvite.from.name}</span>
              <span className="ml-1 text-slate-400">({CHAR_NAME(duelInvite.from.charId)})</span>
              がデュエル (1v1) を申し込んできました
            </p>
            <div className="mt-5 flex gap-2">
              <DynButton variant="ghost" className="flex-1 py-3" onClick={() => { netRef.current?.declineDuel(duelInvite.from.pid); setDuelInvite(null); }}>辞退</DynButton>
              <DynButton
                variant="danger" className="flex-1 py-3"
                onClick={() => { const f = duelInvite.from.pid; setDuelInvite(null); netRef.current?.acceptDuel(f); }}
              >
                受けて立つ
              </DynButton>
            </div>
          </div>
        </div>
      )}

      {/* ===== 通信トースト ===== */}
      {netToast && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-50 -translate-x-1/2">
          <div className="hud-panel slide-up-in rounded-xl px-4 py-2.5 text-xs font-bold text-sky-100">{netToast}</div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------
// マッチング画面 (Bot対戦は1秒で見つかる)
// -----------------------------------------------------------

function MatchingScreen({ intro, playerName }: { intro: MatchIntro; playerName: string }) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setFound(true); audio.sfx('match'); }, 420);
    return () => clearTimeout(t);
  }, []);
  const myChar = getChar(intro.charId);
  return (
    <div className="game-root flex flex-col items-center justify-center bg-[#05070f]">
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="title-particle absolute h-1 w-1 rounded-full bg-sky-300/70"
            style={{ left: `${(i * 47) % 100}%`, bottom: '-2%', animationDuration: `${3 + (i % 5)}s`, animationDelay: `${i * 0.3}s`, boxShadow: '0 0 8px rgba(79,209,255,0.9)' }} />
        ))}
      </div>
      <div className="relative z-10 w-full max-w-xl px-6 text-center">
        <div className="font-display text-xs tracking-[0.5em] text-sky-400">MATCH MAKING</div>
        {!found ? (
          <>
            <h1 className="mt-3 font-display text-3xl font-black tracking-widest text-white sm:text-4xl">
              マッチング中<span className="animate-pulse">…</span>
            </h1>
            <div className="mx-auto mt-6 h-2 w-64 overflow-hidden" style={{ transform: 'skewX(-18deg)' }}>
              <div className="para-frame h-full w-full bg-slate-900">
                <div className="para-stripes h-full w-full opacity-60" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-400">プレイヤーを探しています</div>
          </>
        ) : (
          <>
            <h1 className="match-found font-display text-3xl font-black tracking-widest text-emerald-300 text-glow-blue sm:text-4xl">
              対戦相手が見つかりました！
            </h1>
            <div className="mt-7 flex items-center justify-center gap-4 sm:gap-8">
              {/* 味方チーム */}
              <div className="flex-1">
                <div className="mb-2 text-[10px] font-black tracking-widest text-sky-300">YOUR TEAM</div>
                <div className="flex flex-col items-center gap-1.5">
                  <TeamBadge name={playerName} charId={intro.charId} me />
                  {intro.allyIds.map((id, i) => (
                    <TeamBadge key={i} name={intro.allyNames[i] ?? `味方・${CHAR_NAME(id)}`} charId={id} />
                  ))}
                </div>
              </div>
              <div className="font-display text-2xl font-black text-slate-500 sm:text-3xl">VS</div>
              {/* 敵チーム */}
              <div className="flex-1">
                <div className="mb-2 text-[10px] font-black tracking-widest text-rose-300">ENEMY TEAM</div>
                <div className="flex flex-col items-center gap-1.5">
                  {intro.enemyIds.map((id, i) => (
                    <TeamBadge key={i} name={intro.duelEnemy ? 'ライバル' : `敵チーム ${i + 1}`} charId={id} enemy />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] tracking-widest text-slate-500">
              <GlobeIcon size={11} /> {getMapName(intro.mapId)} — 間もなく開戦
            </div>
          </>
        )}
        <div className="mt-8 flex items-center justify-center gap-1 text-[9px] tracking-widest text-slate-700">
          <HoshiNetLogo size={13} /> ©HoshiNet — MATCH SERVER
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center text-[10px] tracking-widest text-slate-600">
        <span className="inline-flex items-center gap-1"><PlayIcon size={10} /> {myChar.name} で出撃</span>
      </div>
    </div>
  );
}

function TeamBadge({ name, charId, me, enemy }: { name: string; charId: string; me?: boolean; enemy?: boolean }) {
  const c = getChar(charId);
  return (
    <div
      className={`flex w-44 items-center gap-2 rounded-lg border px-2.5 py-1.5 backdrop-blur-sm ${
        me ? 'border-sky-400/60 bg-sky-500/15 shadow-[0_0_14px_rgba(80,200,255,0.35)]'
        : enemy ? 'border-rose-400/40 bg-rose-500/10'
        : 'border-sky-400/25 bg-white/[0.04]'}`}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-[9px] font-black text-white"
        style={{ background: `linear-gradient(135deg, ${c.colors.primary ?? '#48c'}, ${c.colors.secondary ?? '#7ae'})` }}
      >
        {c.name.slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[11px] font-bold text-white">{name}</span>
        <span className="block text-[8px] text-slate-400">{c.name}</span>
      </span>
    </div>
  );
}

function getMapName(mapId: string): string {
  return mapId === 'resort' ? 'サンリーフ・リゾート' : mapId === 'station' ? 'エクスプレス・ターミナル' : '暁光のエーテル戦場';
}

function getCharName(charId: string): string {
  return CHARACTERS.find((c) => c.id === charId)?.name ?? charId;
}
