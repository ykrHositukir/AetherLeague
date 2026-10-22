// ============================================================
// AETHER LEAGUE - セーブデータ管理 (localStorage)
// ============================================================

import type {
  ActionKey, BattlePassState, GraphicsTier, LoginBonusState, MapId,
  SaveData, Settings, TrophyState,
} from './types';

const SAVE_KEY = 'aether-league-save-v1';
export const SAVE_VERSION = 1;

export const DEFAULT_KEYBINDS: Record<ActionKey, string> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  attack: 'Space',
  guard: 'KeyF',
  skill1: 'KeyQ',
  skill2: 'KeyE',
  ult: 'KeyR',
  menu: 'KeyC',
  status: 'Tab',
  shop: 'KeyG',
  ping: 'KeyT',
};

export const ACTION_LABELS: Record<ActionKey, string> = {
  up: '上移動',
  down: '下移動',
  left: '左移動',
  right: '右移動',
  attack: '攻撃 / 決定',
  guard: 'ガード',
  skill1: 'スキル1',
  skill2: 'スキル2',
  ult: '必殺技',
  menu: 'メニュー',
  status: 'プレイヤー状態',
  shop: 'ショップ開閉',
  ping: '指令ホイール (6角形)',
};

export const GRAPHICS_INFO: Record<GraphicsTier, { label: string; desc: string }> = {
  low: { label: '低', desc: '軽量モード。影なし・シンプル演出。古いPCやスマホ向け' },
  medium: { label: '中', desc: 'アンリアルエンジン並みの描画。リアルタイム影+ブルーム発光' },
  high: { label: '高', desc: 'アンリアルエンジン以上。高解像度影・強力なグロー・粒子増量' },
  ultra: { label: 'ウルトラ', desc: '最高峰クラス。光柱・volumetric 演出・4倍粒子・超高精細レンダリング' },
  ultimate: { label: 'アルティメット', desc: 'ウルトラを超える銀河級の絶景。草木のポリゴンが爆増してめっちゃ鮮明。それでいて軽量設計。' },
};

function defaultSettings(): Settings {
  return {
    graphics: 'medium',
    keybinds: { ...DEFAULT_KEYBINDS },
    bgm: 60,
    se: 80,
    cameraShake: true,
    announcements: true,
    showFps: false,
    perf: {
      lightMode: false,
      fpsCap: 0,
      effectScale: 1,
    },
    mobile: {
      enabled: false,
      autoDetect: true,
      buttonSize: 1,
      opacity: 0.85,
      preventCopy: true,
      haptics: true,
    },
  };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    playerName: 'レジェンド',
    playerLevel: 1,
    playerExp: 0,
    coins: 500,
    settings: defaultSettings(),
    battlePass: { tier: 1, exp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    trophies: { unlocked: [], newUnlock: [] },
    login: { lastClaimDate: '', streak: 0, dayIndex: 0, available: true },
    stats: { wins: 0, losses: 0, kills: 0, deaths: 0, towers: 0, matches: 0, bestSpree: 0 },
    ownedSkins: [],
    selectedSkin: {},
    dailyMissionProgress: { date: todayStr(), kills: 0, wins: 0, matches: 0, towers: 0 },
    lastMap: 'battlefield',
    lastChar: 'blaze',
    party: [],
  };
}

// ------------------------------------------------------------
// トロフィー定義
// ------------------------------------------------------------

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reward: number; // コイン
  check: (s: SaveData, m: SaveData['dailyMissionProgress']) => boolean;
}

