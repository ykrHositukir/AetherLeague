// ============================================================
// AETHER LEAGUE - 型定義
// ============================================================

/** 弾・エフェクトの形状 */
export type ProjShape =
  | 'sphere' | 'box' | 'octa' | 'tetra' | 'torus' | 'cone'
  | 'icosa' | 'capsule' | 'star' | 'diamond' | 'crystal' | 'ring' | 'shuriken' | 'arrow'
  | 'sword';

/** 発光タイプ: 白発光 or 黒発光(ダークグロー) */
export type GlowType = 'white' | 'black';

export type Role = 'ファイター' | 'メイジ' | 'アサシン' | 'タンク' | 'サポーター' | 'マークスマン';
export type Element = '炎' | '氷' | '雷' | '土' | '光' | '闇' | '水' | '風';

export type WeaponType =
  | 'sword' | 'staff' | 'daggers' | 'hammer' | 'wand' | 'shuriken' | 'trident' | 'bow' | 'plush' | 'greatsword';

export type SkillKind = 'projectile' | 'dash' | 'aoe' | 'buff' | 'heal' | 'burst' | 'summon';

/** スキルアイコンの種類 (SkillIcon コンポーネントで SVG 描画) */
export type SkillGlyph =
  | 'flame-thrust' | 'fire-cyclone' | 'blazing-slash'
  | 'icicle' | 'blizzard-ring' | 'frozen-nova'
  | 'thunder-claw' | 'lightning-dash' | 'thunder-god'
  | 'rock-throw' | 'earth-shield' | 'gravity-quake'
  | 'holy-ray' | 'heal-wave' | 'judgment-light'
  | 'triple-shuriken' | 'shadow-step' | 'dark-waltz'
  | 'bubble-shot' | 'tide-burst' | 'tsunami'
  | 'wind-arrow' | 'gale-step' | 'storm-arrows'
  | 'surprise-bomb' | 'nap-bed' | 'rage-burst'
  | 'void-fang' | 'hound-call' | 'phantom-reap'
  | 'iron-smash' | 'taunt-horn' | 'fortress-wall'
  | 'heart-beam' | 'heal-cyclone' | 'star-hymn'
  | 'star-ring' | 'star-slash' | 'star-ride';

export interface BuffData {
  shield?: number;      // シールド量
  heal?: number;        // 即時回復
  speedPct?: number;    // 移動速度%増
  atkPct?: number;      // 攻撃力%増
  armorPct?: number;
  duration: number;     // 秒
}

export interface SkillDef {
  slot: 'Q' | 'E' | 'R';
  name: string;
  desc: string;
  kind: SkillKind;
  cooldown: number;
  manaCost: number;
  damage?: number;        // 攻撃力倍率
  aoeRadius?: number;
  range?: number;
  projSpeed?: number;
  count?: number;         // 弾数
  spreadDeg?: number;
  shape: ProjShape;
  color: string;
  glow: GlowType;
  glyph: SkillGlyph;   // スキルアイコン (絵)
  buff?: BuffData;
  dashDist?: number;
  dashDamage?: number;
  slowPct?: number;
  slowDur?: number;
  /** 命中時にひよらせる秒数 (びっくりさせて動けなくする) */
  cowerDur?: number;
  /** 発動するとその場で無敵お昼寝 (お昼寝ベッド): 秒数・1秒あたり回復量 */
  sleepSec?: number;
  sleepHeal?: number;
  /** 味方全員回復 (サポーター): 回復量と範囲 */
  allyHeal?: number;
  allyRadius?: number;
  /** ステラQ: 体の周り360度に星を出し、近くの敵へホーミングさせる */
  starRing?: boolean;
  /** ステラE/R: 演出コンボ (ステラッシュ=背後→前→背後の斬り / ステライド=十角形ダッシュ斎) */
  comboKind?: 'stellarush' | 'stellaride';
  ult?: boolean;
}

export interface CharStats {
  hp: number;
  mana: number;
  atk: number;
  atkSpeed: number;   // attacks per second
  range: number;
  speed: number;      // units/sec
  armor: number;
  hpRegen: number;    // HP/sec base
  manaRegen: number;
}