// icon は SVG アイコンキー (Icons.tsx の TrophyIcon で描画)
export const TROPHIES: TrophyDef[] = [
  { id: 'first_blood', name: 'ファーストブラッド', desc: '最初のキルを達成', icon: 'blood', reward: 100, check: (s) => s.stats.kills >= 1 },
  { id: 'first_win', name: '門出の勝利', desc: '初めて試合に勝利', icon: 'medal', reward: 150, check: (s) => s.stats.wins >= 1 },
  { id: 'triple_kill', name: 'トリプルキル', desc: '累計キル数 10 到達', icon: 'swords', reward: 200, check: (s) => s.stats.kills >= 10 },
  { id: 'slayer', name: 'スレイヤー', desc: '累計キル数 50 到達', icon: 'skull', reward: 400, check: (s) => s.stats.kills >= 50 },
  { id: 'tower_fall', name: '城砦破壊者', desc: 'タワーを初破壊', icon: 'castle', reward: 200, check: (s) => s.stats.towers >= 1 },
  { id: 'siege', name: '攻城の雄', desc: 'タワー累計破壊 10', icon: 'boom', reward: 350, check: (s) => s.stats.towers >= 10 },
  { id: 'veteran', name: '歴戦の勇者', desc: '試合数 10 到達', icon: 'medalstar', reward: 300, check: (s) => s.stats.matches >= 10 },
  { id: 'champion', name: 'エーテルチャンピオン', desc: '勝利数 10 到達', icon: 'crown', reward: 500, check: (s) => s.stats.wins >= 10 },
  { id: 'spree5', name: 'レジェンダリー', desc: '1試合で5連続キル', icon: 'flame', reward: 300, check: (s) => s.stats.bestSpree >= 5 },
  { id: 'survivor', name: '不死身の伝説', desc: '試合数 25 到達', icon: 'shield', reward: 450, check: (s) => s.stats.matches >= 25 },
  { id: 'resort_player', name: '夏の思い出', desc: 'リゾートマップで勝利', icon: 'palm', reward: 250, check: (s, m) => s.stats.wins >= 1 && m.wins >= 1 },
  { id: 'farm', name: 'ミニオン名人', desc: '1試合でCS 40 到達', icon: 'wheat', reward: 200, check: (_s, m) => (m.cs ?? 0) >= 40 },
];

// ------------------------------------------------------------
// ログインボーナス (7日サイクル)
// ------------------------------------------------------------

// icon は SVG アイコンキー (Icons.tsx の RewardIcon で描画)
export const LOGIN_REWARDS = [
  { day: 1, coins: 100, icon: 'coin', label: '100コイン' },
  { day: 2, coins: 150, icon: 'coin', label: '150コイン' },
  { day: 3, coins: 200, icon: 'gem', label: '200コイン' },
  { day: 4, coins: 250, icon: 'gem', label: '250コイン' },
  { day: 5, coins: 300, icon: 'gift', label: '300コイン' },
  { day: 6, coins: 400, icon: 'gift', label: '400コイン' },
  { day: 7, coins: 666, icon: 'crown', label: '666コイン+豪華賞品' },
];

export function checkLoginBonus(save: SaveData): LoginBonusState {
  const today = todayStr();
  if (save.login.lastClaimDate !== today) {
    return { ...save.login, available: true };
  }
  return { ...save.login, available: false };
}

export function claimLoginBonus(save: SaveData): { save: SaveData; reward: (typeof LOGIN_REWARDS)[0] } {
  const today = todayStr();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  })();
  let dayIndex = save.login.dayIndex;
  let streak = save.login.streak;
  if (save.login.lastClaimDate !== today) {
    dayIndex = save.login.lastClaimDate === yesterday ? (save.login.dayIndex + 1) % 7 : 0;
    streak = save.login.lastClaimDate === yesterday ? streak + 1 : 1;
  }
  const reward = LOGIN_REWARDS[dayIndex];
  return {
    save: {
      ...save,
      coins: save.coins + reward.coins,
      login: { lastClaimDate: today, streak, dayIndex, available: false },
    },
    reward,
  };
}

// ------------------------------------------------------------
// バトルパス (30ティア)
// ------------------------------------------------------------

export const BP_TIER_EXP = 500;
export const BP_MAX_TIER = 30;

export interface BpReward {
  free: { type: 'coins' | 'skin' | 'title'; value: string | number; label: string };
  premium: { type: 'coins' | 'skin' | 'title'; value: string | number; label: string };
}