export interface CharColors {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  hair: string;
  eye: string;
  aura: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  role: Role;
  element: Element;
  desc: string;
  difficulty: 1 | 2 | 3;
  colors: CharColors;
  stats: CharStats;
  attack: {
    type: 'melee' | 'ranged';
    shape: ProjShape;
    color: string;
    glow: GlowType;
  };
  weapon: WeaponType;
  bodyType: 'slim' | 'normal' | 'heavy';
  hat: 'none' | 'spiky' | 'ponytail' | 'witch' | 'helm' | 'hood' | 'crown' | 'ninja' | 'twin' | 'band' | 'wings' | 'fin' | 'frill' | 'halo';
  cape: boolean;
  skills: [SkillDef, SkillDef, SkillDef]; // Q, E, R
  voice: string;  // キャッチコピー
}

/** ショップアイテム */
export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
  stats: Partial<{ atk: number; hp: number; armor: number; speed: number; hpRegen: number; atkSpeed: number; mana: number }>;
}

// ============================================================
// マップ
// ============================================================

export type MapId = 'resort' | 'battlefield' | 'station' | 'mine';

export interface BushDef { x: number; z: number; rx: number; rz: number }
export interface DecorDef {
  kind:
    | 'palm' | 'umbrella' | 'float' | 'coral' | 'torch' | 'rock' | 'rubble' | 'banner' | 'campfire' | 'crystal' | 'tower-ruin' | 'pillar' | 'lantern' | 'beachball' | 'sign'
    | 'shard' | 'crab' | 'surf'
    | 'platform' | 'crossgate' | 'signal' | 'bench' | 'billboard'
    | 'pitprop' | 'cart' | 'orevein';
  x: number; z: number; s?: number; r?: number;
}
/** 壁 (軸平行矩形・x,z が中心) */
export interface WallDef {
  x: number; z: number;
  w: number; d: number;
  h?: number;
}
export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  desc: string;
  main?: boolean;
  groundColor: number;
  groundAccent: number;
  laneColor: number;
  fogColor: number;
  fogDensity: number;
  skyTop: number;
  skyBottom: number;
  skyHorizon: number;
  sunColor: number;
  ambientColor: number;
  ambientIntensity: number;
  sunDir: [number, number, number];
  particle: 'petal' | 'ember' | 'spark' | 'none';
  particleColor: number;
  particleCount: number;
  bushes: BushDef[];
  decor: DecorDef[];
  water?: { y: number; color: number; size: [number, number] };
  river?: { color: number };
  /** 壁 (障害物・移動と弾を遮る) */
  walls?: WallDef[];
  /** マップ固有ギミック (電車/大波/オーブ/廃坑) - エンジンが id で分岐 */
  gimmick?: 'trains' | 'wave' | 'orbs' | 'mine';
  /** 廃坑マップ: 奈落の上に架かる足場 (円形の岩棚) - ここ以外は落下 */
  platforms?: { x: number; z: number; r: number }[];
  /** 廃坑マップ: 足場をつなぐ細い通路 (線分 + 幅) */
  walkways?: { x1: number; z1: number; x2: number; z2: number; w: number }[];
  accentLights: { x: number; z: number; color: number; intensity: number; dist: number }[];
}

// ============================================================
// 保存データ
// ============================================================

export type ActionKey =
  | 'up' | 'down' | 'left' | 'right'
  | 'attack' | 'guard' | 'skill1' | 'skill2' | 'ult'
  | 'menu' | 'status' | 'shop' | 'ping';

export type GraphicsTier = 'low' | 'medium' | 'high' | 'ultra' | 'ultimate';

export interface Settings {
  graphics: GraphicsTier;
  keybinds: Record<ActionKey, string>;
  bgm: number;      // 0-100
  se: number;
  cameraShake: boolean;
  announcements: boolean;
  showFps: boolean;
  /** 軽量化設定 */
  perf: {
    lightMode: boolean;   // 影・ブルームOFF etc
    fpsCap: 0 | 30 | 60;  // 0=無制限
    effectScale: number;  // エフェクト量 0.3-1
  };
  mobile: {
    enabled: boolean;
    autoDetect: boolean;
    buttonSize: number;   // 0.8 - 1.4
    opacity: number;      // 0.3 - 1
    preventCopy: boolean; // 長押しコピー対策
    haptics: boolean;
  };
}

export interface MatchStats {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  towers: number;
  duration: number;
  charId: string;
  mapId: MapId;
  win: boolean;
  mode: 'bot' | 'online';
}