export function bpRewardFor(tier: number): BpReward {
  const freeCoins = 60 + tier * 15;
  const premCoins = 120 + tier * 30;
  if (tier === 10) {
    return {
      free: { type: 'coins', value: freeCoins, label: `${freeCoins}コイン` },
      premium: { type: 'skin', value: 'blaze_ember', label: 'スキン「緋炎のブレイズ」' },
    };
  }
  if (tier === 20) {
    return {
      free: { type: 'coins', value: freeCoins, label: `${freeCoins}コイン` },
      premium: { type: 'skin', value: 'frost_aurora', label: 'スキン「極光フロスト」' },
    };
  }
  if (tier === 30) {
    return {
      free: { type: 'title', value: 'エーテルの覇者', label: '称号「エーテルの覇者」' },
      premium: { type: 'skin', value: 'shadow_nightveil', label: 'レアスキン「夜帷シャドウ」' },
    };
  }
  return {
    free: { type: 'coins', value: freeCoins, label: `${freeCoins}コイン` },
    premium: { type: 'coins', value: premCoins, label: `${premCoins}コイン` },
  };
}

export function addBpExp(bp: BattlePassState, exp: number): { bp: BattlePassState; gainedTiers: number } {
  let tier = bp.tier;
  let cur = bp.exp;
  let gainedTiers = 0;
  cur += exp;
  while (cur >= BP_TIER_EXP && tier < BP_MAX_TIER) {
    cur -= BP_TIER_EXP;
    tier += 1;
    gainedTiers += 1;
  }
  if (tier >= BP_MAX_TIER) cur = Math.min(cur, BP_TIER_EXP);
  return { bp: { ...bp, tier, exp: cur }, gainedTiers };
}

// ------------------------------------------------------------
// プレイヤーレベル
// ------------------------------------------------------------

export function playerExpNeed(level: number): number {
  return 300 + (level - 1) * 120;
}

export function addPlayerExp(save: SaveData, exp: number): { save: SaveData; levelUp: number } {
  let level = save.playerLevel;
  let cur = save.playerExp;
  cur += exp;
  let levelUp = 0;
  while (cur >= playerExpNeed(level)) {
    cur -= playerExpNeed(level);
    level += 1;
    levelUp += 1;
  }
  return { save: { ...save, playerLevel: level, playerExp: cur }, levelUp };
}

// ------------------------------------------------------------
// 読み書き
// ------------------------------------------------------------

function deepMerge<T>(base: T, patch: Partial<T> | undefined): T {
  if (patch === undefined) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return (patch as T) ?? base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof (base as Record<string, unknown>)[k] === 'object') {
      out[k] = deepMerge((base as Record<string, unknown>)[k], v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    const merged: SaveData = {
      ...base,
      ...deepMerge(base, parsed),
      settings: deepMerge(base.settings, parsed.settings),
      battlePass: { ...base.battlePass, ...parsed.battlePass },
      trophies: { ...base.trophies, ...parsed.trophies },
      login: { ...base.login, ...parsed.login },
      stats: { ...base.stats, ...parsed.stats },
      dailyMissionProgress: { ...base.dailyMissionProgress, ...parsed.dailyMissionProgress },
    };
    // キーバインドの整合性
    for (const k of Object.keys(DEFAULT_KEYBINDS) as ActionKey[]) {
      if (!merged.settings.keybinds[k]) merged.settings.keybinds[k] = DEFAULT_KEYBINDS[k];
    }
    // 日付が変わっていたらミッションリセット
    if (merged.dailyMissionProgress.date !== todayStr()) {
      merged.dailyMissionProgress = { date: todayStr(), kills: 0, wins: 0, matches: 0, towers: 0 };
    }
    return merged;
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 容量エラー等は無視
  }
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  persistSave(fresh);
  return fresh;
}

export function keyLabel(code: string): string {
  if (!code) return '---';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'Tab') return 'TAB';
  if (code.startsWith('Arrow')) return code.replace('Arrow', '').toUpperCase();
  if (code.startsWith('Shift')) return 'SHIFT';
  if (code.startsWith('Control')) return 'CTRL';
  if (code.startsWith('Alt')) return 'ALT';
  return code.toUpperCase();
}