export interface BattlePassState {
  tier: number;
  exp: number;
  premium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
}

export interface TrophyState {
  unlocked: string[];
  newUnlock: string[]; // 未表示の実績
}

export interface LoginBonusState {
  lastClaimDate: string; // YYYY-MM-DD
  streak: number;
  dayIndex: number;      // 0-6 cycle
  available: boolean;
}

export interface ProfileStats {
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  towers: number;
  matches: number;
  bestSpree: number;
}

export interface SaveData {
  version: number;
  playerName: string;
  playerLevel: number;
  playerExp: number;
  coins: number;
  settings: Settings;
  battlePass: BattlePassState;
  trophies: TrophyState;
  login: LoginBonusState;
  stats: ProfileStats;
  ownedSkins: string[];
  selectedSkin: Record<string, string>;
  dailyMissionProgress: { date: string; kills: number; wins: number; matches: number; towers: number; cs?: number };
  lastMap: MapId;
  lastChar: string;
  /** パーティメンバー (メイン画面で招待・最大2人) */
  party: { name: string; charId: string }[];
}

// ============================================================
// バトル内部
// ============================================================

export type Team = 'blue' | 'red';

export interface HudSkill {
  slot: string;
  name: string;
  cd: number;
  cdMax: number;
  ready: boolean;
  manaCost: number;
}

export interface HudSnapshot {
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  shield: number;
  level: number; xp: number; xpNeed: number;
  gold: number;
  atk: number; armor: number; speed: number; atkSpeed: number;
  hpRegen: number;
  kda: { k: number; d: number; a: number };
  cs: number;
  skills: HudSkill[];
  /** スキルのスタック数 (パルの召喚チャージ等。通常は0) */
  stacks: number[];
  /** 視野ズーム (0=一人称 〜 1=最大視野) */
  zoom: number;
  respawnIn: number;
  /** 開戦までの残り秒 (集合フェーズ中のみ >0) */
  startIn: number;
  /** 自陣ファウンテン内 (1秒に100回復中) */
  inFountain: boolean;
  /** 死亡観戦中: 現在追っている味方の名前 (生存時は null) */
  spectateName: string | null;
  teamScore: { blue: number; red: number };
  time: number;
  items: string[];
  buffs: { name: string; t: number }[];
  hidden: boolean;       // 草むら内
  fps: number;
  /** フリル=怒り / ステラ=負荷 ゲージ (0-100。他キャラは0) */
  anger: number;
  /** ゲージの表示名 (フリル=「怒り」/ ステラ=「負荷」) */
  angerLabel: string;
  /** 気絶残り秒 (0なら通常) */
  stunned: number;
  /** ひより残り秒 (0なら通常) */
  cowered: number;
  /** 危険警告 (電車接近/大波接近など。nullなら非表示) */
  warn: string | null;
  teams: {
    blue: { name: string; charId: string; k: number; d: number; a: number; level: number; gold: number; isPlayer: boolean }[];
    red: { name: string; charId: string; k: number; d: number; a: number; level: number; gold: number; isPlayer: boolean }[];
  };
  structures: {
    blue: { id: string; type: string; hpPct: number }[];
    red: { id: string; type: string; hpPct: number }[];
  };
  nexusHp: { blue: number; red: number; blueMax: number; redMax: number };
}

export interface MiniDot {
  x: number; z: number;
  team?: Team;
  kind: 'champ' | 'minion' | 'tower' | 'nexus' | 'neutral';
  visible: boolean;
  isPlayer?: boolean;
  hidden?: boolean;
}

export interface BattleResultData {
  win: boolean;
  stats: MatchStats;
  rewards: {
    playerExp: number;
    coins: number;
    bpExp: number;
    trophiesUnlocked: string[];
  };
}

export type GameEvent =
  | { type: 'killfeed'; killer: string; victim: string; killerTeam: Team; victimTeam: Team; streak?: number; firstBlood?: boolean }
  | { type: 'ping'; text: string; team: Team; from: string }
  | { type: 'announce'; text: string; sub?: string; color?: string }
  | { type: 'dmg'; x: number; y: number; z: number; amount: number; crit?: boolean; heal?: boolean }
  | { type: 'end'; result: BattleResultData }
  | { type: 'levelup'; level: number }
  | { type: 'gold'; amount: number };
