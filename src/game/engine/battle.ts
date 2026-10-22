// ============================================================
// AETHER LEAGUE - バトルエンジン
// LoL風ルール: レーン・ミニオン・タワー・ネクサス・草むら・自然回復
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import type {
  ActionKey, CharacterDef, GlowType, GraphicsTier, HudSnapshot, MapId,
  MiniDot, ProjShape, ShopItem, Team,
} from '../types';
import { getChar, SHOP_ITEMS } from '../characters';
import { getMap, lanePoint, laneTangent, MAP_HALF, NEXUS_POS, railPoint, RAIL_LEN, distToRail, riverPoint, LANE_SAMPLES, MINE_NEUTRAL_SPOTS, type LaneId } from '../maps';
import { buildCharacter, buildBed, buildDog, animateRig, type CharacterRig } from './models';
import { buildWorld, buildSky, buildTowerMesh, buildNexusMesh, makeGlowSprite, type WorldRefs } from './world';
import { makeProjectileMesh, ParticleSystem, RingFxPool, BeamPool } from './vfx';
import type { NetAdapter, NetEvent, NetPeer, NetWorld } from '../net/online';

const TEAM_COLOR: Record<Team, number> = { blue: 0x3a8aff, red: 0xff4a5c };
/** 廃坑: 奈落への落下深度 (演出用。9m落ちて暗闇に飲まれる) */
const FALL_DEPTH = 9;
const TEAM_HEX: Record<Team, string> = { blue: '#3a8aff', red: '#ff4a5c' };

export interface BattleOptions {
  canvas: HTMLCanvasElement;
  plateCanvas?: HTMLCanvasElement | null;  // 頭上HPバーオーバーレイ
  mapId: MapId;
  playerCharId: string;
  graphics: GraphicsTier;
  keybinds: Record<ActionKey, string>;
  allyCharIds: string[];
  allyNames?: (string | undefined)[];   // パーティメンバーの表示名 (Bot 試合)
  enemyCharIds: string[];
  playerName: string;
  mode: 'bot' | 'online';
  side?: Team;
  net?: NetAdapter | null;
  /** オンライン: 自分以外の参加者 (人間 + bot)。bot は authority のみ AI 実行 */
  netPeers?: NetPeer[];
  /** オンライン: 自分の pid */
  myPid?: string;
  cameraShake: boolean;
  autoAttack?: boolean;   // スマホ: 自動通常攻撃
  /** 軽量化設定 (軽量モード / FPS制限 / エフェクト量) */
  perf?: { lightMode: boolean; fpsCap: number; effectScale: number };
  onHud?: (h: HudSnapshot) => void;
  onEvent?: (e: { type: string; [k: string]: unknown }) => void;
  onEnd?: () => void;
  onPauseRequest?: () => void;
  onShopRequest?: () => void;
  /** 指令ホイールを開く要求 (PC: T キー) */
  onPingRequest?: () => void;
  getResult?: () => void;
}

interface Buff { speedPct: number; atkPct: number; armorPct: number; until: number; name: string }

interface Champion {
  id: string;
  def: CharacterDef;
  team: Team;
  isPlayer: boolean;
  isRemote: boolean;   // オンライン対戦相手/bot (受信同期)
  /** オンライン参加者の pid (bot は bot1..6) */
  ownerPid?: string;
  name: string;
  pos: THREE.Vector2;
  facing: number;
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  shield: number;
  atk: number; armor: number; speed: number;
  atkSpeed: number; range: number;
  hpRegen: number;
  level: number; xp: number; xpNeed: number;
  gold: number;
  cs: number;
  kills: number; deaths: number; assists: number;
  spree: number;
  cooldowns: [number, number, number];
  attackCd: number;
  anim: string; animT: number;
  buffs: Buff[];
  slowPct: number; slowUntil: number;
  dead: boolean; respawnAt: number;
  lastCombat: number;
  dashing: { dx: number; dz: number; remain: number; dmg: number } | null;
  guardHeld: boolean;
  rig: CharacterRig;
  aiTimer: number;
  aiRetreat: boolean;
  aiLane: LaneId;
  spawnIdx: number;
  inFountain: boolean;
  /** 草むら内でも一時的に可視になる時刻 (攻撃/被弾で公開) */
  revealUntil: number;
  /** Bot AI スキャン抑制用 */
  aiScanUntil: number;
  aiGoalX: number;
  aiGoalZ: number;
  aiBuyAt: number;
  items: ShopItem[];
  lastDamagers: { id: string; t: number }[];
  /** 気絶中 (この時刻まで行動不可) */
  stunnedUntil: number;
  /** ひより中 (びっくりして震えて動けない。この時刻まで行動不可) */
  coweredUntil: number;
  /** フリル: 怒りゲージ (0-100, 被ダメで増加) */
  anger: number;
  /** フリル: 怒り爆発のチャージ中 (この時刻までふるえながらためる) */
  rageChargeUntil: number;
  rageCharging: boolean;
  /** お昼寝: 無敵睡眠中 */
  sleepUntil: number;
  sleepHeal: number;
  /** お昼寝ベッド参照 (睡眠中はベッドの上に立つ) */
  bedRef: Bed | null;
  /** モデルの Y オフセット (ベッドの上に乗る時など) */
  rootY: number;
  /** 表示用のスムーズな向き (WASD方向転換のガクつき防止) */
  dispYaw: number;
  /** 奈落落下中 (この時刻まで沈む演出) */
  fallingUntil: number;
  /** パル: 召喚チャージ (0-3) と充填タイマー */
  charges: number;
  chargeTimer: number;
  /** 最後に攻撃したターゲット (猟犬が連携攻撃する相手) */
  lastTargetId: string | null;
  lastTargetAt: number;
  /** ステラ: 演出コンボ進行中 (ステラッシュ/ステライド。移動・攻撃・スキルは禁止) */
  combo: { kind: 'stellarush' | 'stellaride'; targetId: string; phase: number; nextAt: number } | null;
  /** ステラE被弾: 白黒演出が残っている時刻 (グレースケール表示) */
  monoUntil: number;
}

/** 召喚ユニット (パルの猟犬シャドウ) */
export interface Pet {
  id: string; team: Team; ownerId: string;
  pos: THREE.Vector2; facing: number;
  hp: number; maxHp: number; atk: number;
  atkCd: number; atkRange: number;
  targetId: string | null;
  animT: number;
  dead: boolean;
  mesh: THREE.Group;
}

/** 死亡時の天使 (昇天しながらフェードアウト) */
interface Angel {
  x: number; z: number; born: number;
  mesh: THREE.Group;
}

interface Minion {
  id: string; team: Team; kind: 'melee' | 'ranged';
  pos: THREE.Vector2; hp: number; maxHp: number; atk: number;
  atkRange: number; atkCd: number; atkSpeed: number;
  lane: LaneId;
  pathT: number; lateral: number;
  targetId: string | null;
  anim: string; animT: number;
  dead: boolean;
  /** 死亡時刻 (死体は5秒後に昇天フェード) */
  deadAt: number;
  halo?: THREE.Mesh;
  mesh: THREE.Group;
}

interface Structure {
  id: string; team: Team; type: 'tower' | 'nexus';
  pos: THREE.Vector2;
  hp: number; maxHp: number;
  atkCd: number;
  dead: boolean;
  mesh: THREE.Group;
  gemMat?: THREE.MeshStandardMaterial;
  rangeRing?: THREE.Mesh;
}

interface Neutral {
  id: string; pos: THREE.Vector2;
  hp: number; maxHp: number; atkCd: number;
  dead: boolean; respawnAt: number;
  mesh: THREE.Group;
}

interface Projectile {
  id: string; team: Team; ownerId: string;
  pos: THREE.Vector3;
  dir: THREE.Vector2;
  speed: number;
  dmg: number;
  shape: ProjShape; color: string; glow: GlowType;
  aoe: number;
  slowPct: number; slowDur: number;
  stunDur: number;
  cowerDur: number;
  homingId: string | null;
  isSkill: boolean;
  visualOnly: boolean;
  life: number;
  mesh: THREE.Group;
}

/** フリルのお昼寝ベッド (10秒間残り、そっと触れた敵を気絶させる) */
interface Bed {
  x: number; z: number; rot: number;
  until: number;
  born: number;
  team: Team;
  owner: string;
  hitIds: string[];
  mesh: THREE.Group;
}

const dist2 = (a: THREE.Vector2, b: THREE.Vector2) => a.distanceTo(b);
const distXZ = (v3: THREE.Vector3, v2: THREE.Vector2) => Math.hypot(v3.x - v2.x, v3.z - v2.y);

export class Battle {
  private o: BattleOptions;
  private renderer!: THREE.WebGLRenderer;
  /** シャドウパス隔フレーム更新用カウンタ (軽量化) */
  private shadowTick = 0;
  /** 頭上バー30Hz更新用カウンタ (軽量化) */
  private plateTick = 0;
  /** 毎フレームの一時ベクトル (GC削減・共有) */
  private static tmpPlateV3 = new THREE.Vector3();
  private tmpV3a = new THREE.Vector3();
  private tmpV3b = new THREE.Vector3();
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private world!: WorldRefs;
  private skyMat!: THREE.ShaderMaterial;
  private sun!: THREE.DirectionalLight;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private mapDef = getMap('battlefield');
  private gfx: GraphicsTier = 'medium';

  // エンティティ
  champs: Champion[] = [];
  player!: Champion;
  minions: Minion[] = [];
  structures: Structure[] = [];
  neutrals: Neutral[] = [];
  projectiles: Projectile[] = [];
  pets: Pet[] = [];
  private angels: Angel[] = [];
  private bushes: { x: number; z: number; rx: number; rz: number }[] = [];
  private particles!: ParticleSystem;
  private rings!: RingFxPool;
  private beams!: BeamPool;

  // 状態
  time = 0;
  paused = false;
  ended = false;
  private nextWaveAt = 8;
  private waveNum = 0;
  /** 開戦までの集合フェーズ (全員ファウンテンからスタート) */
  private startHoldAt = 8;
  private startAnnounced = false;
  private fountainFx: { disc: THREE.Mesh; ring: THREE.Mesh; light: THREE.PointLight; base: THREE.Vector2 }[] = [];
  private teamKills: Record<Team, number> = { blue: 0, red: 0 };
  private firstBlood = false;
  private projSeq = 0;
  private shake = 0;
  private statusHold = false;
  private menuPressed = false;
  // ---- マップギミック (電車 / 大波 / エーテルオーブ / お昼寝ベッド) ----
  private beds: Bed[] = [];
  private train: { t: number; dir: 1 | -1; mesh: THREE.Group } | null = null;
  private trainSpawnAt = 24;
  private trainDir: 1 | -1 = 1;
  private trainWarned = false;
  private trainAnnounced = false;
  private wave: { t: number; mesh: THREE.Mesh; hitIds: string[] } | null = null;
  private nextWaveSpawnAt = 18;
  private waveWarned = false;
  private waveAnnounced = false;
  private orbs: { x: number; z: number; mesh: THREE.Group; active: boolean; respawnAt: number }[] = [];
  private nextOrbAt = 25;
  private orbAnnounced = false;
  /** HUD 表示中の危険警告 */
  private warnText: string | null = null;
  fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private hudAcc = 0;
  private keys = new Set<string>();
  private touch = { mx: 0, mz: 0, attack: false, guard: false };
  /** 視野ズーム: 1=最大視野 (デフォルト) 〜 0=一人称視点 */
  zoom = 1;
  /** 一人称視点の視線 (ヨー/ピッチ)。通常時はキャラの向きに追従 */
  viewYaw = 0;
  viewPitch = 0;
  /** スマホのドラッグ見回し中フラグ (この時刻まで手動視線を優先) */
  private lookTouchUntil = 0;
  /** マウス移動量の感度 */
  private static LOOK_SENS_X = 0.0026;
  private static LOOK_SENS_Y = 0.0022;
  /** 基地 (自ネクサス) 危険警告済みフラグ */
  private baseWarned = false;
  private petSeq = 0;
  private mapCanvasW = 0;
  private plates: HTMLCanvasElement | null = null;
  private plateCtx: CanvasRenderingContext2D | null = null;
  authority = true;

  // 壁 (障害物) / スペクテイター / 一時ベクトル
  private wallRects: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private spectateChamp: Champion | null = null;
  private spectateUntil = 0;
  private lastHitSfx = 0;
  private _proj3 = new THREE.Vector3();

  // ネット
  private net: NetAdapter | null = null;
  private remoteChamps: Map<string, Champion> = new Map();
  private netAcc = 0;
  private pendingNetEvents: NetEvent[] = [];
  private netProjectiles: Map<string, THREE.Group> = new Map();
  private resultStats = {
    kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0, towers: 0,
  };

  constructor(opts: BattleOptions) {
    this.o = opts;
    this.gfx = opts.graphics;
    this.mapDef = getMap(opts.mapId);
    this.initRenderer();
    this.initScene();
    this.initEntities();
    this.bindInput();
    if (opts.net) {
      this.net = opts.net;
      this.authority = opts.net.isAuthority;
      this.setupNet();
    }
    // デバッグ用アクセス (テスト/検証用)
    if (typeof window !== 'undefined') {
      (window as unknown as { __alBattle?: Battle }).__alBattle = this;
    }
    if (opts.plateCanvas) {
      this.plates = opts.plateCanvas;
      this.plateCtx = this.plates.getContext('2d');
    }
  }

  // ==========================================================
  // 初期化
  // ==========================================================

  private initRenderer() {
    const { canvas } = this.o;
    const light = !!this.o.perf?.lightMode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.gfx !== 'low' && !light, powerPreference: 'high-performance' });
    const dpr = window.devicePixelRatio || 1;
    const cap = this.gfx === 'low' ? 0.85 : light ? 0.85 : this.gfx === 'medium' ? 1 : this.gfx === 'high' ? 1.5 : this.gfx === 'ultimate' ? 2 : 1.75;
    this.renderer.setPixelRatio(Math.min(dpr, cap));
    this.renderer.shadowMap.enabled = this.gfx !== 'low' && !light;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 軽量化: シャドウマップは render() 側で隔フレーム手動更新 (needsUpdate)
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.gfx === 'ultimate' ? 1.16 : this.gfx === 'ultra' ? 1.14 : this.gfx === 'high' ? 1.1 : 1.06;
  }

  private initScene() {
    const def = this.mapDef;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity * (this.gfx === 'low' ? 0.5 : 1));

    const sky = buildSky(def);
    scene.add(sky.mesh);
    this.skyMat = sky.mat;

    // カメラ
    this.camera = new THREE.PerspectiveCamera(47, 1, 0.5, 500);
    this.resize();

    // ライト (朝日のシーン)
    const amb = new THREE.AmbientLight(def.ambientColor, def.ambientIntensity);
    scene.add(amb);
    const hemiGround = new THREE.Color(def.groundColor).lerp(new THREE.Color(0xd8b070), 0.35);
    const hemi = new THREE.HemisphereLight(def.skyBottom, hemiGround, this.gfx === 'low' ? 0.5 : 0.7);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(def.sunColor, this.gfx === 'low' ? 1.6 : this.gfx === 'medium' ? 2.4 : this.gfx === 'high' ? 2.8 : 3.0);
    sun.position.set(def.sunDir[0], def.sunDir[1], def.sunDir[2]);
    if (this.gfx !== 'low' && !this.o.perf?.lightMode) {
      sun.castShadow = true;
      const res = this.gfx === 'medium' ? 1024 : this.gfx === 'high' ? 2048 : 4096;
      sun.shadow.mapSize.set(res, res);
      const c = sun.shadow.camera;
      c.left = -75; c.right = 75; c.top = 75; c.bottom = -75; c.far = 200;
      sun.shadow.bias = -0.0004;
    }
    scene.add(sun);
    this.sun = sun;

    // アクセントライト
    const maxLights = this.gfx === 'low' ? 2 : this.gfx === 'medium' ? 3 : 99;
    def.accentLights.slice(0, maxLights).forEach((l) => {
      const pl = new THREE.PointLight(l.color, this.gfx === 'ultimate' ? l.intensity : l.intensity * 0.7, l.dist);
      pl.position.set(l.x, 3.2, l.z);
      scene.add(pl);
    });

    // ワールド
    this.world = buildWorld(def, this.gfx, this.o.perf?.lightMode);
    scene.add(this.world.group);
    this.bushes = def.bushes;

    // VFX (軽量化設定でエフェクト量を調整)
    const fxScale = this.o.perf?.effectScale ?? 1;
    const pCount = this.gfx === 'ultimate' ? 4200 : this.gfx === 'low' ? 800 : 2000;
    this.particles = new ParticleSystem(Math.max(400, Math.round(pCount * Math.min(1, fxScale))));
    scene.add(this.particles.points);
    this.rings = new RingFxPool(scene);
    this.beams = new BeamPool(scene, 16);

    // ポストプロセス (ブルーム発光) - 軽量モードでは省略
    if (this.gfx !== 'low' && !this.o.perf?.lightMode) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(scene, this.camera));
      const strength = this.gfx === 'medium' ? 0.5 : this.gfx === 'high' ? 0.65 : this.gfx === 'ultimate' ? 0.85 : 0.75;
      const threshold = this.gfx === 'ultimate' ? 0.88 : 0.72;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), strength, this.gfx === 'ultimate' ? 0.55 : 0.5, threshold);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
  }

  /** ネクサスからマップ中央へ向かう単位ベクトル (スポーン方向) */
  private spawnDir(team: Team): THREE.Vector2 {
    const n = NEXUS_POS[team];
    const v = new THREE.Vector2(-n.x, -n.z).normalize();
    return v;
  }

  /** ファウンテン (自陣スタート地点) の位置: ネクサスの中央側に設けられた回復ゾーン */
  private fountainCenter(team: Team): THREE.Vector2 {
    const n = NEXUS_POS[team];
    return new THREE.Vector2(n.x, n.z).add(this.spawnDir(team).clone().multiplyScalar(4.6));
  }

  /** チーム全員が同じ場所 (ファウンテン) に集合するコンパクトなフォーメーション */
  private fountainPos(team: Team, idx: number): THREE.Vector2 {
    const dir = this.spawnDir(team);
    const right = new THREE.Vector2(-dir.y, dir.x);
    const FORM: [number, number][] = [[0, 0], [-2.1, 1.3], [2.1, 1.3], [0.9, -1.9]];
    const [fx, fz] = FORM[idx % FORM.length];
    return this.fountainCenter(team)
      .clone()
      .add(right.multiplyScalar(fx))
      .add(dir.multiplyScalar(fz));
  }

  private makeChampion(charId: string, team: Team, isPlayer: boolean, isRemote: boolean, name: string): Champion {
    const def = getChar(charId);
    const rig = buildCharacter(def, isPlayer ? this.playerSkin : undefined);
    this.scene.add(rig.root);
    const base = def.stats;
    const c: Champion = {
      id: isPlayer ? 'me' : `${team[0]}_${charId}_${Math.random().toString(36).slice(2, 6)}`,
      def, team, isPlayer, isRemote, name,
      pos: new THREE.Vector2(0, 0),
      facing: 0,
      hp: base.hp, maxHp: base.hp,
      mana: base.mana, maxMana: base.mana,
      shield: 0,
      atk: base.atk, armor: base.armor, speed: base.speed,
      atkSpeed: base.atkSpeed, range: base.range,
      hpRegen: base.hpRegen,
      level: 1, xp: 0, xpNeed: 180 + 90,
      gold: 500, cs: 0, kills: 0, deaths: 0, assists: 0, spree: 0,
      cooldowns: [0, 0, 0],
      attackCd: 0,
      anim: 'idle', animT: 0,
      buffs: [],
      slowPct: 0, slowUntil: 0,
      dead: false, respawnAt: 0,
      lastCombat: -99,
      dashing: null,
      guardHeld: false,
      rig,
      spawnIdx: 0,
      inFountain: true,
      revealUntil: 0,
      aiScanUntil: 0, aiGoalX: 0, aiGoalZ: 0, aiBuyAt: 0,
      aiTimer: 0, aiRetreat: false,
      aiLane: (['mid', 'top', 'bot'] as LaneId[])[this.champs.filter((x) => x.team === team).length % 3],
      items: [],
      lastDamagers: [],
      stunnedUntil: 0,
      coweredUntil: 0,
      anger: 0,
      rageChargeUntil: 0,
      rageCharging: false,
      sleepUntil: 0,
      sleepHeal: 0,
      bedRef: null,
      rootY: 0,
      dispYaw: 0,
      fallingUntil: 0,
      charges: 0,
      chargeTimer: 0,
      lastTargetId: null,
      lastTargetAt: -99,
      combo: null,
      monoUntil: 0,
    };
    // 出現位置: チーム全員が同じ場所 (ファウンテン) に集合してスタート
    c.spawnIdx = this.champs.filter((x) => x.team === team).length;
    c.pos.copy(this.fountainPos(team, c.spawnIdx));
    const enemyN = NEXUS_POS[team === 'blue' ? 'red' : 'blue'];
    c.facing = Math.atan2(enemyN.x - c.pos.x, enemyN.z - c.pos.y);
    c.dispYaw = c.facing;
    rig.root.position.set(c.pos.x, 0, c.pos.y);
    rig.root.rotation.y = c.facing;
    this.champs.push(c);
    return c;
  }

  private playerSkin: string | undefined;

  /** ボット用のランダム名前プール (HPバーの上に表示) */
  private static BOT_NAMES = ['アレス', 'ノヴァ', 'カイエン', 'ミラ', 'ゼン', 'リオナ', 'クロエ', 'ガイ', 'シズク', 'ハヤト', 'ユキ', 'レイジ'];
  private botNamePool: string[] = [];
  private takeBotName(): string {
    if (this.botNamePool.length === 0) {
      this.botNamePool = [...Battle.BOT_NAMES];
      for (let i = this.botNamePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.botNamePool[i], this.botNamePool[j]] = [this.botNamePool[j], this.botNamePool[i]];
      }
    }
    return this.botNamePool.pop() ?? 'ボット';
  }

  private initEntities() {
    const def = this.mapDef;
    // 構造物
    const mkStruct = (team: Team, type: 'tower' | 'nexus', lane: LaneId | null, t: number): Structure => {
      const p = type === 'nexus' ? NEXUS_POS[team] : lanePoint(t, lane ?? 'mid');
      const mesh = type === 'tower' ? buildTowerMesh(team) : buildNexusMesh(team);
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);
      const hp = type === 'nexus' ? 3200 : 2100;
      let gemMat: THREE.MeshStandardMaterial | undefined;
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshStandardMaterial;
          if (m.emissive && m.emissiveIntensity >= 2) gemMat = m;
        }
      });
      const s: Structure = {
        id: `${team[0]}t_${type === 'nexus' ? 'n' : this.structures.length}`,
        team, type,
        pos: new THREE.Vector2(p.x, p.z),
        hp, maxHp: hp, atkCd: 0, dead: false, mesh, gemMat,
      };
      this.structures.push(s);
      return s;
    };
    // ネクサス + 各レーン2タワー (計6タワー/チーム)
    mkStruct('blue', 'nexus', null, 0);
    mkStruct('red', 'nexus', null, 0);
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      mkStruct('blue', 'tower', lane, 0.17);
      mkStruct('blue', 'tower', lane, 0.35);
      mkStruct('red', 'tower', lane, 0.65);
      mkStruct('red', 'tower', lane, 0.83);
    }

    // チャンピオン
    if (this.o.mode === 'bot') {
      this.player = this.makeChampion(this.o.playerCharId, 'blue', true, false, this.o.playerName);
      this.o.allyCharIds.forEach((id, i) => {
        const nm = this.o.allyNames?.[i];
        const bot = this.makeChampion(id, 'blue', false, false, nm || this.takeBotName());
        bot.isPlayer = false;
      });
      for (const id of this.o.enemyCharIds) {
        this.makeChampion(id, 'red', false, false, this.takeBotName());
      }
    } else {
      const myTeam: Team = this.o.side ?? 'blue';
      this.player = this.makeChampion(this.o.playerCharId, myTeam, true, false, this.o.playerName);
      // オンライン参加者 (人間 + bot) を配置。bot は authority のみローカルAI (それ以外は受信同期)
      for (const peer of this.o.netPeers ?? []) {
        const botByAuthority = !!peer.isBot && this.authority;
        const rc = this.makeChampion(peer.charId, peer.side, false, !botByAuthority, peer.name || (peer.isBot ? this.takeBotName() : '対戦相手'));
        rc.ownerPid = peer.pid;
        if (!botByAuthority) this.remoteChamps.set(peer.pid, rc);
      }
    }

    // 敵タワーの攻撃範囲リング (赤い薄い円・破壊で消える)
    const myTeamRing: Team = this.o.mode === 'bot' ? 'blue' : (this.o.side ?? 'blue');
    const ringGeo = new THREE.TorusGeometry(13, 0.07, 6, 84);
    for (const s of this.structures) {
      if (s.type !== 'tower' || s.team === myTeamRing) continue;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xff4050, transparent: true, opacity: 0.3, depthWrite: false,
      }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s.pos.x, 0.16, s.pos.y);
      this.scene.add(ring);
      s.rangeRing = ring;
    }

    // ファウンテン (自陣スタート地点): 全員がここからスタートし、戻ると1秒に100回復するゾーン
    const teamHex: Record<Team, number> = { blue: 0x38b6ff, red: 0xff4d6d };
    for (const team of ['blue', 'red'] as Team[]) {
      const fc = this.fountainCenter(team);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(8, 56),
        new THREE.MeshBasicMaterial({
          color: teamHex[team], transparent: true, opacity: 0.13,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(fc.x, 0.06, fc.y);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(7.1, 8.1, 56),
        new THREE.MeshBasicMaterial({
          color: teamHex[team], transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(fc.x, 0.09, fc.y);
      const cross = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 2.7, 40),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(fc.x, 0.08, fc.y);
      const light = new THREE.PointLight(teamHex[team], 14, 18, 1.6);
      light.position.set(fc.x, 2.2, fc.y);
      this.scene.add(disc, ring, cross, light);
      this.fountainFx.push({ disc, ring, light, base: fc });
    }

    // 壁 (衝突判定用の矩形リスト)
    this.wallRects = (def.walls ?? []).map((w) => ({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
    }));

    // ニュートラル (エーテルゴーレム x2: 両ジャングルの川沿い/足場)
    const spots = this.mapDef.id === 'mine'
      ? MINE_NEUTRAL_SPOTS
      : [{ x: -30, z: -14 }, { x: 30, z: 16 }];
    spots.forEach((sp, i) => {
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.3, 0),
        new THREE.MeshStandardMaterial({ color: 0x4a3c6a, roughness: 0.6, metalness: 0.3, emissive: 0x7a5cff, emissiveIntensity: 0.8 })
      );
      body.position.y = 1.3;
      body.castShadow = true;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb08aff, emissiveIntensity: 3 })
      );
      eye.position.set(0, 1.7, 1.0);
      mesh.add(body, eye);
      mesh.position.set(sp.x, 0, sp.z);
      this.scene.add(mesh);
      this.neutrals.push({
        id: `neutral${i}`, pos: new THREE.Vector2(sp.x, sp.z),
        hp: 1100, maxHp: 1100, atkCd: 0, dead: false, respawnAt: 0, mesh,
      });
    });
  }

  // ==========================================================
  // 入力
  // ==========================================================

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    const kb = this.o.keybinds;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === kb.menu) {
      this.o.onPauseRequest?.();
    }
    if (e.code === kb.shop) {
      this.o.onShopRequest?.();
    }
    if (e.code === kb.ping) {
      this.o.onPingRequest?.();
    }
    if (e.code === kb.skill1) this.tryCast(0);
    if (e.code === kb.skill2) this.tryCast(1);
    if (e.code === kb.ult) this.tryCast(2);
  };

  /** 効果音フック (audio.ts の AudioMgr が受け取る) */
  sfx(name: string) {
    this.o.onEvent?.({ type: 'sfx', name });
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onCtx = (e: Event) => e.preventDefault();

  /** PC: マウスホイールで視野調整 (上=広い / 下=狭い・0で一人称) */
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setZoom(this.zoom + (e.deltaY < 0 ? 0.07 : -0.07));
    // 一人称から抜けたらポインタロックを解除
    if (this.zoom >= 0.6 && document.pointerLockElement === this.o.canvas) {
      document.exitPointerLock?.();
    }
  };

  /** PC: 一人称視点でクリック → マウス視点移動 (ポインタロック) */
  private onCanvasClick = () => {
    if (this.zoom < 0.6 && document.pointerLockElement !== this.o.canvas) {
      const r = this.o.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => {});
    }
  };

  /** PC: ポインタロック中のマウス視点移動 (マインクラフト方式) */
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.o.canvas) return;
    this.viewYaw -= e.movementX * Battle.LOOK_SENS_X;
    this.viewPitch = Math.max(-1.15, Math.min(1.15, this.viewPitch - e.movementY * Battle.LOOK_SENS_Y));
  };

  /** スマホ: 一人称視点のドラッグ見回し (画面をなぞって視点移動) */
  lookDelta(dx: number, dy: number) {
    if (this.zoom >= 0.75) return;
    this.viewYaw -= dx * Battle.LOOK_SENS_X;
    this.viewPitch = Math.max(-1.15, Math.min(1.15, this.viewPitch - dy * Battle.LOOK_SENS_Y * 1.4));
    this.lookTouchUntil = this.time + 1.6;
  }

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.o.canvas.addEventListener('contextmenu', this.onCtx);
    this.o.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.o.canvas.addEventListener('click', this.onCanvasClick);
  }

  /** 視野ズーム設定 (0=一人称 〜 1=最大視野) */
  setZoom(z: number) { this.zoom = Math.max(0, Math.min(1, z)); }
  getZoom() { return this.zoom; }

  /** スマホ操作入力 */
  setTouchInput(t: { mx?: number; mz?: number; attack?: boolean; guard?: boolean }) {
    if (t.mx !== undefined) this.touch.mx = t.mx;
    if (t.mz !== undefined) this.touch.mz = t.mz;
    if (t.attack !== undefined) this.touch.attack = t.attack;
    if (t.guard !== undefined) this.touch.guard = t.guard;
  }
  pressSkillTouch(idx: number) { this.tryCast(idx); }

  /** スマホ: 自動通常攻撃の ON/OFF (HUD の AUTO トグル) */
  setAutoAttack(v: boolean) { this.o.autoAttack = v; }
  getAutoAttack() { return !!this.o.autoAttack; }

  // ==========================================================
  // ライフサイクル
  // ==========================================================

  start() {
    this.clock.start();
    const cap = this.o.perf?.fpsCap ?? 0;
    let acc = 0;
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      // FPS制限 (軽量化): 指定間隔未満は描画をスキップ
      if (cap > 0) {
        acc += dt;
        if (acc < 1 / cap - 0.001) return;
        const step = Math.min(acc, 0.05);
        acc = 0;
        this.tick(step);
      } else {
        this.tick(dt);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private tick(dt: number) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (!this.paused && !this.ended) this.update(dt);
    else if (this.ended) this.updateEndScene(dt);
    this.render(dt);
  }

  pause(v: boolean) { this.paused = v; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.o.canvas.removeEventListener('contextmenu', this.onCtx);
    this.o.canvas.removeEventListener('wheel', this.onWheel);
    this.o.canvas.removeEventListener('click', this.onCanvasClick);
    if (document.pointerLockElement === this.o.canvas) document.exitPointerLock?.();
    this.world.dispose();
    this.particles.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose?.();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose?.();
      }
    });
    this.renderer.dispose();
  }

  resize() {
    const w = this.o.canvas.clientWidth || window.innerWidth;
    const h = this.o.canvas.clientHeight || window.innerHeight;
    this.mapCanvasW = w;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    // 頭上HPバーキャンバス同期
    if (this.plates && this.plateCtx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.plates.width = Math.round(w * dpr);
      this.plates.height = Math.round(h * dpr);
      this.plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** 頭上HPバー用オーバーレイキャンバスを後からアタッチ */
  attachPlates(cv: HTMLCanvasElement | null) {
    this.plates = cv;
    this.plateCtx = cv ? cv.getContext('2d') : null;
    if (cv) this.resize();
  }

  private render(dt: number) {
    const t = this.time;
    this.skyMat.uniforms.time.value = t;
    for (const fn of this.world.animated) fn(t, dt);
    this.particles.update(dt);
    this.rings.update(dt);
    this.beams.update(dt);
    // ステラ: 白黒演出シェルの追従・消滅
    if (this.monoFx.length > 0) this.updateMonoFx(dt);
    // シャドウパス隔フレーム更新 (軽量化: シャドウ描画コスト半減。30Hz更新は見た目上ほぼ同一)
    this.shadowTick = (this.shadowTick + 1) & 1;
    this.renderer.shadowMap.needsUpdate = this.shadowTick === 0;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    // 頭上バーも30Hzで十分 (フルスクリーン2Dキャンバスの毎フレーム描画を回避)
    this.plateTick = (this.plateTick + 1) & 1;
    if (this.plateTick === 0) this.drawPlates();
  }

  /** 頭上HPバー (チャンピオン/タワー/ネクサス) をオーバーレイcanvasに描画 */
  private drawPlates() {
    const cv = this.plates;
    const ctx = this.plateCtx;
    if (!cv || !ctx) return;
    const w = this.o.canvas.clientWidth || this.mapCanvasW;
    const h = this.o.canvas.clientHeight || window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    // アロケーション回避: 一時ベクトルを使い回す (毎フレームのGC負荷を削減)
    const project = (x: number, y: number, z: number): { x: number; y: number } | null => {
      const v = Battle.tmpPlateV3.set(x, y, z).project(this.camera);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // チャンピオン (自分はHUDがあるので除外)
    for (const c of this.champs) {
      if (c.dead || c.isPlayer) continue;
      if (!this.isVisibleToPlayer(c)) continue;
      const p = project(c.pos.x, 2.6, c.pos.y);
      if (!p || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) continue;
      const bw = 46, bh = 5.5;
      const x = p.x - bw / 2, y = p.y;
      // ---- 名前 (HPバーの上) ----
      const isStella = c.def.id === 'stella';
      const hasAnger = (c.def.id === 'frill' || isStella) && c.anger > 2;
      const nameY = y - (hasAnger ? 12.5 : 7);
      ctx.font = 'bold 8.5px "Noto Sans JP", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(c.name, p.x + 0.8, nameY + 0.8);
      ctx.fillStyle = c.team === this.player.team ? '#bfe8ff' : '#ffd2d8';
      ctx.fillText(c.name, p.x, nameY);
      ctx.fillStyle = 'rgba(4,7,16,0.82)';
      ctx.fillRect(x - 1.5, y - 1.5, bw + 3, bh + 3);
      const hpPct = Math.max(0, Math.min(1, c.hp / c.maxHp));
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = c.team === this.player.team ? '#3ddc84' : '#ff5a6a';
      ctx.fillRect(x, y, bw * hpPct, bh);
      if (c.shield > 0) {
        const sp = Math.min(1, c.shield / c.maxHp);
        ctx.fillStyle = 'rgba(235,242,255,0.9)';
        ctx.fillRect(x + bw * hpPct, y, Math.min(bw * sp, bw - bw * hpPct), bh);
      }
      // レベルチップ
      ctx.fillStyle = 'rgba(4,7,16,0.92)';
      ctx.fillRect(x - 11, y - 3.5, 9.5, bh + 7);
      ctx.fillStyle = '#ffd86a';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText(String(c.level), x - 6.2, y + bh / 2 + 0.5);

      // ---- フリル: 怒りゲージ / ステラ: 負荷ゲージ (頭上・HPバーの上) ----
      if (hasAnger) {
        const uw = bw;
        const uy = y - 6.5;
        ctx.fillStyle = 'rgba(4,7,16,0.85)';
        ctx.fillRect(x - 1.5, uy - 1.5, uw + 3, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x, uy, uw, 3);
        const ang = Math.max(0, Math.min(1, c.anger / 100));
        if (isStella) {
          // 負荷: ゴールド → 満タンで白く明滅
          const flash = ang > 0.85 ? 0.5 + Math.sin(this.time * 12) * 0.5 : 1;
          ctx.fillStyle = `rgba(${Math.round(255 - ang * 10)},${Math.round(235 - ang * 20)},${Math.round(120 + ang * 60)},${flash})`;
          ctx.fillRect(x, uy, uw * ang, 3);
          // 星マーク
          const mx = x + uw * ang, my = uy + 1.5;
          ctx.fillStyle = '#fff8d0';
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const aa = -Math.PI / 2 + (k / 5) * Math.PI * 2;
            const ab = aa + Math.PI / 5;
            ctx.lineTo(mx + Math.cos(aa) * 3.2, my + Math.sin(aa) * 3.2);
            ctx.lineTo(mx + Math.cos(ab) * 1.3, my + Math.sin(ab) * 1.3);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // 怒り: オレンジ → 赤 に遷移、危険域は点滅
          const flash = ang > 0.85 ? 0.5 + Math.sin(this.time * 12) * 0.5 : 1;
          ctx.fillStyle = `rgba(255,${Math.round(205 - ang * 145)},${Math.round(95 - ang * 65)},${flash})`;
          ctx.fillRect(x, uy, uw * ang, 3);
          // 怒りマーク (💢風の4本スパイク)
          const mx = x + uw * ang, my = uy + 1.5;
          ctx.strokeStyle = '#ff5a4a';
          ctx.lineWidth = 1.1;
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(mx + Math.cos(a) * 1.6, my + Math.sin(a) * 1.6);
            ctx.lineTo(mx + Math.cos(a) * 3.4, my + Math.sin(a) * 3.4);
            ctx.stroke();
          }
        }
      }
      // ---- 気絶中: 頭上に回る星 ----
      if (c.stunnedUntil > this.time) {
        const sx = p.x, sy = p.y - (c.def.id === 'frill' && c.anger > 2 ? 14 : 11);
        for (let i = 0; i < 3; i++) {
          const a = this.time * 4 + (i / 3) * Math.PI * 2;
          const ox = Math.cos(a) * 10;
          const oy = Math.sin(a) * 3.2;
          ctx.fillStyle = '#ffe14d';
          ctx.beginPath();
          ctx.arc(sx + ox, sy + oy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // ---- ひより中: 頭上で震えるひよこ ----
      if (c.coweredUntil > this.time) {
        const tremble = Math.sin(this.time * 30) * 1.1;
        const cx = p.x + tremble, cy = p.y - (c.def.id === 'frill' && c.anger > 2 ? 13 : 11);
        // 汗しずく
        ctx.fillStyle = '#bfeaff';
        ctx.beginPath();
        ctx.arc(cx - 4.6, cy - 2.8, 1.15, 0, Math.PI * 2);
        ctx.fill();
        // 体
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.3, 0, Math.PI * 2);
        ctx.fill();
        // くちばし
        ctx.fillStyle = '#ff9a3c';
        ctx.beginPath();
        ctx.moveTo(cx + 2.8, cy - 0.7);
        ctx.lineTo(cx + 5.6, cy + 0.2);
        ctx.lineTo(cx + 2.8, cy + 1.1);
        ctx.closePath();
        ctx.fill();
        // 目 (びっくり丸目)
        ctx.fillStyle = '#231a10';
        ctx.beginPath();
        ctx.arc(cx + 1.1, cy - 1.1, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 召喚獣 (猟犬): 小さめのHPバー
    for (const pt of this.pets) {
      if (pt.dead) continue;
      if (pt.team !== this.player.team && !this.isVisibleToPlayer({ team: pt.team, pos: pt.pos } as Champion)) continue;
      const p = project(pt.pos.x, 1.6, pt.pos.y);
      if (!p || p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
      const bw2 = 30, bh2 = 3.5;
      const x2 = p.x - bw2 / 2, y2 = p.y;
      ctx.fillStyle = 'rgba(4,7,16,0.8)';
      ctx.fillRect(x2 - 1, y2 - 1, bw2 + 2, bh2 + 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x2, y2, bw2, bh2);
      ctx.fillStyle = pt.team === this.player.team ? '#4ff0d0' : '#ff8a6a';
      ctx.fillRect(x2, y2, bw2 * Math.max(0, pt.hp / pt.maxHp), bh2);
    }
    // 構造物 (タワー/ネクサス)
    for (const s of this.structures) {
      if (s.dead) continue;
      const p = project(s.pos.x, s.type === 'nexus' ? 10.6 : 8.8, s.pos.y);
      if (!p || p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
      const bw = 42, bh = 4.5;
      const x = p.x - bw / 2, y = p.y;
      ctx.fillStyle = 'rgba(4,7,16,0.78)';
      ctx.fillRect(x - 1.5, y - 1.5, bw + 3, bh + 3);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = s.team === 'blue' ? '#4aa0ff' : '#ff5a6a';
      ctx.fillRect(x, y, bw * Math.max(0, s.hp / s.maxHp), bh);
    }
  }

  /** ワールド→スクリーン座標 */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * (this.o.canvas.clientWidth || this.mapCanvasW),
      y: (-v.y * 0.5 + 0.5) * (this.o.canvas.clientHeight || window.innerHeight),
    };
  }

  isStatusHeld() { return this.statusHold; }
  getTeamKills() { return { ...this.teamKills }; }

  // ==========================================================
  // 草むら・視界
  // ==========================================================

  private inBush(p: THREE.Vector2): boolean {
    return this.bushes.some((b) => Math.abs(p.x - b.x) <= b.rx && Math.abs(p.y - b.z) <= b.rz);
  }

  /**
   * 同じ草むら内か (ブロスタ風連結草むら対応):
   * 両者が同じ矩形に入っているか、または一方の矩形がもう一方を含む程度に近接 (連結) しているか
   */
  private sameBush(a: THREE.Vector2, b: THREE.Vector2): boolean {
    const BLEED = 3.2;
    for (const bu of this.bushes) {
      const aIn = Math.abs(a.x - bu.x) <= bu.rx && Math.abs(a.y - bu.z) <= bu.rz;
      if (!aIn) continue;
      // 同じ矩形 or この矩形の縁から BLEED 以内の相手 → 連結された同じ草
      const bIn = Math.abs(b.x - bu.x) <= bu.rx + BLEED && Math.abs(b.y - bu.z) <= bu.rz + BLEED;
      if (bIn) return true;
    }
    return false;
  }

  /** プレイヤー視点での敵チャンピオン可視判定 */
  private isVisibleToPlayer(c: Champion): boolean {
    if (c.team === this.player.team) return true;
    // 攻撃/被弾で一時公開された敵は草むら内でも見える
    if (c.revealUntil > this.time) return true;
    if (!this.inBush(c.pos)) return true;
    return this.sameBush(c.pos, this.player.pos);
  }

  private isEnemy(a: { team: Team }, b: { team: Team }) {
    return a.team !== b.team;
  }

  // ==========================================================
  // 気絶 (スタン) / ひより - 電車/踏切/ベッド接触/フリルの技 で使用
  // ==========================================================

  /** 気絶: 行動不能 (移動・攻撃・スキル全て封拉) */
  private applyStun(c: Champion, dur: number) {
    if (c.dead || dur <= 0) return;
    if (c.sleepUntil > this.time) return; // 睡眠(無敵)中は気絶しない
    if (c.stunnedUntil < this.time + dur) c.stunnedUntil = this.time + dur;
    c.dashing = null;
    c.combo = null;
    c.anim = 'idle';
    c.animT = 0;
    this.particles.burst(c.pos.x, 2.4, c.pos.y, '#ffe14d', 8, 2.2, 0.6, 0.4);
    if (c.isPlayer) {
      this.shake = Math.max(this.shake, 0.3);
      this.sfx('stun');
    }
  }

  /** ひより: びっくりして震えて動けなくなる (行動封拉は気絶と同じ・頭上演出はひよこ) */
  private applyCower(c: Champion, dur: number) {
    if (c.dead || dur <= 0) return;
    if (c.sleepUntil > this.time) return;
    if (c.coweredUntil < this.time + dur) c.coweredUntil = this.time + dur;
    c.dashing = null;
    c.combo = null;
    c.anim = 'idle';
    c.animT = 0;
    this.particles.burst(c.pos.x, 2.2, c.pos.y, '#ffe9a0', 8, 2.4, 0.6, 0.4);
    if (c.isPlayer) {
      this.shake = Math.max(this.shake, 0.25);
      this.sfx('cower');
    }
  }

  /** 行動封拉中か (気絶/ひより/怒りチャージ/お昼寝睡眠/ステラコンボ中) */
  private ccLocked(c: Champion): boolean {
    return c.dead || c.stunnedUntil > this.time || c.coweredUntil > this.time
      || c.rageCharging || c.sleepUntil > this.time || c.fallingUntil > this.time || !!c.combo;
  }

  // ==========================================================
  // メイン更新
  // ==========================================================

  private update(dt: number) {
    this.time += dt;

    // 開戦アナウンス (集合フェーズ終了)
    if (!this.startAnnounced && this.time >= this.startHoldAt) {
      this.startAnnounced = true;
      this.o.onEvent?.({ type: 'announce', text: 'バトル開始！', sub: 'ミニオン出撃・全員レーンへ', color: '#7ec8ff' });
      this.sfx('start');
    }

    // 入力 → プレイヤー
    this.updatePlayerControl(dt);

    // ---- 基地 (自ネクサス) が20%を切ったら味方に自動で指令を送る ----
    if (!this.baseWarned) {
      const own = this.structures.find((s) => s.team === this.player.team && s.type === 'nexus');
      if (own && !own.dead && own.hp / own.maxHp <= 0.2) {
        this.baseWarned = true;
        this.o.onEvent?.({
          type: 'ping', text: '基地が危険！ 戻って防衛だ！',
          team: this.player.team, from: '司令部',
        });
        this.o.onEvent?.({ type: 'announce', text: '基地がピンチ！', sub: '味方へ防衛指令を送信した', color: '#ff5a6a' });
        this.sfx('horn');
        if (this.net) {
          this.pendingNetEvents.push({ t: 'ping', text: '基地が危険！ 戻って防衛だ！', team: this.player.team });
        }
      }
    }

    // チャンピオン共通
    for (const c of this.champs) {
      if (c.isPlayer) continue;
      if (c.isRemote) this.updateRemoteChamp(c, dt);
      else this.updateBotAI(c, dt);
      this.updateChampionCommon(c, dt);
    }
    this.updateChampionCommon(this.player, dt);

    // ミニオン・タワー・ニュートラル
    if (this.authority) {
      this.updateWaves();
      for (const m of this.minions) if (!m.dead) this.updateMinion(m, dt);
      for (const s of this.structures) if (!s.dead && s.type === 'tower') this.updateTower(s, dt);
      this.updateNeutrals(dt);
    } else {
      for (const m of this.minions) if (!m.dead) this.animateMinionMesh(m, dt);
    }
    // 死体処理 (5秒後に昇天フェード・両モード共通)
    this.updateCorpses();

    // 召喚獣 (猟犬)・天使 (死亡演出)
    this.updatePets(dt);
    this.updateAngels(dt);

    // 弾
    this.updateProjectiles(dt);

    // マップギミック (電車/大波/オーブ/水たまり)
    this.updateGimmicks(dt);

    // 廃坑: 奈落への落下判定 (足場の外)
    if (this.mapDef.platforms) this.updateMineFalls(dt);

    // カメラ
    this.updateCamera(dt);

    // ネット送信
    if (this.net) this.updateNet(dt);

    // HUD
    this.hudAcc += dt;
    if (this.hudAcc >= 0.1) {
      this.hudAcc = 0;
      this.o.onHud?.(this.buildHud());
    }

    // メッシュ同期
    this.syncMeshes(dt);
  }

  private updateEndScene(dt: number) {
    this.time += dt * 0.4;
    for (const c of this.champs) {
      animateRig(c.rig, dt * 0.5, 0);
      c.rig.root.position.set(c.pos.x, 0, c.pos.y);
    }
    if (this.player.rig.anim !== 'victory' && !this.player.dead) {
      this.player.rig.anim = 'victory';
    }
  }

  // ==========================================================
  // プレイヤー操作
  // ==========================================================

  private updatePlayerControl(dt: number) {
    const p = this.player;
    if (p.dead) return;
    const kb = this.o.keybinds;
    this.statusHold = this.keys.has(kb.status);

    let mx = 0, mz = 0;
    if (this.keys.has(kb.up)) mz -= 1;
    if (this.keys.has(kb.down)) mz += 1;
    if (this.keys.has(kb.left)) mx -= 1;
    if (this.keys.has(kb.right)) mx += 1;
    if (this.touch.mx || this.touch.mz) { mx = this.touch.mx; mz = this.touch.mz; }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    p.guardHeld = this.keys.has(kb.guard) || this.touch.guard;

    // 気絶/ひより/怒りチャージ/お昼寝/落下/ステラコンボ中は操作不能 (立ち止まる)
    const locked = this.ccLocked(p);

    if (!p.dashing && !locked) {
      const spd = p.speed * (1 + (p.buffs.reduce((a, b) => a + b.speedPct, 0)) / 100) * (p.slowUntil > this.time ? 1 - p.slowPct / 100 : 1) * (p.guardHeld ? 0.5 : 1);
      p.pos.x += mx * spd * dt;
      p.pos.y += mz * spd * dt;
      if (len > 0.1) {
        p.facing = Math.atan2(mx, mz);
        if (p.anim !== 'attack' && p.anim !== 'cast') p.anim = 'run';
      } else if (p.anim === 'run') {
        p.anim = 'idle';
      }
    }

    // 攻撃 (気絶/硬直中は不可)
    if (!locked && ((this.keys.has(kb.attack) || this.touch.attack) && !p.guardHeld)) {
      this.tryBasicAttack(p);
    } else if (!locked && this.o.autoAttack && !p.guardHeld && !p.dashing) {
      // スマホ自動攻撃: 射程内にターゲットがいれば自動で通常攻撃
      this.tryBasicAttack(p);
    }
    this.clampToMap(p.pos);
  }

  /** 最短角を保った角度補間 (カメラ/モデルのスムーズ回転用) */
  private static angleLerp(from: number, to: number, k: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * k;
  }

  private clampToMap(p: THREE.Vector2) {
    p.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, p.x));
    p.y = Math.max(-MAP_HALF, Math.min(MAP_HALF, p.y));
    this.resolveWalls(p, 0.55);
  }

  /** 壁衝突: 矩形 (半径分拡張) にめり込んでいたら最も近い面へ押し出す */
  private resolveWalls(p: THREE.Vector2, r: number) {
    for (const w of this.wallRects) {
      const minX = w.minX - r, maxX = w.maxX + r;
      const minZ = w.minZ - r, maxZ = w.maxZ + r;
      if (p.x <= minX || p.x >= maxX || p.y <= minZ || p.y >= maxZ) continue;
      const dl = p.x - minX, dr = maxX - p.x;
      const du = p.y - minZ, dd = maxZ - p.y;
      const m = Math.min(dl, dr, du, dd);
      if (m === dl) p.x = minX;
      else if (m === dr) p.x = maxX;
      else if (m === du) p.y = minZ;
      else p.y = maxZ;
    }
  }

  /** 点が壁の内部 (r 拡張) にあるか */
  private pointInWall(x: number, z: number, r = 0.3): boolean {
    for (const w of this.wallRects) {
      if (x > w.minX - r && x < w.maxX + r && z > w.minZ - r && z < w.maxZ + r) return true;
    }
    return false;
  }

  /** ミニマップ用に壁矩形を公開 */
  getWalls() {
    return this.wallRects;
  }

  private tryBasicAttack(c: Champion) {
    if (c.attackCd > 0 || c.dead || c.anim === 'cast' || c.dashing || c.combo) return;
    // ターゲット探索
    let target: Champion | Minion | Structure | Neutral | Pet | null = null;
    let bestD = c.range + 1.2;
    const consider = (pos: THREE.Vector2, obj: Champion | Minion | Structure | Neutral | Pet, r: number, id: string) => {
      const d = dist2(c.pos, pos) - r;
      if (d < bestD) { bestD = d; target = obj; }
    };
    for (const e of this.champs) {
      if (e.team === c.team || e.dead) continue;
      if (c.isPlayer && !this.isVisibleToPlayer(e)) continue;
      consider(e.pos, e, 0.9, e.id);
    }
    for (const m of this.minions) {
      if (m.team === c.team || m.dead) continue;
      consider(m.pos, m, 0.7, m.id);
    }
    for (const s of this.structures) {
      if (s.team === c.team || s.dead) continue;
      consider(s.pos, s, 2.4, s.id);
    }
    for (const n of this.neutrals) {
      if (n.dead) continue;
      consider(n.pos, n, 1.2, n.id);
    }
    for (const pt of this.pets) {
      if (pt.team === c.team || pt.dead) continue;
      consider(pt.pos, pt, 0.8, pt.id);
    }
    if (!target) return;
    const tgt = target as Champion | Minion | Structure | Neutral | Pet;
    c.attackCd = 1 / c.atkSpeed;
    c.facing = Math.atan2(tgt.pos.x - c.pos.x, tgt.pos.y - c.pos.y);
    c.anim = 'attack'; c.animT = 0;
    // 猟犬の連携攻撃用: 最後に攻撃した対象を記録
    c.lastTargetId = this.idOf(tgt);
    c.lastTargetAt = this.time;

    const dmg = c.atk * (1 + c.buffs.reduce((a, b) => a + b.atkPct, 0) / 100);
    // ステラ: 負荷メータ満タン → 通常攻撃の代わりに 360度剣舞 (剣が自分の周りを舞う)
    if (c.def.id === 'stella' && c.anger >= 100) {
      this.doStellaSpin(c);
      return;
    }
    if (c.def.attack.type === 'melee') {
      // 近接: 即時
      this.particles.burst(tgt.pos.x, 1.2, tgt.pos.y, c.def.attack.color, 8, 4, 0.4);
      this.applyDamage(c, tgt, dmg, false);
    } else {
      // ステラの通常攻撃: 大剣が160度前方に振られてくるくる飛んでいく (近いほど高火力)
      let atkDmg = dmg;
      if (c.def.id === 'stella') {
        const dd = dist2(c.pos, tgt.pos);
        const closeK = 1.78 - 1.03 * Math.min(1, dd / Math.max(1, c.range)); // 近距離1.78× ↔ 最大射程0.75×
        atkDmg = dmg * closeK;
      }
      this.spawnProjectile({
        owner: c, team: c.team, from: new THREE.Vector3(c.pos.x, 1.35, c.pos.y),
        dir: new THREE.Vector2(tgt.pos.x - c.pos.x, tgt.pos.y - c.pos.y).normalize(),
        speed: c.def.id === 'stella' ? 24 : 30, dmg: atkDmg, shape: c.def.attack.shape, color: c.def.attack.color, glow: c.def.attack.glow,
        aoe: 0, homingId: this.idOf(tgt), isSkill: false,
      });
    }
    if (c.isPlayer && this.net && !this.authority) {
      // 非権威側の攻撃はHIT判定をローカルでも行う(下で適用) → net経由でダメージ送信は applyDamage 内
    }
  }

  private idOf(e: Champion | Minion | Structure | Neutral | Pet): string {
    return (e as { id: string }).id;
  }

  // ==========================================================
  // スキル
  // ==========================================================

  tryCast(idx: number) {
    const c = this.player;
    if (c.dead || this.paused || this.ended) return;
    if (this.ccLocked(c)) return; // 気絶/硬直中はスキル不可
    const s = c.def.skills[idx];
    if (c.mana < s.manaCost || c.dashing) return;
    // パルの召喚はスタック制 (30秒ごとに1スタック・最大3)
    if (s.kind === 'summon') {
      if (c.charges < 1) return;
      c.charges -= 1;
    } else if (c.cooldowns[idx] > 0) return;
    if (s.kind !== 'summon') c.cooldowns[idx] = s.cooldown;
    c.mana -= s.manaCost;
    c.anim = 'cast'; c.animT = 0;
    c.lastCombat = this.time;
    this.sfx('cast');

    // 照準: 最も近い敵チャンピオン → 敵全般 → 顔の向き
    const aim = this.findAim(c, s.range ?? 12);
    const aimPos = aim ? aim.pos : new THREE.Vector2(c.pos.x + Math.sin(c.facing) * 8, c.pos.y + Math.cos(c.facing) * 8);
    const dmg = (s.damage ?? 0) * c.atk * (1 + c.buffs.reduce((a, b) => a + b.atkPct, 0) / 100);

    // ステラE/R: 演出コンボ開始 (背後→前→背後の斬り / 十角形ダッシュ斎)
    if (s.comboKind) {
      // 対象は敵チャンピオン優先 (コンボの見栄え重視) → いなければ通常の照準
      const champR = s.kind === 'burst' ? 11 : 8;
      let tgt: Champion | null = null;
      let bd = Infinity;
      for (const e of this.champs) {
        if (e.team === c.team || e.dead) continue;
        if (!this.isVisibleToPlayer(e)) continue;
        const d = dist2(c.pos, e.pos);
        if (d < champR && d < bd) { bd = d; tgt = e; }
      }
      const target = tgt ?? (aim ? aim : null);
      if (!target) { c.cooldowns[idx] = 0; c.mana += s.manaCost; return; } // 敵がいないなら発動しない
      this.startStellaCombo(c, target, s.comboKind);
      return;
    }

    switch (s.kind) {
      case 'projectile': {
        // ステラQ: 体の周り360度に星6個 → 近くの敵にホーミング
        if (s.starRing) {
          this.spawnStarRing(c, s, dmg);
          break;
        }
        const count = s.count ?? 1;
        const baseAng = Math.atan2(aimPos.x - c.pos.x, aimPos.y - c.pos.y);
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? ((i - (count - 1) / 2) * (s.spreadDeg ?? 10) * Math.PI) / 180 : 0;
          this.spawnProjectile({
            owner: c, team: c.team,
            from: new THREE.Vector3(c.pos.x, 1.3, c.pos.y),
            dir: new THREE.Vector2(Math.sin(baseAng + off), Math.cos(baseAng + off)),
            speed: s.projSpeed ?? 24, dmg,
            shape: s.shape, color: s.color, glow: s.glow,
            aoe: 0, isSkill: true,
            slowPct: s.slowPct ?? 0, slowDur: s.slowDur ?? 0,
            stunDur: 0, cowerDur: s.cowerDur ?? 0,
            maxDist: s.range ?? 14,
          });
        }
        break;
      }
      case 'dash': {
        const ang = Math.atan2(aimPos.x - c.pos.x, aimPos.y - c.pos.y);
        const dist = Math.min(s.dashDist ?? 8, dist2(c.pos, aimPos) + 2);
        c.dashing = { dx: Math.sin(ang), dz: Math.cos(ang), remain: dist, dmg: (s.dashDamage ?? 0) * c.atk };
        c.facing = ang;
        this.rings.spawn(c.pos.x, c.pos.y, s.color, 2.2, 0.5);
        break;
      }
      case 'aoe': {
        const px = aim ? aim.pos.x : c.pos.x;
        const pz = aim ? aim.pos.y : c.pos.y;
        const r = s.aoeRadius ?? 5;
        this.rings.spawn(px, pz, s.color, r, 0.8);
        this.particles.burst(px, 1.2, pz, s.color, 30, 7, 0.8);
        this.aoeDamage(c, new THREE.Vector2(px, pz), r, dmg, s.slowPct ?? 0, s.slowDur ?? 0);
        break;
      }
      case 'burst': {
        const px = aim ? aim.pos.x : c.pos.x;
        const pz = aim ? aim.pos.y : c.pos.y;
        const r = s.aoeRadius ?? 7;
        this.rings.spawn(px, pz, s.color, r * 1.4, 1.0);
        this.rings.spawn(px, pz, '#ffffff', r, 0.6);
        this.particles.burst(px, 1.5, pz, s.color, 60, 11, 1.1);
        this.particles.burst(px, 1.0, pz, '#ffffff', 30, 8, 0.7);
        this.aoeDamage(c, new THREE.Vector2(px, pz), r, dmg, s.slowPct ?? 0, s.slowDur ?? 0, 0, s.cowerDur ?? 0);
        if (this.o.cameraShake) this.shake = 0.55;
        if (s.buff) this.applyBuff(c, s.buff, s.name);
        break;
      }
      case 'buff':
      case 'heal': {
        // お昼寝ベッド: その場にベッドを出して無敵お昼寝 (ベッドに触れた敵は気絶)
        if (s.sleepSec) {
          this.doSleep(c, s);
          break;
        }
        if (s.buff) this.applyBuff(c, s.buff, s.name);
        // 挑発系: 範囲内の敵にダメージ+減速 (アイゼンのウォークライ等)
        if ((s.damage ?? 0) > 0 && s.aoeRadius) {
          const px = aim ? aim.pos.x : c.pos.x;
          const pz = aim ? aim.pos.y : c.pos.y;
          const r = Math.min(s.aoeRadius, 6.5);
          this.rings.spawn(px, pz, s.color, r, 0.8);
          this.particles.burst(px, 1.2, pz, s.color, 20, 6, 0.7);
          this.aoeDamage(c, new THREE.Vector2(px, pz), r, (s.damage ?? 0) * c.atk, s.slowPct ?? 0, s.slowDur ?? 0);
        }
        // 味方全員回復 (サポーター: ルーミー等)
        if (s.allyHeal) {
          const r = s.allyRadius ?? 8;
          this.rings.spawn(c.pos.x, c.pos.y, s.color, r, 0.9);
          this.particles.burst(c.pos.x, 1.4, c.pos.y, s.color, 26, r * 0.7, 0.9, 0.5);
          for (const a of this.champs) {
            if (a.team !== c.team || a.dead) continue;
            if (a.id !== c.id && dist2(c.pos, a.pos) > r) continue;
            const healed = Math.min(a.maxHp - a.hp, s.allyHeal);
            a.hp += healed;
            if (s.buff?.shield) a.shield += s.buff.shield;
            if (healed > 1) {
              this.o.onEvent?.({ type: 'dmg', x: a.pos.x, y: 2, z: a.pos.y, amount: Math.round(healed), heal: true });
              this.particles.burst(a.pos.x, 1.6, a.pos.y, '#ffd0e8', 8, 2.4, 0.6, 0.5);
            }
          }
        }
        this.rings.spawn(c.pos.x, c.pos.y, s.color, 3, 0.8);
        this.particles.burst(c.pos.x, 1.4, c.pos.y, s.color, 24, 5, 0.9);
        break;
      }
      case 'summon': {
        // パル: 猟犬シャドウ召喚 (スタック消費は呼び出し側)
        this.spawnPet(c);
        break;
      }
    }
    // ネット: 相手に演出を送信
    if (this.net) {
      this.pendingNetEvents.push({
        t: 'fx', kind: 'ring', color: s.color, x: c.pos.x, z: c.pos.y, r: s.aoeRadius ?? 3,
      });
    }
  }

  private applyBuff(c: Champion, b: { shield?: number; heal?: number; speedPct?: number; atkPct?: number; armorPct?: number; duration: number }, name: string) {
    c.buffs.push({ speedPct: b.speedPct ?? 0, atkPct: b.atkPct ?? 0, armorPct: b.armorPct ?? 0, until: this.time + b.duration, name });
    if (b.shield) c.shield += b.shield;
    if (b.heal) {
      const healed = Math.min(c.maxHp - c.hp, b.heal);
      c.hp += healed;
      if (c.isPlayer) this.o.onEvent?.({ type: 'dmg', x: c.pos.x, y: 2, z: c.pos.y, amount: Math.round(healed), heal: true });
    }
  }

  // ==========================================================
  // フリル専用: お昼寝ベッド / 怒り爆発 (ひより)
  // ==========================================================

  /** お昼寝ベッド: その場にベッドを出して飛び乗り、無敵お昼寝 (そっと触れた敵は気絶) */
  private doSleep(c: Champion, s: { sleepSec?: number; sleepHeal?: number; color: string }) {
    c.sleepUntil = this.time + (s.sleepSec ?? 2);
    c.sleepHeal = s.sleepHeal ?? 400;
    c.anim = 'guard';
    c.animT = 0;
    this.spawnBed(c);
    this.rings.spawn(c.pos.x, c.pos.y, s.color, 3.4, 1.2);
    this.particles.burst(c.pos.x, 1.8, c.pos.y, '#ffd0e8', 22, 4.5, 0.9, 0.5);
    this.sfx('bed');
    this.sfx('sleep');
    if (c.isPlayer) {
      this.o.onEvent?.({ type: 'announce', text: 'お昼寝タイム…', sub: 'ベッドの上で無敵の休息。ベッドにそっと触れた相手は衝撃で気絶！', color: '#ffe9a0' });
    }
  }

  /** ベッドを生成 (10秒間残り、そっと触れた敵は3秒気絶) */
  private spawnBed(c: Champion) {
    // オンライン: 権威でない場合は設置を報せて自分側でも演出
    if (this.net && !this.authority) {
      this.pendingNetEvents.push({ t: 'fx', kind: 'bed', x: +c.pos.x.toFixed(1), z: +c.pos.y.toFixed(1), rot: +c.facing.toFixed(2), team: c.team });
    }
    this.createBed(c.pos.x, c.pos.y, c.facing, c.team, c.id, c);
  }

  private createBed(x: number, z: number, rot: number, team: Team, owner: string, ownerRef?: Champion) {
    const mesh = buildBed();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rot;
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    const bed: Bed = {
      x, z, rot,
      until: this.time + 10, born: this.time,
      team, owner, hitIds: [], mesh,
    };
    this.beds.push(bed);
    if (ownerRef) ownerRef.bedRef = bed;
    return bed;
  }

  private updateBeds(dt: number) {
    void dt;
    for (let i = this.beds.length - 1; i >= 0; i--) {
      const b = this.beds[i];
      const life = b.until - this.time;
      if (life <= 0) {
        this.scene.remove(b.mesh);
        this.beds.splice(i, 1);
        for (const c of this.champs) if (c.bedRef === b) c.bedRef = null;
        continue;
      }
      // 出現時はふわっと現れ、消滅前は縮んで消える
      const scale = Math.min(1, life / 0.8, (this.time - b.born) / 0.25);
      b.mesh.scale.setScalar(Math.max(0.01, scale));
      // 権威: ベッドにそっと触れた敵は3秒気絶 (1体1回)
      if (this.authority) {
        for (const e of this.champs) {
          if (e.team === b.team || e.dead || e.id === b.owner) continue;
          if (dist2(e.pos, new THREE.Vector2(b.x, b.z)) > 2.35) continue;
          if (b.hitIds.includes(e.id)) continue;
          b.hitIds.push(e.id);
          this.applyStun(e, 3);
          this.particles.burst(e.pos.x, 1.5, e.pos.y, '#ffd0e8', 14, 4, 0.7);
        }
      }
    }
  }

  /** 怒り爆発 (大雷怒り): 周囲の敵をひよらせて吹き飛ばし、自分はすっきりダッシュ */
  private doRage(c: Champion) {
    c.rageCharging = false;
    c.rageChargeUntil = 0;
    c.anger = 0;
    const R = 7.5;
    // 衝撃波演出 (3重リング + 爆発パーティクル)
    this.rings.spawn(c.pos.x, c.pos.y, '#ff7a5c', R, 0.9);
    this.rings.spawn(c.pos.x, c.pos.y, '#ffb02e', R * 0.72, 0.7);
    this.rings.spawn(c.pos.x, c.pos.y, '#ffffff', R * 0.45, 0.55);
    this.particles.burst(c.pos.x, 1.6, c.pos.y, '#ff7a5c', 46, 9, 1.1, 0.5);
    this.particles.burst(c.pos.x, 1.0, c.pos.y, '#ffffff', 24, 6.5, 0.8, 0.4);
    this.sfx('rage');
    this.shake = Math.max(this.shake, 0.55);
    if (c.isPlayer) {
      this.o.onEvent?.({ type: 'announce', text: 'プンプン！！怒ったぞ〜！！', sub: '大雷怒り！ 周囲の敵はひよって動けない！', color: '#ff7a5c' });
    }
    // 周囲の敵: ひより 2.5秒 + 吹き飛ばし
    for (const e of this.champs) {
      if (e.team === c.team || e.dead) continue;
      const d = dist2(c.pos, e.pos);
      if (d > R + 0.8) continue;
      if (e.isRemote) {
        // リモート相手: オーナー側でひよってもらう (ダメージ0の通知にひより秒を同梱)
        if (this.net) {
          this.pendingNetEvents.push({ t: 'champDmg', pid: e.ownerPid ?? '', from: this.o.myPid ?? '', amt: 0, cower: 2.5 });
        }
        continue;
      }
      this.applyCower(e, 2.5);
      // ノックバック (フリルから離れる方向へ2.6u)
      const dx = e.pos.x - c.pos.x, dz = e.pos.y - c.pos.y;
      const len = Math.max(0.001, Math.hypot(dx, dz));
      e.pos.x += (dx / len) * 2.6;
      e.pos.y += (dz / len) * 2.6;
      this.clampToMap(e.pos);
    }
    // すっきりダッシュ (逃げ足バフ)
    this.applyBuff(c, { speedPct: 35, duration: 3 }, 'すっきりダッシュ');
    // オンライン: 相手側にも衝撃波を見せる
    if (this.net) {
      this.pendingNetEvents.push({ t: 'fx', kind: 'rage', color: '#ff7a5c', x: +c.pos.x.toFixed(1), z: +c.pos.y.toFixed(1), r: R, team: c.team });
    }
  }

  /** フリル被弾フック: 怒り蓄積 (被ダメージの16%が怒りに変換される) */
  private onFrillDamaged(c: Champion, dmg: number) {
    if (c.def.id !== 'frill' || dmg <= 0 || c.dead) return;
    c.anger = Math.min(100, c.anger + dmg * 0.16);
  }

  // ==========================================================
  // パル: 猟犬シャドウ召喚 / 召喚獣システム
  // ==========================================================

  /** 猟犬シャドウ (体力600) を自分の位置に召喚。通常は随伴し、主人が攻撃した敵に飛びかかる */
  private spawnPet(owner: Champion) {
    // 既に犬がいる → 新しく召喚し直す (旧犬は光とともに消える)
    for (const old of this.pets.filter((p) => p.ownerId === owner.id)) {
      this.particles.burst(old.pos.x, 1, old.pos.y, '#4ff0d0', 16, 4, 0.7, 0.6);
      this.scene.remove(old.mesh);
      this.pets = this.pets.filter((p) => p !== old);
    }
    const mesh = buildDog(owner.team, owner.def.colors.aura);
    mesh.position.set(owner.pos.x + 0.9, 0, owner.pos.y + 0.9);
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    const pet: Pet = {
      id: `pet_${this.petSeq++}`, team: owner.team, ownerId: owner.id,
      pos: new THREE.Vector2(owner.pos.x + 0.9, owner.pos.y + 0.9), facing: owner.facing,
      hp: 600, maxHp: 600, atk: 58, atkCd: 0, atkRange: 1.5,
      targetId: null, animT: 0, dead: false, mesh,
    };
    this.pets.push(pet);
    this.rings.spawn(pet.pos.x, pet.pos.y, '#4ff0d0', 2.4, 0.7);
    this.particles.burst(pet.pos.x, 0.9, pet.pos.y, '#4ff0d0', 22, 4.5, 0.8, 0.5);
    this.sfx('summon');
    if (owner.isPlayer) {
      this.o.onEvent?.({ type: 'announce', text: 'シャドウ、来た！', sub: '猟犬が随伴する。攻撃した敵に飛びかかる！(HP600)', color: '#4ff0d0' });
    }
  }

  /** 召喚獣の更新 (随伴 / 連携攻撃) */
  private updatePets(dt: number) {
    for (let i = this.pets.length - 1; i >= 0; i--) {
      const pet = this.pets[i];
      const owner = this.champs.find((c) => c.id === pet.ownerId);
      pet.atkCd = Math.max(0, pet.atkCd - dt);
      pet.animT += dt;

      // 主人が直近 (1.6秒以内) に攻撃した敵をターゲットに指定 (倒すまで追撃)
      if (owner && owner.lastTargetAt > this.time - 1.6 && owner.lastTargetId) {
        const t = this.resolveEntity(owner.lastTargetId);
        if (t && !(t as Minion).dead && !(t as Champion).dead) {
          const d = dist2(pet.pos, (t as { pos: THREE.Vector2 }).pos);
          if (d < 15) pet.targetId = owner.lastTargetId;
        }
      }
      // ターゲットの持続: 死ぬか遠ざかりすぎたら解除
      if (pet.targetId) {
        const t = this.resolveEntity(pet.targetId);
        if (!t || (t as Minion).dead || (t as Champion).dead
          || dist2(pet.pos, (t as { pos: THREE.Vector2 }).pos) > 20) {
          pet.targetId = null;
        }
      }
      const tgt: Champion | Minion | Neutral | null =
        pet.targetId ? (this.resolveEntity(pet.targetId) as Champion | Minion | Neutral | null) : null;
      const spd = 9.2;
      if (tgt) {
        const d = dist2(pet.pos, tgt.pos);
        if (d > pet.atkRange + 0.4) {
          const dx = (tgt.pos.x - pet.pos.x) / d, dz = (tgt.pos.y - pet.pos.y) / d;
          pet.pos.x += dx * spd * dt;
          pet.pos.y += dz * spd * dt;
          pet.facing = Math.atan2(dx, dz);
        } else if (pet.atkCd <= 0) {
          pet.atkCd = 1.0;
          pet.facing = Math.atan2(tgt.pos.x - pet.pos.x, tgt.pos.y - pet.pos.y);
          const src = { team: pet.team, id: pet.id } as unknown as Champion;
          if ((tgt as Champion).def) {
            this.applyDamage(src, tgt as Champion, pet.atk, false);
          } else {
            this.applyDamage(src, tgt, pet.atk, false);
          }
          this.particles.burst(tgt.pos.x, 1.1, tgt.pos.y, '#4ff0d0', 6, 3, 0.4);
        }
      } else if (owner) {
        // 主人に随伴 (2.2uまで接近、離れたら速攻で追いつく)
        const d = dist2(pet.pos, owner.pos);
        if (d > 2.4) {
          const dx = (owner.pos.x - pet.pos.x) / d, dz = (owner.pos.y - pet.pos.y) / d;
          const chase = d > 8 ? spd : spd * 0.82;
          pet.pos.x += dx * chase * dt;
          pet.pos.y += dz * chase * dt;
          pet.facing = Math.atan2(dx, dz);
        }
      }
      this.clampToMap(pet.pos);
      // メッシュ同期 (軽いバウンド+尻尾振り)
      const bob = Math.abs(Math.sin(pet.animT * 9)) * 0.1;
      pet.mesh.position.set(pet.pos.x, bob, pet.pos.y);
      pet.mesh.rotation.y = pet.facing;
      const sc = Math.min(1, pet.animT / 0.25);
      pet.mesh.scale.setScalar(sc);
    }
  }

  /** 死亡時の天使: 白い翼の精霊が昇天しながら消えていく */
  private spawnAngel(x: number, z: number) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff6e0, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glowM = new THREE.MeshBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    // 光の体 (紡錘)
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 8), mat);
    body.rotation.x = Math.PI;
    body.position.y = 0.55;
    // 頭
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat);
    head.position.y = 1.28;
    // 光輪
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 6, 20), glowM);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.66;
    // 翼 (2枚の三角平面)
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0.9, 0,  0.95, 1.5, -0.12,  0.75, 0.35, -0.1,
    ]), 3));
    wingGeo.computeVertexNormals();
    const wingR = new THREE.Mesh(wingGeo, mat);
    const wingL = new THREE.Mesh(wingGeo, mat);
    wingL.scale.x = -1;
    g.add(body, head, halo, wingR, wingL);
    g.position.set(x, 0.4, z);
    this.scene.add(g);
    this.angels.push({ x, z, born: this.time, mesh: g });
    this.particles.burst(x, 1.2, z, '#ffe9a0', 18, 3, 1.1, 1.2);
  }

  private updateAngels(dt: number) {
    void dt;
    for (let i = this.angels.length - 1; i >= 0; i--) {
      const a = this.angels[i];
      const t = (this.time - a.born) / 2.8;
      if (t >= 1) {
        this.scene.remove(a.mesh);
        a.mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.angels.splice(i, 1);
        continue;
      }
      const ease = t * t * (3 - 2 * t);
      a.mesh.position.y = 0.4 + ease * 4.6;
      a.mesh.rotation.y += 0.01;
      const op = Math.max(0, 1 - t);
      a.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mm = o.material as THREE.MeshBasicMaterial;
          mm.opacity = (mm.color.getHex() === 0xffe9a0 ? 0.9 : 0.85) * op;
        }
      });
      // 羽ばたき
      const flap = Math.sin(this.time * 9) * 0.25;
      a.mesh.children[3].rotation.z = flap;
      a.mesh.children[4].rotation.z = -flap;
    }
  }

  private findAim(c: Champion, range: number): Champion | Minion | Structure | Neutral | null {
    let best: Champion | Minion | Structure | Neutral | null = null;
    // チャンピオンは「弱い敵 & 近い敵」を優先 (ボットAIと同じ評価基準で公平に)
    // ※ 純粋な近さ順だと、目の前のタンクにスキルを全部撃ってしまい火力を無駄にしていた
    let bestScore = Infinity;
    let champFound = false;
    for (const e of this.champs) {
      if (e.team === c.team || e.dead) continue;
      if (c.isPlayer && !this.isVisibleToPlayer(e)) continue;
      const d = dist2(c.pos, e.pos);
      if (d >= range) continue;
      const score = e.hp / e.maxHp + d * 0.025;
      if (score < bestScore) { bestScore = score; best = e; champFound = true; }
    }
    if (champFound && best) return best;
    let bestD = range;
    for (const m of this.minions) {
      if (m.team === c.team || m.dead) continue;
      const d = dist2(c.pos, m.pos);
      if (d < bestD) { bestD = d; best = m; }
    }
    if (best) return best;
    for (const s of this.structures) {
      if (s.team === c.team || s.dead) continue;
      const d = dist2(c.pos, s.pos);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best && !c.isPlayer) {
      for (const n of this.neutrals) {
        if (n.dead) continue;
        const d = dist2(c.pos, n.pos);
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    return best;
  }

  private aoeDamage(src: Champion, center: THREE.Vector2, r: number, dmg: number, slowPct: number, slowDur: number, stunDur = 0, cowerDur = 0) {
    for (const e of this.champs) {
      if (e.team === src.team || e.dead) continue;
      if (dist2(center, e.pos) <= r + 0.8) {
        this.applyDamage(src, e, dmg, false, slowPct, slowDur, stunDur, cowerDur);
      }
    }
    for (const m of this.minions) {
      if (m.team === src.team || m.dead) continue;
      if (dist2(center, m.pos) <= r) this.applyDamage(src, m, dmg, false, 0, 0, stunDur);
    }
    for (const n of this.neutrals) {
      if (n.dead) continue;
      if (dist2(center, n.pos) <= r) this.applyDamage(src, n, dmg, false);
    }
    for (const pt of this.pets) {
      if (pt.team === src.team || pt.dead) continue;
      if (dist2(center, pt.pos) <= r) this.applyDamage(src, pt, dmg, false);
    }
  }

  // ==========================================================
  // チャンピオン共通更新 (バフ・回復・射出・リジット)
  // ==========================================================

  private updateChampionCommon(c: Champion, dt: number) {
    // ステラ: 演出コンボ進行 (移動より優先・コンボ中は通常行動は封拉)
    if (c.combo) this.updateStellaCombo(c);
    // ダッシュ
    if (c.dashing) {
      const step = Math.min(c.dashing.remain, 26 * dt);
      c.pos.x += c.dashing.dx * step;
      c.pos.y += c.dashing.dz * step;
      c.dashing.remain -= step;
      this.particles.burst(c.pos.x, 0.8, c.pos.y, c.def.colors.aura, 2, 1.5, 0.35, 0.2);
      // 通過ダメージ
      for (const e of this.champs) {
        if (e.team === c.team || e.dead) continue;
        if (dist2(c.pos, e.pos) < 1.6 && c.dashing) {
          this.applyDamage(c, e, c.dashing.dmg, false);
        }
      }
      for (const m of this.minions) {
        if (m.team === c.team || m.dead) continue;
        if (dist2(c.pos, m.pos) < 1.3 && c.dashing) {
          this.applyDamage(c, m, c.dashing.dmg, false);
        }
      }
      if (c.dashing && c.dashing.remain <= 0) c.dashing = null;
      this.clampToMap(c.pos);
    }

    // 集合フェーズ (開戦まで): 全員ファウンテンから出れない
    if (this.time < this.startHoldAt && !c.dead) {
      const fc = this.fountainCenter(c.team);
      const fx = c.pos.x - fc.x, fz = c.pos.y - fc.y;
      const fd = Math.hypot(fx, fz);
      const R = 7.4;
      if (fd > R) {
        c.pos.x = fc.x + (fx / fd) * R;
        c.pos.y = fc.y + (fz / fd) * R;
      }
    }

    // ---- フリルパッシブ: 怒り満タン → チャージ → 大雷怒り (周囲の敵をひよらせる) ----
    if (c.def.id === 'frill' && !c.dead) {
      if (c.rageCharging) {
        // チャージ中: ぷんぷん湯気を吹きながらその場でふるえる
        c.anim = 'cast';
        c.animT = 0;
        if (Math.random() < dt * 26) {
          this.particles.burst(c.pos.x + (Math.random() - 0.5) * 0.6, 2.5, c.pos.y + (Math.random() - 0.5) * 0.6, '#ff7a5c', 2, 1.4, 0.55, 0.4);
        }
      }
      if (c.anger >= 100 && !c.rageCharging) {
        // 満タン: 0.85秒ためてから爆発 (相手に逃げるチャンスもある)
        c.rageCharging = true;
        c.rageChargeUntil = this.time + 0.85;
        c.dashing = null;
        this.sfx('rage-charge');
        if (c.isPlayer) {
          this.o.onEvent?.({ type: 'announce', text: 'ちょっと…！ プンプンだぞ…！', sub: '怒りMAX！ まもなく大雷怒りが炸裂する！', color: '#ffb02e' });
        }
      }
      if (c.rageCharging && this.time >= c.rageChargeUntil) {
        this.doRage(c);
      }
    }

    // ---- パルの召喚チャージ (30秒ごとに+1・最大3) ----
    if (c.def.id === 'pal' && !c.dead) {
      if (c.charges < 3) {
        c.chargeTimer += dt;
        if (c.chargeTimer >= 30) {
          c.chargeTimer -= 30;
          c.charges += 1;
          if (c.isPlayer) this.sfx('charge');
        }
      } else {
        c.chargeTimer = 0;
      }
    }

    // ---- 気絶中: 立ち止まって目を回す ----
    if (c.stunnedUntil > this.time && !c.dead) {
      c.anim = 'idle';
      c.animT = 0;
      if (Math.random() < dt * 3) {
        this.particles.burst(c.pos.x, 2.6, c.pos.y, '#ffe14d', 2, 1.2, 0.5, 0.3);
      }
    }

    // ---- ひより中: ぷるぷる震える ----
    if (c.coweredUntil > this.time && !c.dead) {
      c.anim = 'idle';
      c.animT = 0;
      c.rig.root.rotation.z = Math.sin(this.time * 26) * 0.05;
    } else {
      c.rig.root.rotation.z = 0;
    }

    // ---- お昼寝睡眠: ベッドの上で無敵 + 毎秒回復 (気絶はベッドが担当) ----
    if (c.sleepUntil > this.time && !c.dead) {
      c.anim = 'guard';
      const healed = Math.min(c.maxHp - c.hp, c.sleepHeal * dt);
      c.hp += healed;
      // ベッドの上に乗る (Zzzは頭上から)
      const bedOk = c.bedRef && this.beds.includes(c.bedRef);
      c.rootY = bedOk ? 0.7 : 0;
      if (Math.random() < dt * 8) {
        this.particles.burst(c.pos.x, 2.2 + c.rootY, c.pos.y, '#c8f0ff', 2, 1.4, 0.6, 0.4);
      }
    } else {
      c.rootY = 0;
      if (c.bedRef) c.bedRef = null;
    }

    // バフ期限 (毎フレームのfilterで配列を生成しない — 期限切れがある時だけ)
    let buffExpired = false;
    for (const b of c.buffs) {
      if (b.until <= this.time) { buffExpired = true; break; }
    }
    if (buffExpired) c.buffs = c.buffs.filter((b) => b.until > this.time);
    if (c.slowUntil <= this.time) c.slowPct = 0;
    // シールド自然減少
    c.shield = Math.max(0, c.shield - dt * 8);

    if (c.dead) {
      if (this.authority || c.isPlayer || c.isRemote === false) {
        if (this.time >= c.respawnAt) {
          this.respawnChampion(c);
        }
      }
      return;
    }

    // 自然回復 (3倍強化 + 動的: 戦闘外でさらに2.6倍 / 草むら潜伏中はさらに2倍)
    const outOfCombat = this.time - c.lastCombat > 5;
    const hiding = this.inBush(c.pos);
    const regen = (c.hpRegen * 3 + c.level * 0.45) * (outOfCombat ? 2.6 : 1) * (hiding ? 2 : 1) * (c.guardHeld ? 0.5 : 1);
    c.hp = Math.min(c.maxHp, c.hp + regen * dt);
    c.mana = Math.min(c.maxMana, c.mana + c.def.stats.manaRegen * 3 * dt);

    // ファウンテン回復: 自陣に戻ると1秒に100の動的回復 (HP/MP)
    const ownNexus = this.structures.find((s) => s.team === c.team && s.type === 'nexus');
    const inFountain = !!ownNexus && dist2(c.pos, ownNexus.pos) < 9.5;
    c.inFountain = inFountain;
    if (inFountain) {
      const before = c.hp;
      c.hp = Math.min(c.maxHp, c.hp + 100 * dt);
      c.mana = Math.min(c.maxMana, c.mana + 100 * dt);
      if (c.hp - before > 0.01 && Math.random() < dt * 10) {
        this.particles.burst(c.pos.x, 1.1, c.pos.y, '#7dffb0', 2, 1.6, 0.55, 0.5);
      }
    }

    // パッシブゴールド (全チャンプ共通・MOBA標準の毎秒収入)
    c.gold += 3 * dt;

    // クールダウン (毎フレームのmapで配列を生成しない — 破壊的更新)
    const cds = c.cooldowns;
    if (cds[0] > 0) cds[0] = Math.max(0, cds[0] - dt);
    if (cds[1] > 0) cds[1] = Math.max(0, cds[1] - dt);
    if (cds[2] > 0) cds[2] = Math.max(0, cds[2] - dt);
    c.attackCd = Math.max(0, c.attackCd - dt);

    // リジット更新
    c.rig.anim = c.anim as CharacterRig['anim'];
    if (c.anim !== 'idle' && c.anim !== 'run' && c.anim !== 'guard') {
      const dur = c.anim === 'attack' ? 0.34 : 0.5;
      if (c.animT >= dur) c.anim = c.dashing ? 'run' : 'idle';
    }
    c.animT += dt;
    c.rig.animT = c.animT;
    const speed01 = c.anim === 'run' ? 1 : 0;
    animateRig(c.rig, dt, speed01);
    if (c.guardHeld && c.anim !== 'attack' && c.anim !== 'cast') {
      c.rig.anim = 'guard';
      animateRig(c.rig, 0, 0);
    }
    c.rig.root.position.set(c.pos.x, c.rootY, c.pos.y);
    // 表示用の向きは最短角でスムーズに追従 (WASD方向転換のガクつき解消)
    c.dispYaw = Battle.angleLerp(c.dispYaw, c.facing, Math.min(1, 1 - Math.exp(-13 * dt)));
    c.rig.root.rotation.y = c.dispYaw;
    // ---- 奈落落下中: 前転しながら落ちるタンブル演出 (加速する回転) ----
    if (c.fallingUntil > this.time) {
      const k = 1 - Math.max(0, c.fallingUntil - this.time) / 0.9;
      c.rig.root.rotation.x = k * k * 5.6;
      c.rig.root.rotation.z = Math.sin(k * 9.5) * 0.22 * k;
    } else if (c.rig.root.rotation.x !== 0 || c.rig.root.rotation.z !== 0) {
      c.rig.root.rotation.x = 0;
      c.rig.root.rotation.z = 0;
    }
    c.rig.shieldMesh.visible = c.shield > 5 || c.guardHeld;
    if (c.rig.shieldMesh.visible) {
      const sm = c.rig.shieldMesh.material as THREE.MeshStandardMaterial;
      sm.opacity = c.guardHeld ? 0.42 : 0.25 + Math.sin(this.time * 6) * 0.08;
      c.rig.shieldMesh.rotation.y += dt * 1.5;
    }
    // 草むらで半透明 / 一人称視点 (ズーム0) では自キャラの体を非表示
    const hidden = !c.isPlayer && !this.isVisibleToPlayer(c);
    c.rig.root.visible = !hidden && !(c.isPlayer && this.zoom < 0.18);
    if (this.inBush(c.pos) && c.isPlayer) c.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        o.material.transparent = true;
        o.material.opacity = Math.min(o.material.opacity, 0.85);
      }
    });
  }

  private respawnChampion(c: Champion) {
    c.dead = false;
    c.hp = c.maxHp;
    c.mana = c.maxMana;
    c.shield = 0;
    c.buffs = [];
    c.anim = 'idle';
    c.stunnedUntil = 0;
    c.coweredUntil = 0;
    c.anger = 0;
    c.rageCharging = false;
    c.rageChargeUntil = 0;
    c.sleepUntil = 0;
    c.bedRef = null;
    c.rootY = 0;
    c.fallingUntil = 0;
    c.rig.deadT = 0;
    c.rig.root.rotation.z = 0;
    c.rig.root.visible = true;
    // リスポーンもチームのファウンテン (同じ場所) から
    c.pos.copy(this.fountainPos(c.team, c.spawnIdx));
    const enemyN = NEXUS_POS[c.team === 'blue' ? 'red' : 'blue'];
    c.facing = Math.atan2(enemyN.x - c.pos.x, enemyN.z - c.pos.y);
    this.particles.burst(c.pos.x, 1, c.pos.y, '#ffffff', 40, 8, 0.9);
    this.rings.spawn(c.pos.x, c.pos.y, TEAM_HEX[c.team], 4, 0.8);
  }

  // ==========================================================
  // Bot AI
  // ==========================================================

  /**
   * 廃坑: ボットの安全な一歩。次の位置が歩行不能なら方向をずらして橋に沿って進む。
   * 全方向だめなら false (その場に留まり、呼び出し側が目標を再計画する)。
   */
  private stepMineSafe(c: Champion, dirX: number, dirZ: number, step: number): boolean {
    const baseAng = Math.atan2(dirX, dirZ);
    for (const off of [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65, 2.2, -2.2, 2.75, -2.75, 3.1]) {
      const a = baseAng + off;
      const nx = c.pos.x + Math.sin(a) * step;
      const nz = c.pos.y + Math.cos(a) * step;
      if (this.isWalkableMine(nx, nz)) {
        c.pos.x = nx;
        c.pos.y = nz;
        return true;
      }
    }
    return false;
  }

  private updateBotAI(c: Champion, dt: number) {
    if (c.dead || c.combo) return;
    this.botBuy(c);
    c.aiTimer -= dt;
    const enemyNexus = this.structures.find((s) => s.team !== c.team && s.type === 'nexus');
    const ownNexus = this.structures.find((s) => s.team === c.team && s.type === 'nexus');
    if (!enemyNexus || !ownNexus) return;

    // 集合フェーズ: 開戦まで全員ファウンテンで待機 (同じ場所からスタート)
    if (this.time < this.startHoldAt) {
      c.anim = 'idle';
      const en = NEXUS_POS[c.team === 'blue' ? 'red' : 'blue'];
      c.facing = Math.atan2(en.x - c.pos.x, en.z - c.pos.y);
      return;
    }

    // 気絶/ひより/怒りチャージ/お昼寝中: 行動不能
    if (this.ccLocked(c)) {
      c.anim = 'idle';
      return;
    }

    // 体力が危険 → 後退
    if (c.hp < c.maxHp * 0.2) c.aiRetreat = true;
    if (c.aiRetreat && c.hp > c.maxHp * 0.75) c.aiRetreat = false;

    // 最も弱い (HP%) 敵チャンピオンを優先ターゲット — 弱い敵 & 近い敵を狙う
    let enemyChamp: Champion | null = null;
    let bestChampScore = Infinity;
    for (const e of this.champs) {
      if (e.team === c.team || e.dead) continue;
      if (c.isPlayer && !this.isVisibleToPlayer(e)) continue;
      const d = dist2(c.pos, e.pos);
      if (d > 14) continue;
      const score = e.hp / e.maxHp + d * 0.02;
      if (score < bestChampScore) { bestChampScore = score; enemyChamp = e; }
    }
    const distEnemyChamp = enemyChamp ? dist2(c.pos, enemyChamp.pos) : 999;

    const moveToward = (tx: number, tz: number, dt: number) => {
      const dx = tx - c.pos.x, dz = tz - c.pos.y;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) return true;
      const spd = c.speed * (1 + c.buffs.reduce((a, b) => a + b.speedPct, 0) / 100) * (c.slowUntil > this.time ? 1 - c.slowPct / 100 : 1);
      const step = spd * dt;
      if (this.mapDef.platforms) {
        // 廃坑: 奈落に落ちないよう、次の一歩が歩行可能か必ず確認 (だめなら橋に沿ってスライド)
        if (!this.stepMineSafe(c, dx / d, dz / d, step)) {
          // 完全に行き止まり → 目標を再計画 (中継点経由に切り替わる)
          c.aiScanUntil = 0;
          return false;
        }
      } else {
        c.pos.x += (dx / d) * step;
        c.pos.y += (dz / d) * step;
      }
      c.facing = Math.atan2(dx / d, dz / d);
      if (c.anim !== 'attack' && c.anim !== 'cast') c.anim = 'run';
      this.clampToMap(c.pos);
      return false;
    };

    if (c.aiRetreat) {
      moveToward(ownNexus.pos.x, ownNexus.pos.y, dt);
      return;
    }

    // 敵チャンピオンと交戦
    if (enemyChamp && distEnemyChamp < 14 && (!this.inBush(enemyChamp.pos) || this.sameBush(c.pos, enemyChamp.pos))) {
      // スキル使用 (賢い判断: 回復/バフは切羽詰った時・ULT は決めの時)
      if (c.aiTimer <= 0) {
        const hpPct = c.hp / c.maxHp;
        const tgtPct = enemyChamp.hp / enemyChamp.maxHp;
        for (let i = 0; i < 3; i++) {
          const s = c.def.skills[i];
          if (c.cooldowns[i] > 0 || c.mana < s.manaCost) continue;
          // 射程ゲート: スキルはそれぞれの射程内の相手にだけ撃つ (射程外への無駄撃ち禁止)
          if (s.kind === 'projectile' || s.kind === 'aoe' || s.kind === 'burst') {
            const castRange = Math.max(s.range ?? 0, s.aoeRadius ?? 0) + 1.6;
            if (distEnemyChamp > castRange) continue;
          } else if (s.kind === 'dash') {
            if (distEnemyChamp > (s.dashDist ?? 8) + 1) continue;
          }
          if (s.kind === 'heal' || s.kind === 'buff') {
            // 回復/バフ系: 自HP低下 or 接近戦の時だけ使う (温存しない)
            if (hpPct < 0.7 || distEnemyChamp < 7) {
              this.botCast(c, i, enemyChamp);
              c.aiTimer = 0.8 + Math.random() * 0.8;
              break;
            }
            continue;
          }
          if (i === 2) {
            // ULT: 相手が弱っている時 / 自分がピンチの時だけ撃つ
            if (distEnemyChamp < 8 && (tgtPct < 0.8 || hpPct < 0.5)) {
              this.botCast(c, i, enemyChamp);
              c.aiTimer = 0.8 + Math.random() * 0.8;
            }
            continue;
          }
          this.botCast(c, i, enemyChamp);
          c.aiTimer = 0.8 + Math.random() * 0.8;
          break;
        }
      }
      if (distEnemyChamp > c.range * 0.85) {
        moveToward(enemyChamp.pos.x, enemyChamp.pos.y, dt);
      } else {
        if (c.anim === 'run') c.anim = 'idle';
        this.tryBasicAttack(c);
      }
      return;
    }

    // 敵タワー回避: 味方ミニオンのカバーなしでタワー圏内に入るなら退避 (賢いボット)
    if (!c.aiRetreat) {
      const enemyTower = this.structures.find((s) => s.team !== c.team && s.type === 'tower' && !s.dead && dist2(c.pos, s.pos) < 12.4);
      if (enemyTower) {
        const cover = this.minions.some((m) => m.team === c.team && !m.dead && dist2(m.pos, enemyTower.pos) < 12);
        if (!cover) {
          const ax = c.pos.x - enemyTower.pos.x, az = c.pos.y - enemyTower.pos.y;
          const al = Math.hypot(ax, az) || 1;
          moveToward(c.pos.x + (ax / al) * 7, c.pos.y + (az / al) * 7, dt);
          return;
        }
      }
    }

    // レーンへ: 最も近い敵ミニオン → レーン推進
    // (重いスキャンは 0.25秒間隔でキャッシュ — 毎フレームの filter/sort によるGC負荷を回避)
    let goalX: number, goalZ: number;
    if (this.time < c.aiScanUntil) {
      goalX = c.aiGoalX; goalZ = c.aiGoalZ;
    } else {
      c.aiScanUntil = this.time + 0.25;
      let target: Minion | null = null;
      let bestD = 16;
      for (const m of this.minions) {
        if (m.team === c.team || m.dead) continue;
        const d = dist2(c.pos, m.pos);
        if (d < bestD) { bestD = d; target = m; }
      }
      if (target) {
        goalX = target.pos.x; goalZ = target.pos.y;
      } else {
        // 自レーン前進 (AIに割り当てられたレーンを進む)
        const lanePhase = (['mid', 'top', 'bot'] as LaneId[]).indexOf(c.aiLane) * 1.3;
        const laneTarget = lanePoint(
          c.team === 'blue'
            ? Math.min(0.92, 0.5 + Math.sin(this.time * 0.1 + lanePhase) * 0.38)
            : Math.max(0.08, 0.5 - Math.sin(this.time * 0.1 + lanePhase) * 0.38),
          c.aiLane
        );
        // レーン上の味方ミニオンに追従 (同レーンのみ)
        const allyMinion = this.minions.filter((m) => m.team === c.team && m.lane === c.aiLane && !m.dead)
          .sort((a, b) => (c.team === 'blue' ? b.pathT - a.pathT : a.pathT - b.pathT))[0];
        const goal = allyMinion ? allyMinion.pos : new THREE.Vector2(laneTarget.x, laneTarget.z);
        goalX = goal.x; goalZ = goal.y;
      }
      c.aiGoalX = goalX; c.aiGoalZ = goalZ;
      // 廃坑: 直線で到達できない目標 (奈落の向こう側) は歩行可能な中継点を経由する
      if (this.mapDef.platforms && !this.lineWalkableMine(c.pos.x, c.pos.y, goalX, goalZ)) {
        const wp = this.mineWaypoint(c.pos.x, c.pos.y, goalX, goalZ);
        if (wp) { goalX = wp.x; goalZ = wp.z; }
      }
      c.aiGoalX = goalX; c.aiGoalZ = goalZ;
    }
    // キャッシュした目標へ: 範囲外なら移動、範囲内なら攻撃
    const dGoal = Math.hypot(goalX - c.pos.x, goalZ - c.pos.y);
    if (dGoal > c.range * 0.8) {
      moveToward(goalX, goalZ, dt);
    } else {
      if (c.anim === 'run') c.anim = 'idle';
      this.tryBasicAttack(c);
    }
  }

  private botCast(c: Champion, idx: number, target: Champion) {
    const s = c.def.skills[idx];
    if (c.mana < s.manaCost || c.dashing) return;
    if (this.ccLocked(c)) return;
    // パルの召喚はスタック制
    if (s.kind === 'summon') {
      if (c.charges < 1) return;
      c.charges -= 1;
    } else if (c.cooldowns[idx] > 0) return;
    if (s.kind !== 'summon') c.cooldowns[idx] = s.cooldown;
    c.mana -= s.manaCost;
    c.anim = 'cast'; c.animT = 0;
    c.lastCombat = this.time;
    this.sfx('cast-bot');
    const dmg = (s.damage ?? (s.dashDamage ?? 0)) * c.atk;
    // ステラE/R: 演出コンボ (ボットも同じ演出)
    if (s.comboKind) {
      const tgtChamp = this.champs.find((e) => e.team !== c.team && !e.dead && dist2(c.pos, e.pos) < 9) ?? target;
      this.startStellaCombo(c, tgtChamp, s.comboKind);
      return;
    }
    switch (s.kind) {
      case 'projectile': {
        // ステラQ: 星のリング
        if (s.starRing) {
          this.spawnStarRing(c, s, dmg);
          break;
        }
        const count = s.count ?? 1;
        const baseAng = Math.atan2(target.pos.x - c.pos.x, target.pos.y - c.pos.y);
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? ((i - (count - 1) / 2) * (s.spreadDeg ?? 10) * Math.PI) / 180 : 0;
          this.spawnProjectile({
            owner: c, team: c.team, from: new THREE.Vector3(c.pos.x, 1.3, c.pos.y),
            dir: new THREE.Vector2(Math.sin(baseAng + off), Math.cos(baseAng + off)),
            speed: s.projSpeed ?? 24, dmg, shape: s.shape, color: s.color, glow: s.glow,
            aoe: 0, isSkill: true, slowPct: s.slowPct ?? 0, slowDur: s.slowDur ?? 0,
            stunDur: 0, cowerDur: s.cowerDur ?? 0, maxDist: s.range ?? 14,
          });
        }
        break;
      }
      case 'dash': {
        const ang = Math.atan2(target.pos.x - c.pos.x, target.pos.y - c.pos.y);
        c.dashing = { dx: Math.sin(ang), dz: Math.cos(ang), remain: Math.min(s.dashDist ?? 8, dist2(c.pos, target.pos) + 1), dmg: (s.dashDamage ?? 0) * c.atk };
        c.facing = ang;
        break;
      }
      case 'aoe':
      case 'burst': {
        const r = s.aoeRadius ?? 5.5;
        this.rings.spawn(target.pos.x, target.pos.y, s.color, r, 0.8);
        this.particles.burst(target.pos.x, 1.2, target.pos.y, s.color, 30, 7, 0.8);
        this.aoeDamage(c, target.pos.clone(), r, dmg, s.slowPct ?? 0, s.slowDur ?? 0, 0, s.cowerDur ?? 0);
        if (s.buff) this.applyBuff(c, s.buff, s.name);
        break;
      }
      case 'buff':
      case 'heal': {
        // お昼寝ベッド (ボットのフリル): ベッドを出してお昼寝
        if (s.sleepSec) {
          this.doSleep(c, s);
          break;
        }
        if (s.buff) this.applyBuff(c, s.buff, s.name);
        // 挑発系 (ボットのアイゼン等)
        if ((s.damage ?? 0) > 0 && s.aoeRadius) {
          const r = Math.min(s.aoeRadius, 6.5);
          this.rings.spawn(c.pos.x, c.pos.y, s.color, r, 0.8);
          this.aoeDamage(c, c.pos.clone(), r, (s.damage ?? 0) * c.atk, s.slowPct ?? 0, s.slowDur ?? 0);
        }
        // 味方全員回復 (ボットのルーミー等)
        if (s.allyHeal) {
          const r = s.allyRadius ?? 8;
          this.rings.spawn(c.pos.x, c.pos.y, s.color, r, 0.9);
          for (const a of this.champs) {
            if (a.team !== c.team || a.dead) continue;
            if (a.id !== c.id && dist2(c.pos, a.pos) > r) continue;
            const healed = Math.min(a.maxHp - a.hp, s.allyHeal);
            a.hp += healed;
            if (s.buff?.shield) a.shield += s.buff.shield;
          }
        }
        this.rings.spawn(c.pos.x, c.pos.y, s.color, 3, 0.8);
        break;
      }
      case 'summon': {
        this.spawnPet(c);
        break;
      }
    }
  }

  // ==========================================================
  // ステラ: 星剣の技 (スターバースト / ステラッシュ / ステライド / 負荷メータ)
  // ==========================================================

  /** ステラQ: 体の周り360度に星6個を出現させ、近くの敵へ飛ばす (ホーミング) */
  private spawnStarRing(c: Champion, s: import('../types').SkillDef, dmg: number) {
    const count = s.count ?? 6;
    const maxD = s.range ?? 12;
    // 近くの敵を集める (チャンピオン → ミニオン → ニュートラル/召喚獣)
    type Cand = { id: string; pos: THREE.Vector2 };
    const cands: Cand[] = [];
    const enemies = this.champs.filter((e) => e.team !== c.team && !e.dead && dist2(c.pos, e.pos) < maxD)
      .sort((a, b) => dist2(c.pos, a.pos) - dist2(c.pos, b.pos));
    for (const e of enemies) cands.push({ id: e.id, pos: e.pos });
    if (cands.length < count) {
      for (const m of this.minions) {
        if (m.team === c.team || m.dead) continue;
        if (dist2(c.pos, m.pos) < maxD) cands.push({ id: m.id, pos: m.pos });
      }
    }
    if (cands.length < count) {
      for (const n of this.neutrals) {
        if (!n.dead && dist2(c.pos, n.pos) < maxD) cands.push({ id: n.id, pos: n.pos });
      }
      for (const pt of this.pets) {
        if (pt.team === c.team || pt.dead) continue;
        if (dist2(c.pos, pt.pos) < maxD) cands.push({ id: pt.id, pos: pt.pos });
      }
    }
    // 360度に星を出現させる (敵がいれば近い順に割り当て・いなければ円状に発射)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const cand = cands.length > 0 ? cands[i % cands.length] : null;
      const dirX = cand ? cand.pos.x - c.pos.x : Math.sin(a);
      const dirZ = cand ? cand.pos.y - c.pos.y : Math.cos(a);
      const dl = Math.hypot(dirX, dirZ) || 1;
      this.spawnProjectile({
        owner: c, team: c.team,
        from: new THREE.Vector3(c.pos.x + Math.sin(a) * 0.9, 1.3, c.pos.y + Math.cos(a) * 0.9),
        dir: new THREE.Vector2(dirX / dl, dirZ / dl),
        speed: s.projSpeed ?? 22, dmg,
        shape: 'star', color: s.color, glow: s.glow,
        aoe: 0, isSkill: true,
        homingId: cand?.id ?? null, maxDist: maxD,
      });
      // 出現の瞬間のキラッと
      this.particles.burst(c.pos.x + Math.sin(a) * 0.9, 1.3, c.pos.y + Math.cos(a) * 0.9, s.color, 3, 1.4, 0.4, 0.3);
    }
    this.rings.spawn(c.pos.x, c.pos.y, s.color, 2.6, 0.5);
  }

  /** ステラE/R: 演出コンボ開始 */
  private startStellaCombo(c: Champion, target: Champion | Minion | Structure | Neutral, kind: 'stellarush' | 'stellaride') {
    c.combo = { kind, targetId: this.idOf(target), phase: 0, nextAt: this.time + 0.12 };
    c.dashing = null;
    c.anim = 'cast'; c.animT = 0;
    this.sfx(c.isPlayer ? 'cast' : 'cast-bot');
    if (c.isPlayer) {
      const s = c.def.skills[kind === 'stellarush' ? 1 : 2];
      this.o.onEvent?.({ type: 'announce', text: `${s.name}！！`, sub: kind === 'stellarush' ? '背後→前→背後… 白黒つけてあげる！' : '十角の星路、開演！', color: '#ffe66a' });
    }
  }

  /** 奈落の上でも安全なワープ (廃坑では歩行可能地点に補正) */
  private teleportStella(c: Champion, x: number, z: number) {
    // ワープ元の星屑
    this.particles.burst(c.pos.x, 1.2, c.pos.y, '#ffe66a', 8, 3, 0.45, 0.5);
    if (this.mapDef.platforms && !this.isWalkableMine(x, z)) {
      const p = this.nearestWalkableMine(x, z);
      x = p.x; z = p.z;
    }
    c.pos.set(x, z);
    this.clampToMap(c.pos);
    this.particles.burst(x, 1.2, z, '#fff8d0', 10, 3.4, 0.5, 0.5);
  }

  /** ステラコンボ更新 (updateChampionCommon から毎フレーム呼ばれる) */
  private updateStellaCombo(c: Champion) {
    const cb = c.combo!;
    const tgt = this.resolveEntity(cb.targetId);
    if (!tgt || (tgt as Minion).dead || c.dead) {
      c.combo = null;
      return;
    }
    // 行動封拉 (気絶/ひより/睡眠) になったらコンボ中断
    const locked = c.stunnedUntil > this.time || c.coweredUntil > this.time || c.sleepUntil > this.time;
    if (locked) { c.combo = null; return; }

    const s = c.def.skills[cb.kind === 'stellarush' ? 1 : 2];
    const isChamp = this.champs.includes(tgt as Champion);
    const tPos = tgt.pos;

    // 斬撃の共通エフェクト
    const slashFx = (big: boolean) => {
      this.particles.burst(tPos.x, 1.4, tPos.y, big ? '#ffffff' : s.color, big ? 26 : 12, big ? 6 : 3.6, 0.5, 0.6);
      this.rings.spawn(tPos.x, tPos.y, big ? '#ffffff' : s.color, big ? 3 : 1.7, big ? 0.5 : 0.32, 1.1);
      this.beams.spawn(
        new THREE.Vector3(c.pos.x, 1.35, c.pos.y),
        new THREE.Vector3(tPos.x + (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 0.8, tPos.y + (Math.random() - 0.5) * 0.8),
        big ? '#ffffff' : s.color, 0.14, 0.07,
      );
      this.sfx('hit');
    };

    if (this.time < cb.nextAt) return;

    if (cb.kind === 'stellarush') {
      // 敵の向きの前後を計算
      const tFacing = (tgt as Champion).facing ?? c.facing;
      const fx = Math.sin(tFacing), fz = Math.cos(tFacing);
      const behind = { x: tPos.x - fx * 1.5, z: tPos.y - fz * 1.5 };
      const front = { x: tPos.x + fx * 1.5, z: tPos.y + fz * 1.5 };
      const atkMul = 1 + c.buffs.reduce((a, b) => a + b.atkPct, 0) / 100;

      if (cb.phase === 0) {
        // 1刀目: 敵の背後へダッシュして斬る
        this.teleportStella(c, behind.x, behind.z);
        c.facing = Math.atan2(tPos.x - c.pos.x, tPos.y - c.pos.y);
        c.anim = 'attack'; c.animT = 0;
        slashFx(false);
        this.applyDamage(c, tgt, 0.6 * c.atk * atkMul, false);
        cb.phase = 1; cb.nextAt = this.time + 0.34;
      } else if (cb.phase === 1) {
        // 2刀目: 敵の前へダッシュして斬る
        this.teleportStella(c, front.x, front.z);
        c.facing = Math.atan2(tPos.x - c.pos.x, tPos.y - c.pos.y);
        c.anim = 'attack'; c.animT = 0;
        slashFx(false);
        this.applyDamage(c, tgt, 0.6 * c.atk * atkMul, false);
        cb.phase = 2; cb.nextAt = this.time + 0.34;
      } else {
        // 3刀目: 敵を白黒にして大切り！
        this.teleportStella(c, behind.x, behind.z);
        c.facing = Math.atan2(tPos.x - c.pos.x, tPos.y - c.pos.y);
        c.anim = 'attack'; c.animT = 0;
        // 白黒演出 (グレースケール被弾)
        if (isChamp) {
          const tc = tgt as Champion;
          tc.monoUntil = this.time + 1.4;
          this.spawnMonoFx(tc);
        } else {
          // ミニオン等は白い粒子で代替
          this.particles.burst(tPos.x, 1.2, tPos.y, '#e8e8f0', 16, 3, 0.6, 0.4);
        }
        this.particles.burst(tPos.x, 1.5, tPos.y, '#ffffff', 30, 6.5, 0.6, 0.7);
        this.rings.spawn(tPos.x, tPos.y, '#ffffff', 3.4, 0.55, 1.2);
        if (c.isPlayer || (tgt as Champion).isPlayer) this.shake = Math.max(this.shake, 0.4);
        this.applyDamage(c, tgt, 1.25 * c.atk * atkMul, false);
        c.combo = null;
      }
      return;
    }

    // ---- R: ステライド (十角形の星路ダッシュ斎 → 魔法陣 → ビーム) ----
    const atkMul = 1 + c.buffs.reduce((a, b) => a + b.atkPct, 0) / 100;
    if (cb.phase < 10) {
      // 十角形の頂点を順番に回る (対角線を描くように・隣へは飛ばず2つ飛ばしで交差軌跡)
      const step2 = [0, 3, 6, 9, 2, 5, 8, 1, 4, 7]; // 十角形の対角線ジャンプ順
      const vi = step2[cb.phase];
      const a = (vi / 10) * Math.PI * 2 + Math.PI / 10;
      const R = 4.4;
      const px = tPos.x + Math.sin(a) * R;
      const pz = tPos.y + Math.cos(a) * R;
      // 星路の足跡 (前の位置からの光跡)
      this.beams.spawn(
        new THREE.Vector3(c.pos.x, 1.25, c.pos.y),
        new THREE.Vector3(px, 1.25, pz),
        '#ffe66a', 0.6, 0.13,
      );
      this.rings.spawn(px, pz, '#ffe66a', 1.5, 0.5, 0.25);
      this.teleportStella(c, px, pz);
      c.facing = Math.atan2(tPos.x - px, tPos.y - pz);
      c.anim = 'attack'; c.animT = 0;
      slashFx(false);
      this.applyDamage(c, tgt, 0.26 * c.atk * atkMul, false);
      cb.phase += 1;
      cb.nextAt = this.time + 0.11;
    } else if (cb.phase === 10) {
      // 納刀 → 敵の下に大魔法陣
      this.teleportStella(c, tPos.x - 2.4, tPos.y + 2.4);
      c.facing = Math.atan2(tPos.x - c.pos.x, tPos.y - c.pos.y);
      c.anim = 'cast'; c.animT = 0;
      this.rings.spawn(tPos.x, tPos.y, '#ffe66a', 5.6, 1.0, 0.18);
      this.rings.spawn(tPos.x, tPos.y, '#fff8d0', 3.8, 0.85, 0.14);
      this.rings.spawn(tPos.x, tPos.y, '#ffffff', 2.2, 0.7, 0.1);
      // 十角形のルーンパーティクル
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
        this.particles.burst(tPos.x + Math.sin(a) * 4.7, 0.3, tPos.y + Math.cos(a) * 4.7, '#ffe66a', 3, 1.6, 0.8, 0.4);
      }
      this.particles.burst(tPos.x, 0.4, tPos.y, '#fff8d0', 30, 4.5, 0.9, 0.9);
      this.sfx('rage-charge');
      if (c.isPlayer) this.shake = Math.max(this.shake, 0.35);
      cb.phase = 11;
      cb.nextAt = this.time + 0.5;
    } else {
      // 天に向かってビーム！！
      const beamCol = '#fff4b0';
      this.beams.spawn(new THREE.Vector3(tPos.x, 0.1, tPos.y), new THREE.Vector3(tPos.x, 16, tPos.y), beamCol, 0.85, 0.34);
      this.beams.spawn(new THREE.Vector3(tPos.x, 0.1, tPos.y), new THREE.Vector3(tPos.x, 16, tPos.y), '#ffffff', 0.7, 0.16);
      this.particles.burst(tPos.x, 1.2, tPos.y, '#ffe66a', 46, 8, 1.0, 1.2);
      this.particles.burst(tPos.x, 2.4, tPos.y, '#ffffff', 24, 5, 0.8, 1.0);
      this.rings.spawn(tPos.x, tPos.y, '#ffffff', 4.4, 0.6, 0.2);
      if (c.isPlayer || (tgt as Champion).isPlayer) this.shake = Math.max(this.shake, 0.6);
      this.sfx('tower');
      // 最後の一撃 (範囲内まとめて)
      this.aoeDamage(c, tPos.clone(), 3.0, 1.35 * c.atk * atkMul, 0, 0);
      if (c.isPlayer) {
        this.o.onEvent?.({ type: 'announce', text: 'ステライド・フィニッシュ！！', sub: '星の裁きを受けなさい！', color: '#ffe66a' });
      }
      c.combo = null;
    }
  }

  /** 白黒 (グレースケール) 演出: 灰色の殻を被せる */
  private spawnMonoFx(c: Champion) {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 14, 12),
      new THREE.MeshBasicMaterial({ color: '#d8d8e0', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    shell.position.set(c.pos.x, 1.0, c.pos.y);
    this.scene.add(shell);
    this.monoFx.push({ champ: c, mesh: shell, until: this.time + 1.4 });
    this.particles.burst(c.pos.x, 1.3, c.pos.y, '#ffffff', 18, 3.5, 0.5, 0.6);
    this.particles.burst(c.pos.x, 1.3, c.pos.y, '#303038', 10, 3, 0.5, 0.6);
  }

  private monoFx: { champ: Champion; mesh: THREE.Mesh; until: number }[] = [];

  private updateMonoFx(dt: number) {
    for (let i = this.monoFx.length - 1; i >= 0; i--) {
      const fx = this.monoFx[i];
      if (fx.until <= this.time || fx.champ.dead) {
        this.scene.remove(fx.mesh);
        (fx.mesh.material as THREE.Material).dispose();
        fx.mesh.geometry.dispose();
        this.monoFx.splice(i, 1);
        continue;
      }
      fx.mesh.position.set(fx.champ.pos.x, 1.0, fx.champ.pos.y);
      const k = Math.min(1, (fx.until - this.time) / 0.4);
      (fx.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * k;
      fx.mesh.scale.setScalar(1 + Math.sin(this.time * 14) * 0.03);
    }
    void dt;
  }

  /** ステラの負荷メータ満タン: 360度剣舞 (剣が自分の周りを曲がるように攻撃) */
  private doStellaSpin(c: Champion) {
    c.anger = 0;
    const atkMul = 1 + c.buffs.reduce((a, b) => a + b.atkPct, 0) / 100;
    const R = 4.6;
    // 剣の軌跡 (渦を巻くように4周分の光弧)
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 6;
      const r = 1.2 + (i / 40) * 3.2;
      this.particles.burst(c.pos.x + Math.sin(a) * r, 1.1 + Math.sin(i * 0.8) * 0.5, c.pos.y + Math.cos(a) * r, i % 2 ? '#ffe66a' : '#ffffff', 2, 1.1, 0.55, 0.3);
    }
    this.rings.spawn(c.pos.x, c.pos.y, '#ffe66a', R, 0.55, 0.5);
    this.rings.spawn(c.pos.x, c.pos.y, '#ffffff', R * 0.62, 0.42, 1.0);
    this.sfx('rage');
    if (c.isPlayer) this.shake = Math.max(this.shake, 0.42);
    c.anim = 'attack'; c.animT = 0;
    c.lastCombat = this.time;
    this.aoeDamage(c, c.pos.clone(), R, 1.75 * c.atk * atkMul, 0, 0);
    if (c.isPlayer) {
      this.o.onEvent?.({ type: 'announce', text: '星剣円舞！！', sub: '負荷MAX！ 360度の剣舞が炸裂！', color: '#ffe66a' });
    }
  }

  private updateRemoteChamp(c: Champion, _dt: number) {
    // 位置はネットワーク受信で更新済み。攻撃は相手側でシミュレート。
    // 権威側は受信した fx / champDmg イベントで処理
    void c;
  }

  // ==========================================================
  // ミニオン
  // ==========================================================

  private updateWaves() {
    if (this.time < this.nextWaveAt) return;
    this.nextWaveAt = this.time + 20;
    this.waveNum++;
    if (this.minions.filter((m) => !m.dead).length > 64) return;
    const scale = 1 + this.time / 420;
    for (const team of ['blue', 'red'] as Team[]) {
      const startT = team === 'blue' ? 0.035 : 0.965;
      // 3レーン各々にウェーブ出撃 (2近接+1遠隔)
      for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
        const p = lanePoint(startT, lane);
        const tan = laneTangent(startT, lane);
        const perp = new THREE.Vector2(tan.z, -tan.x);
        for (let i = 0; i < 3; i++) {
          const kind: 'melee' | 'ranged' = i < 2 ? 'melee' : 'ranged';
          const hp = Math.round((kind === 'melee' ? 460 : 270) * scale);
          const mesh = this.makeMinionMesh(team, kind === 'ranged');
          const lat = (i - 1) * 1.7;
          const spawn = new THREE.Vector2(p.x, p.z).add(perp.clone().multiplyScalar(lat));
          mesh.position.set(spawn.x, 0, spawn.y);
          this.scene.add(mesh);
          this.minions.push({
            id: `${team[0]}m${this.waveNum}_${lane[0]}${i}`, team, kind,
            pos: spawn, hp, maxHp: hp,
            atk: kind === 'melee' ? 15 : 24, atkRange: kind === 'melee' ? 1.8 : 6.5,
            atkCd: 0, atkSpeed: 1.0,
            lane, pathT: startT, lateral: lat,
            targetId: null, anim: 'run', animT: 0, dead: false, deadAt: 0, mesh,
          });
        }
      }
    }
  }

  private updateMinion(m: Minion, dt: number) {
    // ターゲット選択
    if (!m.targetId || this.time % 1 < dt) {
      m.targetId = this.findMinionTarget(m);
    }
    const tgt = this.resolveEntity(m.targetId);
    const speed = m.kind === 'melee' ? 4.6 : 4.2;

    if (tgt && !tgt.dead) {
      const d = dist2(m.pos, tgt.pos) - (tgt.maxHp > 1500 ? 2.2 : 0.6);
      if (d <= m.atkRange) {
        if (m.anim === 'run') m.anim = 'idle';
        if (m.atkCd <= 0) {
          m.atkCd = 1 / m.atkSpeed;
          const src = { team: m.team, id: m.id } as unknown as Champion;
          const dmg = m.atk;
          if (tgt.maxHp > 1500) {
            // タワー攻撃ビーム
            this.beams.spawn(new THREE.Vector3(m.pos.x, 1.2, m.pos.y), new THREE.Vector3(tgt.pos.x, 4, tgt.pos.y), TEAM_HEX[m.team]);
          }
          this.applyDamage(src, tgt, dmg, false);
        }
      } else if (this.mapDef.platforms && !this.isWalkableMine(
        m.pos.x + ((tgt.pos.x - m.pos.x) / Math.max(0.01, dist2(m.pos, tgt.pos))) * speed * dt,
        m.pos.y + ((tgt.pos.y - m.pos.y) / Math.max(0.01, dist2(m.pos, tgt.pos))) * speed * dt,
      )) {
        // 廃坑: 追跡の一歩が奈落なら追わない (レーン前進に戻る・ターゲットは保持)
        m.targetId = null;
        m.anim = 'run';
      } else {
        const dx = tgt.pos.x - m.pos.x, dz = tgt.pos.y - m.pos.y;
        const dd = Math.hypot(dx, dz);
        m.pos.x += (dx / dd) * speed * dt;
        m.pos.y += (dz / dd) * speed * dt;
        m.mesh.rotation.y = Math.atan2(dx / dd, dz / dd);
        m.anim = 'run';
      }
    } else {
      // レーン前進 (自レーンのスプラインに沿って)
      const dir = m.team === 'blue' ? 1 : -1;
      m.pathT += (dir * speed * dt) / 64;
      m.pathT = Math.max(0, Math.min(1, m.pathT));
      const p = lanePoint(m.pathT, m.lane);
      const tan = laneTangent(m.pathT, m.lane);
      const targetPos = new THREE.Vector2(p.x + tan.z * m.lateral, p.z - tan.x * m.lateral);
      const dx = targetPos.x - m.pos.x, dz = targetPos.y - m.pos.y;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.2) {
        m.pos.x += (dx / dd) * speed * dt;
        m.pos.y += (dz / dd) * speed * dt;
        m.mesh.rotation.y = Math.atan2(dx / dd, dz / dd);
      }
      m.anim = 'run';
      m.targetId = null;
    }
    m.atkCd = Math.max(0, m.atkCd - dt);
    this.resolveWalls(m.pos, 0.4);
    this.animateMinionMesh(m, dt);
  }

  private animateMinionMesh(m: Minion, dt: number) {
    m.animT += dt;
    const bob = m.anim === 'run' ? Math.abs(Math.sin(m.animT * 10)) * 0.12 : Math.sin(m.animT * 2) * 0.03;
    m.mesh.position.set(m.pos.x, bob, m.pos.y);
  }

  private findMinionTarget(m: Minion): string | null {
    let best: string | null = null;
    let bestD = 8.5;
    // ミニオン優先
    for (const o of this.minions) {
      if (o.team === m.team || o.dead) continue;
      const d = dist2(m.pos, o.pos);
      if (d < bestD) { bestD = d; best = o.id; }
    }
    if (best) return best;
    bestD = 7;
    for (const c of this.champs) {
      if (c.team === m.team || c.dead) continue;
      const d = dist2(m.pos, c.pos);
      if (d < bestD) { bestD = d; best = c.id; }
    }
    if (best) return best;
    bestD = 9;
    for (const s of this.structures) {
      if (s.team === m.team || s.dead) continue;
      const d = dist2(m.pos, s.pos);
      if (d < bestD) { bestD = d; best = s.id; }
    }
    return best;
  }

  private resolveEntity(id: string | null): Champion | Minion | Structure | Neutral | Pet | null {
    if (!id) return null;
    for (const c of this.champs) if (c.id === id) return c;
    for (const m of this.minions) if (m.id === id) return m;
    for (const s of this.structures) if (s.id === id) return s;
    for (const n of this.neutrals) if (n.id === id) return n;
    for (const pt of this.pets) if (pt.id === id) return pt;
    return null;
  }

  private cleanupMinions() {
    // 実際の除去は updateCorpses (昇天フェード完了時) が行う。ここは安全ネット。
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      if (m.dead && this.time - m.deadAt > 12) {
        this.scene.remove(m.mesh);
        this.disposeMinionMats(m);
        this.minions.splice(i, 1);
      }
    }
  }

  /** 死亡フェード用に複製したマテリアルだけ解放 (共有ジオメトリは解放しない) */
  private disposeMinionMats(m: Minion) {
    m.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mm = o.material as THREE.MeshStandardMaterial;
        if (mm && mm !== Battle.minionMatCache.get(`${m.team[0]}${m.kind === 'ranged' ? 'r' : 'm'}`)?.cloth
          && mm !== Battle.minionMatCache.get(`${m.team[0]}${m.kind === 'ranged' ? 'r' : 'm'}`)?.metal
          && mm !== Battle.minionMatCache.get(`${m.team[0]}${m.kind === 'ranged' ? 'r' : 'm'}`)?.glow) {
          mm.dispose();
        }
      }
    });
  }

  /** ミニオン死体: 5秒は倒れたまま、以降は天使のように浮上しながらフェードアウト */
  private updateCorpses() {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      if (!m.dead) continue;
      const t = this.time - m.deadAt;
      if (t < 5) continue;
      const p = Math.min(1, (t - 5) / 1.4);
      if (!m.halo) {
        // 昇天開始: 黄金色の光环
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.07, 6, 24),
          new THREE.MeshBasicMaterial({
            color: 0xffe9a0, transparent: true, opacity: 0.95,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        halo.rotation.x = Math.PI / 2;
        this.scene.add(halo);
        m.halo = halo;
        this.particles.burst(m.pos.x, 1, m.pos.y, '#ffe9a0', 14, 2.6, 1.0, 1.4);
      }
      const ease = p * p * (3 - 2 * p);
      const y = ease * 3.0;
      m.mesh.position.set(m.pos.x, y, m.pos.y);
      m.mesh.rotation.x = (Math.PI / 2) * (1 - ease);
      const op = 1 - p;
      m.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mm = o.material as THREE.MeshStandardMaterial;
          if (mm && mm.transparent) mm.opacity = op;
        }
      });
      m.halo.position.set(m.pos.x, y + 2.2, m.pos.y);
      m.halo.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08);
      (m.halo.material as THREE.MeshBasicMaterial).opacity = 0.95 * op;
      if (p >= 1) {
        this.scene.remove(m.mesh);
        this.scene.remove(m.halo);
        m.halo.geometry.dispose();
        (m.halo.material as THREE.Material).dispose();
        m.halo = undefined;
        this.disposeMinionMats(m);
        this.minions.splice(i, 1);
      }
    }
  }

  // ==========================================================
  // タワー
  // ==========================================================

  private updateTower(s: Structure, dt: number) {
    s.atkCd = Math.max(0, s.atkCd - dt);
    if (s.atkCd > 0) return;
    // ミニオン優先 → チャンピオン
    let target: Minion | Champion | null = null;
    let bestD = 13;
    for (const m of this.minions) {
      if (m.team === s.team || m.dead) continue;
      const d = dist2(s.pos, m.pos);
      if (d < bestD) { bestD = d; target = m; }
    }
    if (!target) {
      for (const c of this.champs) {
        if (c.team === s.team || c.dead) continue;
        const d = dist2(s.pos, c.pos);
        if (d < bestD) { bestD = d; target = c; }
      }
    }
    if (!target) return;
    s.atkCd = 1.1;
    this.beams.spawn(new THREE.Vector3(s.pos.x, 6.5, s.pos.y), new THREE.Vector3(target.pos.x, 1.2, target.pos.y), TEAM_HEX[s.team]);
    this.particles.burst(target.pos.x, 1.2, target.pos.y, TEAM_HEX[s.team], 10, 5, 0.5);
    const src = { team: s.team, id: s.id } as unknown as Champion;
    this.applyDamage(src, target, 95, false);
  }

  // ==========================================================
  // ニュートラル
  // ==========================================================

  private updateNeutrals(dt: number) {
    for (const n of this.neutrals) {
      if (n.dead) {
        if (this.time >= n.respawnAt) {
          n.dead = false;
          n.hp = n.maxHp;
          n.mesh.visible = true;
          this.particles.burst(n.pos.x, 1, n.pos.y, '#b08aff', 24, 6, 0.8);
        }
        continue;
      }
      // 攻撃してきたチャンピオンに反撃
      n.atkCd = Math.max(0, n.atkCd - dt);
      const attacker = this.champs.find((c) => !c.dead && c.team !== (n as unknown as { team?: Team }).team && dist2(c.pos, n.pos) < 12
        && (c.lastCombat > this.time - 2 && dist2(c.pos, n.pos) < c.range + 3));
      if (attacker && n.atkCd <= 0) {
        n.atkCd = 1.6;
        this.beams.spawn(new THREE.Vector3(n.pos.x, 1.6, n.pos.y), new THREE.Vector3(attacker.pos.x, 1.2, attacker.pos.y), '#b08aff');
        const src = { team: (n as unknown as { team?: Team }).team ?? (attacker.team === 'blue' ? 'red' : 'blue'), id: n.id } as unknown as Champion;
        this.applyDamage(src, attacker, 55, false);
      }
      n.mesh.rotation.y += dt * 0.4;
      n.mesh.position.y = Math.sin(this.time * 1.8) * 0.12;
    }
  }

  // ==========================================================
  // ダメージ & キル
  // ==========================================================

  private applyDamage(
    src: Champion | { team: Team; id: string },
    tgt: Champion | Minion | Structure | Neutral | Pet,
    rawDmg: number,
    _crit: boolean,
    slowPct = 0, slowDur = 0,
    stunDur = 0,
    cowerDur = 0,
  ) {
    if ((tgt as Minion).dead) return;
    const srcChamp = this.champs.find((c) => c.id === src.id);
    let dmg = rawDmg;

    // オンライン: 自分が権威でない & ターゲットが相手側シミュレート対象 → イベント送信のみ
    const tgtChamp = tgt as Champion;
    const isChamp = this.champs.includes(tgtChamp);
    if (isChamp) {
      const tc = tgtChamp;
      // お昼寝睡眠中は無敵 (ダメージ0・気絶も無効)
      if (tc.sleepUntil > this.time) {
        this.particles.burst(tc.pos.x, 1.6, tc.pos.y, '#c8f0ff', 5, 2, 0.5, 0.3);
        return;
      }
      if (tc.isRemote) {
        // 相手チャンピオン: 権威のみ計算
        if (!this.authority) return;
      } else if (!tc.isPlayer) {
        // bot味方: ローカルでOK
      }
      if (tc.isPlayer && this.authority === false) {
        // 非権威側の自分: 相手(権威)からのイベントで処理 → ここは自分の攻撃時のみ来る(相手チャンピオン以外)のでスルー
      }
      // アーマー軽減
      dmg = dmg * (100 / (100 + tc.armor));
      if (tc.guardHeld) dmg *= 0.35;
      // シールド
      if (tc.shield > 0) {
        const absorbed = Math.min(tc.shield, dmg);
        tc.shield -= absorbed;
        dmg -= absorbed;
      }
      tc.hp -= dmg;
      tc.lastCombat = this.time;
      // フリル: 被弾で怒り蓄積 (リモートはオーナー側で処理)
      if (!tc.isRemote) this.onFrillDamaged(tc, dmg);
      // 気絶
      if (stunDur > 0) this.applyStun(tc, stunDur);
      if (cowerDur > 0) this.applyCower(tc, cowerDur);
      // 打撃音 (プレイヤー関係のみ・スパム防止)
      if ((srcChamp?.isPlayer || tc.isPlayer) && this.time - this.lastHitSfx > 0.09) {
        this.lastHitSfx = this.time;
        this.sfx('hit');
      }
      // 攻撃者/被弾者を一時公開 (草むら戦でも体力が見えるように)
      if (srcChamp) {
        if (srcChamp.revealUntil < this.time + 1.2) srcChamp.revealUntil = this.time + 1.2;
        if (tc.revealUntil < this.time + 1.2) tc.revealUntil = this.time + 1.2;
      }
      if (slowPct > 0) { tc.slowPct = slowPct; tc.slowUntil = this.time + slowDur; }
      if (srcChamp) srcChamp.lastCombat = this.time;
      if (srcChamp) {
        this.registerDamager(tc, srcChamp.id);
        // ステラ: ダメージを与えるごとに負荷が溜まる (満タンで360度剣舞)
        if (srcChamp.def.id === 'stella' && dmg > 0 && !srcChamp.dead) {
          srcChamp.anger = Math.min(100, srcChamp.anger + dmg * 0.075);
        }
      }

      if (tc.isPlayer) {
        this.resultStats.damage += Math.round(dmg);
        if (this.o.cameraShake && dmg > 40) this.shake = Math.max(this.shake, 0.25);
      }
      this.o.onEvent?.({ type: 'dmg', x: tc.pos.x, y: 2.2, z: tc.pos.y, amount: Math.round(dmg) });
      if (this.net && !tc.isRemote) {
        // 自分チャンピオンがダメージを受けた → 相手に通知不要(相手側はイベントで受ける)
      }
      if (tc.isRemote && this.net) {
        // そのチャンプのオーナーへダメージ通知 (オーナー側で自分のHPを確定)
        const myPid = this.o.myPid ?? '';
        this.pendingNetEvents.push({ t: 'champDmg', pid: tc.ownerPid ?? '', from: myPid, amt: Math.round(dmg), stun: stunDur > 0 ? stunDur : undefined, cower: cowerDur > 0 ? cowerDur : undefined });
        if (tc.hp <= 0) this.pendingNetEvents.push({ t: 'champKill', pid: tc.ownerPid ?? '', from: myPid });
      }
      if (tc.hp <= 0) this.killChampion(tc, srcChamp);
      return;
    }

    // ミニオン/構造物/ニュートラル/召喚獣
    const t = tgt as Minion | Structure | Neutral;
    // 召喚獣 (猟犬): 攻撃可能・倒されると消える
    const pet = this.pets.find((p) => p.id === (t as { id?: string }).id);
    if (pet) {
      if (this.net && !this.authority) {
        this.pendingNetEvents.push({ t: 'dmg', id: pet.id, amt: Math.round(dmg), kill: dmg >= pet.hp });
      }
      pet.hp -= dmg;
      this.particles.burst(pet.pos.x, 0.9, pet.pos.y, '#4ff0d0', 4, 2, 0.35);
      if (pet.hp <= 0) {
        pet.dead = true;
        this.particles.burst(pet.pos.x, 0.8, pet.pos.y, '#4ff0d0', 26, 5, 0.9, 0.6);
        this.scene.remove(pet.mesh);
        this.pets = this.pets.filter((p) => p !== pet);
        this.sfx('petdown');
      }
      return;
    }
    if (this.net && !this.authority) {
      // 非権威: 権威側エンティティへのダメージを送信
      this.pendingNetEvents.push({ t: 'dmg', id: (t as { id: string }).id, amt: Math.round(dmg), kill: dmg >= t.hp });
    }
    t.hp -= dmg;
    if (srcChamp) {
      srcChamp.lastCombat = this.time;
      // ステラ: ミニオン等へのダメージでも負荷が溜まる (倍率低め)
      if (srcChamp.def.id === 'stella' && dmg > 0 && !srcChamp.dead) {
        srcChamp.anger = Math.min(100, srcChamp.anger + dmg * 0.045);
      }
      // CS & ゴールド
      if (t.hp <= 0 && (t as Minion).kind) {
        srcChamp.cs += 1;
        const g = (t as Minion).kind === 'melee' ? 21 : 17;
        srcChamp.gold += g;
        this.grantXpToNearbyChamps(t.pos, 25, srcChamp.team);
      }
    }
    if (t.hp <= 0) {
      if ((t as Minion).kind) {
        // ミニオン死亡 → 死体になり、5秒後に昇天フェードで消える
        const m = t as Minion;
        m.dead = true;
        m.deadAt = this.time;
        m.animT = 0;
        this.beginMinionFade(m);
        if (srcChamp?.isPlayer) this.o.onEvent?.({ type: 'gold', amount: 0 });
        this.particles.burst(m.pos.x, 0.8, m.pos.y, TEAM_HEX[m.team], 14, 4, 0.5);
      } else if ((t as Structure).type) {
        const st = t as Structure;
        this.killStructure(st, srcChamp);
      } else {
        // ニュートラル
        const n = t as Neutral;
        n.dead = true;
        n.respawnAt = this.time + 90;
        n.mesh.visible = false;
        this.particles.burst(n.pos.x, 1.4, n.pos.y, '#b08aff', 50, 9, 1.0);
        if (srcChamp) {
          srcChamp.gold += 150;
          this.applyBuff(srcChamp, { speedPct: 15, atkPct: 15, duration: 75 }, 'エーテルバフ');
          if (srcChamp.isPlayer) {
            this.o.onEvent?.({ type: 'announce', text: 'エーテルバフ獲得！', sub: '攻撃力・移動速度アップ (75秒)', color: '#b08aff' });
          }
          this.grantXpToNearbyChamps(n.pos, 80, srcChamp.team);
        }
      }
    }
  }

  private registerDamager(victim: Champion, damagerId: string) {
    victim.lastDamagers = victim.lastDamagers.filter((d) => this.time - d.t < 10 && d.id !== damagerId);
    victim.lastDamagers.push({ id: damagerId, t: this.time });
  }

  private grantXpToNearbyChamps(pos: THREE.Vector2, xp: number, killTeam: Team) {
    for (const c of this.champs) {
      if (c.team !== killTeam || c.dead) continue;
      if (dist2(c.pos, pos) < 15) this.gainXpImpl(c, xp);
    }
  }

  private killChampion(victim: Champion, killer?: Champion) {
    victim.dead = true;
    victim.hp = 0;
    victim.deaths++;
    victim.spree = 0;
    victim.respawnAt = this.time + 6 + victim.level * 1.8;
    victim.rig.anim = 'dead';
    victim.rig.deadT = 0;
    victim.dashing = null;
    victim.combo = null;
    victim.monoUntil = 0;
    this.particles.burst(victim.pos.x, 1.2, victim.pos.y, TEAM_HEX[victim.team], 50, 9, 1.0);
    this.rings.spawn(victim.pos.x, victim.pos.y, TEAM_HEX[victim.team], 5, 1.0);
    // 天使になって昇天しながら消える
    this.spawnAngel(victim.pos.x, victim.pos.y);

    if (killer) {
      killer.kills++;
      killer.spree++;
      const bounty = 300 + killer.spree * 50;
      killer.gold += bounty;
      this.gainXpImpl(killer, 120 + victim.level * 30);
      // アシスト
      for (const d of victim.lastDamagers) {
        if (d.id === killer.id) continue;
        const a = this.champs.find((c) => c.id === d.id);
        if (a && a.team === killer.team) {
          a.assists++;
          a.gold += 150;
        }
      }
      this.teamKills[killer.team]++;
      // キルフィード & アナウンス
      const feed = { type: 'killfeed', killer: killer.name, victim: victim.name, killerTeam: killer.team, victimTeam: victim.team } as const;
      if (!this.firstBlood) {
        this.firstBlood = true;
        this.o.onEvent?.({ ...feed, firstBlood: true });
        this.o.onEvent?.({ type: 'announce', text: 'ファーストブラッド！', color: '#ff4d6d' });
      } else {
        this.o.onEvent?.(feed);
        if (killer.spree === 3) this.o.onEvent?.({ type: 'announce', text: 'キリングスプリー！', color: '#ffb02e' });
        else if (killer.spree === 5) this.o.onEvent?.({ type: 'announce', text: 'レジェンダリー！', color: '#ff4d6d' });
      }
      if (killer.isPlayer) {
        this.resultStats.kills = killer.kills;
      }
      this.sfx(victim.isPlayer ? 'death' : 'kill');
      if (victim.isPlayer) {
        this.resultStats.deaths = victim.deaths;
        this.o.onEvent?.({ type: 'announce', text: 'やられた…', sub: `${Math.ceil(victim.respawnAt - this.time)}秒後にリスポーン`, color: '#8a93b8' });
      }
    }
    if (victim.isPlayer) {
      this.resultStats.deaths = victim.deaths;
    }
  }

  private killStructure(s: Structure, killer?: Champion) {
    s.dead = true;
    s.mesh.visible = false;
    if (s.rangeRing) s.rangeRing.visible = false;
    this.particles.burst(s.pos.x, 3, s.pos.y, TEAM_HEX[s.team], 80, 12, 1.4);
    this.rings.spawn(s.pos.x, s.pos.y, '#ffffff', 8, 1.2);
    if (this.o.cameraShake) this.shake = 0.7;
    if (s.type === 'tower') {
      if (killer) killer.gold += 250;
      if (killer?.isPlayer || (killer === undefined && s.team !== this.player.team)) {
        this.resultStats.towers++;
      }
      if (s.team !== this.player.team) {
        this.o.onEvent?.({ type: 'announce', text: 'タワーを破壊！', sub: '+250ゴールド', color: '#ffb02e' });
        this.sfx('tower');
      } else {
        this.o.onEvent?.({ type: 'announce', text: 'タワーが破壊された…', color: '#8a93b8' });
        this.sfx('tower-lose');
      }
      this.grantXpToNearbyChamps(s.pos, 100, s.team === 'blue' ? 'red' : 'blue');
    } else {
      // ネクサス陥落 → 試合終了
      this.endMatch(s.team !== this.player.team);
    }
  }

  private gainXpImpl(c: Champion, xp: number) {
    if (c.level >= 18) return;
    c.xp += xp;
    while (c.xp >= c.xpNeed && c.level < 18) {
      c.xp -= c.xpNeed;
      c.level++;
      c.xpNeed = 180 + c.level * 90;
      c.maxHp += 85; c.hp += 85;
      c.atk += 5;
      c.armor += 1.5;
      c.hpRegen += 0.2;
      c.rig.root.scale.setScalar(1 + (c.level - 1) * 0.012);
      if (c.isPlayer) {
        this.rings.spawn(c.pos.x, c.pos.y, '#ffd86a', 3.5, 0.9);
        this.particles.burst(c.pos.x, 1.5, c.pos.y, '#ffd86a', 30, 6, 0.9);
        this.o.onEvent?.({ type: 'levelup', level: c.level });
      }
    }
  }

  // ==========================================================
  // 弾
  // ==========================================================

  private spawnProjectile(p: {
    owner: Champion; team: Team;
    from: THREE.Vector3; dir: THREE.Vector2;
    speed: number; dmg: number;
    shape: ProjShape; color: string; glow: GlowType;
    aoe: number; isSkill: boolean;
    slowPct?: number; slowDur?: number; stunDur?: number; cowerDur?: number;
    homingId?: string | null; maxDist?: number;
  }) {
    const mesh = makeProjectileMesh(p.shape, p.color, p.glow, p.isSkill ? 1.25 : 1);
    mesh.position.copy(p.from);
    // 進行方向を向かせる
    mesh.rotation.y = Math.atan2(p.dir.x, p.dir.y);
    this.scene.add(mesh);
    // 軽量化: 弾ごとのPointLightは廃止 (ライト数の変動がシェーダ再コンパイルと
    // フラグメントコストのスパイクを引き起こす最大の要因)。発光メッシュ+Bloomで発光表現
    this.projSeq++;
    const proj: Projectile = {
      id: `p${this.projSeq}`, team: p.team, ownerId: p.owner.id,
      pos: p.from.clone(), dir: p.dir.clone(), speed: p.speed,
      dmg: p.dmg, shape: p.shape, color: p.color, glow: p.glow,
      aoe: p.aoe, slowPct: p.slowPct ?? 0, slowDur: p.slowDur ?? 0,
      stunDur: p.stunDur ?? 0, cowerDur: p.cowerDur ?? 0,
      homingId: p.homingId ?? null, isSkill: p.isSkill, visualOnly: false,
      life: p.maxDist ? p.maxDist / p.speed : 2.5,
      mesh,
    };
    this.projectiles.push(proj);
  }

  spawnVisualProjectile(shape: ProjShape, color: string, glow: GlowType, x: number, z: number, dx: number, dz: number, speed: number, team: Team) {
    const mesh = makeProjectileMesh(shape, color, glow, 1.25);
    mesh.position.set(x, 1.3, z);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.scene.add(mesh);
    const id = `np${this.projSeq++}`;
    this.netProjectiles.set(id, mesh);
    const proj: Projectile = {
      id, team, ownerId: 'remote', pos: new THREE.Vector3(x, 1.3, z),
      dir: new THREE.Vector2(dx, dz), speed, dmg: 0, shape, color, glow,
      aoe: 0, slowPct: 0, slowDur: 0, stunDur: 0, cowerDur: 0, homingId: null, isSkill: true,
      visualOnly: true, life: 2, mesh,
    };
    this.projectiles.push(proj);
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      // ホーミング
      if (pr.homingId) {
        const tgt = this.resolveEntity(pr.homingId);
        if (tgt && !(tgt as Minion).dead) {
          pr.dir.set(tgt.pos.x - pr.pos.x, tgt.pos.y - pr.pos.z).normalize();
        }
      }
      pr.pos.x += pr.dir.x * pr.speed * dt;
      pr.pos.z += pr.dir.y * pr.speed * dt;
      pr.pos.y = 1.3 + Math.sin(this.time * 20 + i) * 0.06;
      // 壁に当たったら消滅 (視覚弾は壁で消えない)
      if (!pr.visualOnly && this.pointInWall(pr.pos.x, pr.pos.z, 0.35)) {
        this.particles.burst(pr.pos.x, 1.2, pr.pos.z, pr.color, 10, 4, 0.45);
        this.killProjectile(pr, i);
        continue;
      }
      pr.mesh.position.copy(pr.pos);
      pr.mesh.rotation.y = Math.atan2(pr.dir.x, pr.dir.y);
      const spin = (pr.mesh as unknown as { _spin: number })._spin;
      pr.mesh.rotation.x = spin + this.time * 6;
      pr.mesh.rotation.z = this.time * 4;
      // キラキラの軌跡
      if (Math.random() < (this.gfx === 'ultimate' ? 0.9 : 0.5)) {
        this.particles.burst(pr.pos.x, pr.pos.y, pr.pos.z, pr.glow === 'white' ? pr.color : '#8a4dff', 1, 0.8, 0.3, 0.1);
      }
      // ヒット判定
      if (!pr.visualOnly && this.authority) {
        let hit = false;
        for (const c of this.champs) {
          if (c.team === pr.team || c.dead) continue;
          if (distXZ(pr.pos, c.pos) < 1.1) {
            const owner = this.champs.find((ch) => ch.id === pr.ownerId);
            this.applyDamage(owner ?? { team: pr.team, id: 'x' }, c, pr.dmg, false, pr.slowPct, pr.slowDur, pr.stunDur, pr.cowerDur);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const m of this.minions) {
            if (m.team === pr.team || m.dead) continue;
            if (distXZ(pr.pos, m.pos) < 0.95) {
              const owner = this.champs.find((ch) => ch.id === pr.ownerId);
              this.applyDamage(owner ?? { team: pr.team, id: 'x' }, m, pr.dmg, false);
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const s of this.structures) {
            if (s.team === pr.team || s.dead) continue;
            if (distXZ(pr.pos, s.pos) < 2.6) {
              const owner = this.champs.find((ch) => ch.id === pr.ownerId);
              this.applyDamage(owner ?? { team: pr.team, id: 'x' }, s, pr.dmg, false);
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const n of this.neutrals) {
            if (n.dead) continue;
            if (distXZ(pr.pos, n.pos) < 1.4) {
              const owner = this.champs.find((ch) => ch.id === pr.ownerId);
              this.applyDamage(owner ?? { team: pr.team, id: 'x' }, n, pr.dmg, false);
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const pt of this.pets) {
            if (pt.team === pr.team || pt.dead) continue;
            if (distXZ(pr.pos, pt.pos) < 1.0) {
              const owner = this.champs.find((ch) => ch.id === pr.ownerId);
              this.applyDamage(owner ?? { team: pr.team, id: 'x' }, pt, pr.dmg, false);
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          this.particles.burst(pr.pos.x, pr.pos.y, pr.pos.z, pr.color, 14, 5, 0.5);
          this.killProjectile(pr, i);
          continue;
        }
      }
      if (pr.life <= 0 || Math.abs(pr.pos.x) > 80 || Math.abs(pr.pos.z) > 80) {
        this.killProjectile(pr, i);
      }
    }
  }

  private killProjectile(pr: Projectile, idx: number) {
    this.scene.remove(pr.mesh);
    this.projectiles.splice(idx, 1);
    if (this.netProjectiles.has(pr.id)) this.netProjectiles.delete(pr.id);
  }

  // ==========================================================
  // マップギミック: お昼寝ベッド / 電車 / 大波 / エーテルオーブ
  // ==========================================================

  private updateGimmicks(dt: number) {
    this.updateBeds(dt);
    if (this.mapDef.gimmick === 'trains') this.updateTrains(dt);
    if (this.mapDef.gimmick === 'wave') this.updateRiverWave(dt);
    if (this.mapDef.gimmick === 'orbs') this.updateOrbs(dt);
    if (this.mapDef.gimmick === 'mine') { this.updateMinecart(dt); this.updateOreVeins(dt); }
  }

  // ==========================================================
  // 廃坑ギミック: 奈落落下 / 暴走トロッコ / 銀鉱脈
  // ==========================================================

  private mineWalkSamples: { x: number; z: number }[] | null = null;
  private mineLaneLen = 0;
  /** 廃坑ナビ用グリッド (1セル=1m, 構築は1回だけ。落下判定ではなく経路計画専用) */
  private mineGrid: Uint8Array | null = null;
  private static readonly MINE_GRID_N = 124;   // [-62, 62] を 1m セルでカバー
  private static readonly MINE_GRID_OFF = 62;

  /** 廃坑: ナビ用グリッドを事前計算 (レーン橋 + 足場 + 桟道・+0.4m のマージン付き) */
  private buildMineGrid() {
    if (!this.mapDef.platforms) return;
    if (!this.mineWalkSamples) {
      this.mineWalkSamples = [...LANE_SAMPLES.top, ...LANE_SAMPLES.mid, ...LANE_SAMPLES.bot];
      let L = 0;
      const a = LANE_SAMPLES.mid;
      for (let i = 1; i < a.length; i++) L += Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z);
      this.mineLaneLen = L || 120;
    }
    const n = Battle.MINE_GRID_N;
    const grid = new Uint8Array(n * n);
    // マージン付き判定 (ナビ計画をやや楽観的にして、橋の角での引っかかりを防ぐ)
    const BR = 3.45 + 0.4, br2 = BR * BR;
    const samples = this.mineWalkSamples;
    const platforms = this.mapDef.platforms;
    const walkways = this.mapDef.walkways ?? [];
    for (let gz = 0; gz < n; gz++) {
      const z = gz - Battle.MINE_GRID_OFF;
      for (let gx = 0; gx < n; gx++) {
        const x = gx - Battle.MINE_GRID_OFF;
        let ok = false;
        for (let i = 0; i < samples.length; i++) {
          const dx = x - samples[i].x, dz = z - samples[i].z;
          if (dx * dx + dz * dz < br2) { ok = true; break; }
        }
        if (!ok) {
          for (let i = 0; i < platforms.length; i++) {
            const p = platforms[i];
            const dx = x - p.x, dz = z - p.z;
            if (dx * dx + dz * dz < (p.r + 0.4) * (p.r + 0.4)) { ok = true; break; }
          }
        }
        if (!ok) {
          for (let i = 0; i < walkways.length; i++) {
            const wk = walkways[i];
            const vx = wk.x2 - wk.x1, vz = wk.z2 - wk.z1;
            const l2 = vx * vx + vz * vz || 1;
            const t = Math.max(0, Math.min(1, ((x - wk.x1) * vx + (z - wk.z1) * vz) / l2));
            const dx = x - (wk.x1 + vx * t), dz = z - (wk.z1 + vz * t);
            const hw = wk.w / 2 + 0.2 + 0.4;
            if (dx * dx + dz * dz < hw * hw) { ok = true; break; }
          }
        }
        grid[gz * n + gx] = ok ? 1 : 0;
      }
    }
    this.mineGrid = grid;
  }

  /** 廃坑: 点が歩行可能領域 (橋/足場/桟道) の上か — 落下判定はこちら (連続・正確) */
  private isWalkableMine(x: number, z: number): boolean {
    if (!this.mapDef.platforms) return true;
    if (!this.mineWalkSamples) {
      this.mineWalkSamples = [...LANE_SAMPLES.top, ...LANE_SAMPLES.mid, ...LANE_SAMPLES.bot];
      let L = 0;
      const a = LANE_SAMPLES.mid;
      for (let i = 1; i < a.length; i++) L += Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z);
      this.mineLaneLen = L || 120;
    }
    // レーン橋の上 (見た目の半幅3.3 + 手すり際の許容)
    const BR = 3.45;
    const br2 = BR * BR;
    for (let i = 0; i < this.mineWalkSamples.length; i++) {
      const s = this.mineWalkSamples[i];
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < br2) return true;
    }
    // 足場 (円形の岩棚)
    for (const p of this.mapDef.platforms) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < p.r * p.r) return true;
    }
    // 桟道
    for (const wk of this.mapDef.walkways ?? []) {
      const vx = wk.x2 - wk.x1, vz = wk.z2 - wk.z1;
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - wk.x1) * vx + (z - wk.z1) * vz) / l2));
      const dx = x - (wk.x1 + vx * t), dz = z - (wk.z1 + vz * t);
      const hw = wk.w / 2 + 0.2;
      if (dx * dx + dz * dz < hw * hw) return true;
    }
    return false;
  }

  /** 廃坑ナビ: 2点間の直線が (グリッド上) ほぼ歩行可能か — 経路計画専用の高速判定 */
  private lineWalkableMine(x1: number, z1: number, x2: number, z2: number): boolean {
    if (!this.mineGrid) this.buildMineGrid();
    const grid = this.mineGrid;
    if (!grid) return true;
    const n = Battle.MINE_GRID_N;
    const d = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(2, Math.ceil(d / 0.55));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = Math.floor(x1 + (x2 - x1) * t + Battle.MINE_GRID_OFF);
      const gz = Math.floor(z1 + (z2 - z1) * t + Battle.MINE_GRID_OFF);
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) return false;
      if (grid[gz * n + gx] === 0) return false;
    }
    return true;
  }

  /**
   * 廃坑ボット経路: 直線で行けない目標なら「歩行可能な中継点」を選ぶ。
   * dist(自分→候補) + dist(候補→目標) が最小のサンプルを返す (橋をたどるグリーディ経路)。
   */
  private mineWaypoint(x: number, z: number, gx: number, gz: number): { x: number; z: number } | null {
    if (!this.mineGrid) this.buildMineGrid();
    const cands: { x: number; z: number }[] = [];
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      for (const s of LANE_SAMPLES[lane]) cands.push(s);
    }
    for (const p of this.mapDef.platforms ?? []) cands.push({ x: p.x, z: p.z });
    for (const wk of this.mapDef.walkways ?? []) {
      cands.push({ x: wk.x1, z: wk.z1 }, { x: wk.x2, z: wk.z2 }, { x: (wk.x1 + wk.x2) / 2, z: (wk.z1 + wk.z2) / 2 });
    }
    let bx = 0, bz = 0, bd = Infinity, found = false;
    for (const s of cands) {
      const dSelf = Math.hypot(s.x - x, s.z - z);
      if (dSelf < 1.2) continue;                                 // 今いる位置は無意味
      const dGoal = Math.hypot(gx - s.x, gz - s.z);
      const total = dSelf + dGoal;
      if (total >= bd) continue;
      if (!this.lineWalkableMine(x, z, s.x, s.z)) continue;      // 自分から直行できる候補のみ
      bd = total; bx = s.x; bz = s.z; found = true;
    }
    return found ? { x: bx, z: bz } : null;
  }

  /** 廃坑: 最も近い歩行可能地点 (落下時に戻される場所) */
  private nearestWalkableMine(x: number, z: number): { x: number; z: number } {
    let bx = 0, bz = 0, bd = Infinity;
    const consider = (px: number, pz: number) => {
      const d = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d < bd) { bd = d; bx = px; bz = pz; }
    };
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      for (const s of LANE_SAMPLES[lane]) consider(s.x, s.z);
    }
    for (const p of this.mapDef.platforms ?? []) consider(p.x, p.z);
    for (const wk of this.mapDef.walkways ?? []) consider((wk.x1 + wk.x2) / 2, (wk.z1 + wk.z2) / 2);
    return { x: bx, z: bz };
  }

  /** 廃坑: 足場の外にいると奈落へ落下 (600ダメージ + 最寄りの足場へ) */
  private updateMineFalls(dt: number) {
    // チャンピオン: 重力加速で奈落へ落ちる → 最寄りの足場へ救出
    for (const c of this.champs) {
      if (c.dead) continue;
      if (c.fallingUntil > this.time) {
        const remain = c.fallingUntil - this.time;
        // 重力っぽい放物線: 最初はゆっくり、だんだん加速して落ちる (k²で加速)
        const k = 1 - Math.max(0, remain) / 0.9;
        c.rootY = -FALL_DEPTH * k * k;
        // 落下中: 岩屑が舞い上がる (落ちてる感を出すストリーク)
        if (Math.random() < dt * 22) {
          this.particles.burst(
            c.pos.x + (Math.random() - 0.5) * 1.4, c.rootY + 1.4 + Math.random() * 1.2, c.pos.y + (Math.random() - 0.5) * 1.4,
            Math.random() < 0.5 ? '#8a7aa8' : '#5c5470', 2, 2.6, 0.5, 0.85,
          );
        }
        if (remain <= dt) {
          // 救出: 最寄りの足場へ転送 (着地の砂煙 + リング)
          const p = this.nearestWalkableMine(c.pos.x, c.pos.y);
          c.pos.set(p.x, p.z);
          c.rootY = 0;
          this.particles.burst(p.x, 0.6, p.z, '#c8a878', 26, 5.5, 0.75);
          this.particles.burst(p.x, 0.3, p.z, '#ffcf8a', 10, 3, 0.5, 1.2);
          this.rings.spawn(p.x, p.z, '#ffb86a', 3.4, 0.8);
          if (c.isPlayer) this.sfx('rescue');
        }
        continue;
      }
      // オンラインの相手チャンピオンはオーナー側で処理
      if (c.isRemote && this.net) continue;
      if (this.isWalkableMine(c.pos.x, c.pos.y)) continue;
      // 落下開始: 600ダメージ (鎧・シールド無視の奈落ダメージ)
      c.fallingUntil = this.time + 0.9;
      c.combo = null;
      c.shield = 0;
      c.hp -= 600;
      // 足場の縁が崩れる砂煙
      this.particles.burst(c.pos.x, 0.8, c.pos.y, '#8a7aa8', 30, 5, 0.8, 0.7);
      this.particles.burst(c.pos.x, 0.4, c.pos.y, '#4a4258', 14, 3, 0.9, 0.5);
      this.o.onEvent?.({ type: 'dmg', x: c.pos.x, y: 1.6, z: c.pos.y, amount: 600 });
      if (c.isPlayer) {
        if (this.o.cameraShake) this.shake = Math.max(this.shake, 0.55);
        this.o.onEvent?.({ type: 'announce', text: '奈落へ落下！', sub: '600ダメージ… 橋の上を歩こう', color: '#ff8a5c' });
        this.sfx('fall');
      } else if (this.isVisibleToPlayer(c)) {
        // 視認できる敵/味方が落ちた: 小さな風切り音
        this.sfx('fall-soft');
      }
      if (c.hp <= 0) {
        // 奈落落ちで倒された: 橋の上へ移してから死亡処理 (天使が橋の上から昇天)
        const p = this.nearestWalkableMine(c.pos.x, c.pos.y);
        c.pos.set(p.x, p.z);
        c.rootY = 0;
        c.fallingUntil = 0;
        c.hp = 0;
        this.killChampion(c, undefined);
      }
    }
    // ミニオン: 足場の外は即落下死 (縁から崩れ落ちる砂煙だけ残す)
    for (const m of this.minions) {
      if (m.dead) continue;
      if (this.isWalkableMine(m.pos.x, m.pos.y)) continue;
      this.particles.burst(m.pos.x, 0.6, m.pos.y, '#6a6278', 8, 2.6, 0.6, 0.9);
      this.applyDamage({ team: m.team === 'blue' ? 'red' : 'blue', id: 'fall' }, m, 600, false);
    }
    // 召喚獣 (猟犬): 主人の位置へワープ
    for (const pt of this.pets) {
      if (pt.dead) continue;
      if (this.isWalkableMine(pt.pos.x, pt.pos.y)) continue;
      const owner = this.champs.find((c) => c.id === pt.ownerId);
      if (owner) pt.pos.copy(owner.pos);
    }
  }

  private cart: { t: number; dir: 1 | -1; mesh: THREE.Group; wheels: THREE.Mesh[]; hitIds: string[] } | null = null;
  private cartDir: 1 | -1 = 1;
  private cartSpawnAt = 15;
  private cartWarned = false;
  private cartAnnounced = false;

  /** 廃坑: 暴走トロッコが中央の橋を爆走 (警告→通過→ダメージ+ノックバック) */
  private updateMinecart(dt: number) {
    const len = this.mineLaneLen || 120;
    if (!this.cart) {
      if (!this.cartWarned && this.time >= this.cartSpawnAt - 2.4) {
        this.cartWarned = true;
        this.warnText = 'トロッコが暴走中！ 中央の橋から離れて！';
        this.sfx('horn');
        for (const t of [0.04, 0.96]) {
          const p = lanePoint(t, 'mid');
          this.rings.spawn(p.x, p.z, '#ffb347', 5, 1.2);
        }
        if (!this.cartAnnounced) {
          this.cartAnnounced = true;
          this.o.onEvent?.({ type: 'announce', text: '暴走トロッコが来る！', sub: '中央の橋の上は危険！', color: '#ffb347' });
        }
      }
      if (this.time >= this.cartSpawnAt) {
        const dir = this.cartDir;
        this.cartDir = (this.cartDir === 1 ? -1 : 1) as 1 | -1;
        const built = this.buildMinecartMesh();
        this.cart = { t: dir === 1 ? 0 : 1, dir, mesh: built.mesh, wheels: built.wheels, hitIds: [] };
        this.scene.add(this.cart.mesh);
        this.warnText = null;
        this.sfx('horn');
      }
      return;
    }
    // 移動 (30 units/s)
    const dir = this.cart.dir;
    this.cart.t += (dt * 30 / len) * dir;
    const tp = Math.max(0, Math.min(1, this.cart.t));
    const c0 = lanePoint(tp, 'mid');
    const c1 = lanePoint(Math.max(0, Math.min(1, tp + dir * 0.012)), 'mid');
    this.cart.mesh.position.set(c0.x, 0.12, c0.z);
    this.cart.mesh.rotation.y = Math.atan2(c1.x - c0.x, c1.z - c0.z);
    for (const w of this.cart.wheels) w.rotation.x += dt * 22 * dir;
    // 走行風パーティクル + ゆらぐ鉱石の光
    if (Math.random() < dt * 22) {
      this.particles.burst(c0.x, 0.7, c0.z, '#ffd88a', 2, 2.6, 0.45, 0.4);
    }
    // 通過完了
    if ((dir === 1 && this.cart.t >= 1.04) || (dir === -1 && this.cart.t <= -0.04)) {
      this.scene.remove(this.cart.mesh);
      this.cart = null;
      this.cartSpawnAt = this.time + 20;
      this.cartWarned = false;
      return;
    }
    // ダメージ判定 (権威のみ・レール上の全員)
    if (!this.authority) return;
    const cartPos = new THREE.Vector2(c0.x, c0.z);
    const cartDmg = 240 + this.time * 0.35;
    for (const e of this.champs) {
      if (e.dead || this.cart.hitIds.includes(e.id)) continue;
      if (dist2(e.pos, cartPos) > 2.5) continue;
      this.cart.hitIds.push(e.id);
      // 進行方向に弾き飛ばされる (橋の上なので安全側へ)
      const tx = c1.x - c0.x, tz = c1.z - c0.z;
      const tl = Math.hypot(tx, tz) || 1;
      e.pos.x += (tx / tl) * 3.2;
      e.pos.y += (tz / tl) * 3.2;
      this.clampToMap(e.pos);
      this.applyDamage({ team: e.team === 'blue' ? 'red' : 'blue', id: 'cart' }, e, cartDmg, false, 0, 0, 0.9);
      this.particles.burst(e.pos.x, 1.4, e.pos.y, '#ffd88a', 18, 5, 0.7);
      if (e.isPlayer && this.o.cameraShake) this.shake = Math.max(this.shake, 0.5);
    }
    for (const m of this.minions) {
      if (m.dead || this.cart.hitIds.includes(m.id)) continue;
      if (dist2(m.pos, cartPos) > 2.2) continue;
      this.cart.hitIds.push(m.id);
      this.applyDamage({ team: m.team === 'blue' ? 'red' : 'blue', id: 'cart' }, m, cartDmg, false);
    }
  }

  /** 暴走トロッコのメッシュ (木製・光る鉱石積み) */
  private buildMinecartMesh(): { mesh: THREE.Group; wheels: THREE.Mesh[] } {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2e2e38, metalness: 0.5, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 1.35), wood);
    body.position.y = 0.72;
    body.castShadow = true;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.16, 1.43), dark);
    rim.position.y = 1.16;
    const oreM = new THREE.MeshStandardMaterial({ color: 0xffc95c, emissive: 0xffb347, emissiveIntensity: 2.0, roughness: 0.4 });
    const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), oreM);
    ore.position.y = 1.35;
    ore.scale.y = 0.75;
    // 擬似ライト (加算スプライト) — トロッコ移動に合わせて動く光だまり
    const glow = makeGlowSprite(0xffb347, 0.16, 7.2);
    glow.position.y = 0.1;
    glow.matrixAutoUpdate = true; // トロッコと一緒に動く
    g.add(body, rim, ore, glow);
    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10);
    wheelGeo.rotateZ(Math.PI / 2); // 車軸をX方向へ (回転はX軸周り)
    for (const [wx, wz] of [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]]) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.position.set(wx, 0.26, wz);
      g.add(wheel);
      wheels.push(wheel);
    }
    return { mesh: g, wheels };
  }

  private static ORE_SPOTS = [
    { x: 10, z: -32 }, { x: -10, z: 32 }, { x: -29, z: 3 }, { x: 28, z: -6 },
  ];
  private ores: { x: number; z: number; mesh: THREE.Group; active: boolean; respawnAt: number }[] = [];
  private nextOreAt = 12;
  private oreAnnounced = false;

  /** 廃坑: 銀鉱脈 (触れると+90ゴールド。一定時間で再出現) */
  private updateOreVeins(dt: number) {
    if (this.ores.length === 0) {
      for (const sp of Battle.ORE_SPOTS) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffc95c, emissive: 0xffb347, emissiveIntensity: 2.0,
          metalness: 0.3, roughness: 0.35,
        });
        for (let i = 0; i < 3; i++) {
          const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.34 - i * 0.07, 0), mat);
          c.position.set(Math.sin(i * 2.1) * 0.32, 0.5 + i * 0.22, Math.cos(i * 2.1) * 0.32);
          g.add(c);
        }
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.68, 0.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x3a3342, roughness: 0.95 }),
        );
        base.position.y = 0.1;
        // 擬似ライト (加算スプライト) — ライト数を増やさず鉱脈の輝きを表現
        const glow = makeGlowSprite(0xffb347, 0.1, 5);
        glow.position.y = 0.12;
        g.add(base, glow);
        g.position.set(sp.x, 0, sp.z);
        g.visible = false;
        this.scene.add(g);
        this.ores.push({ x: sp.x, z: sp.z, mesh: g, active: false, respawnAt: 0 });
      }
    }
    if (this.time >= this.nextOreAt) {
      this.nextOreAt = Infinity;
      for (const o of this.ores) {
        if (!o.active) { o.active = true; o.mesh.visible = true; }
      }
      if (!this.oreAnnounced) {
        this.oreAnnounced = true;
        this.o.onEvent?.({ type: 'announce', text: '銀鉱脈が出現！', sub: 'ジャングルの足場に +90ゴールド', color: '#ffb347' });
      }
    }
    for (const o of this.ores) {
      if (!o.active) continue;
      o.mesh.rotation.y += dt * 1.2;
      o.mesh.children[1].position.y = 0.5 + Math.sin(this.time * 2.4) * 0.1;
      const tryTake = (c: Champion) => {
        if (c.dead) return false;
        if (dist2(c.pos, new THREE.Vector2(o.x, o.z)) > 1.9) return false;
        o.active = false;
        o.mesh.visible = false;
        o.respawnAt = this.time + 40;
        this.nextOreAt = Math.min(this.nextOreAt, this.time + 40);
        c.gold += 90;
        this.particles.burst(o.x, 1.0, o.z, '#ffd88a', 30, 6, 0.9);
        this.rings.spawn(o.x, o.z, '#ffd86a', 3, 0.7);
        this.sfx('pickup');
        if (c.isPlayer) {
          this.o.onEvent?.({ type: 'announce', text: '銀鉱脈を発掘！', sub: '+90 ゴールド', color: '#ffd86a' });
          this.o.onEvent?.({ type: 'gold', amount: 90 });
        }
        return true;
      };
      if (tryTake(this.player)) continue;
      if (this.authority) {
        for (const c of this.champs) {
          if (c.isPlayer || c.isRemote) continue;
          if (tryTake(c)) break;
        }
      }
    }
  }

  /** ステーション: 急行電車が線路を爆走 (警告→通過→ダメージ+気絶) */
  private updateTrains(dt: number) {
    if (!this.train) {
      // 警告フェーズ (2.8秒前): 踏切警報 + 汽笛
      if (!this.trainWarned && this.time >= this.trainSpawnAt - 2.8) {
        this.trainWarned = true;
        this.warnText = '急行電車接近！ 線路から離れて！';
        this.sfx('horn');
        for (const t of [0.25, 0.75]) {
          const p = railPoint(t);
          this.rings.spawn(p.x, p.z, '#ff4a5c', 6, 1.4);
        }
        if (!this.trainAnnounced) {
          this.trainAnnounced = true;
          this.o.onEvent?.({ type: 'announce', text: '急行電車が通過する！', sub: '線路上は即死級！ 警告灯に注意', color: '#ffb02e' });
        }
      }
      if (this.time >= this.trainSpawnAt) {
        const dir = this.trainDir;
        this.trainDir = (this.trainDir === 1 ? -1 : 1) as 1 | -1;
        this.train = { t: dir === 1 ? 0 : 1, dir, mesh: this.buildTrainMesh(dir) };
        this.scene.add(this.train.mesh);
        this.warnText = null;
      }
      return;
    }
    // 移動 (42 units/s)
    const dir = this.train.dir;
    this.train.t += (dt * 42 / RAIL_LEN) * dir;
    const tp = Math.max(0, Math.min(1, this.train.t));
    const c0 = railPoint(tp);
    const d = railPoint(Math.max(0, Math.min(1, tp + dir * 0.01)));
    this.train.mesh.position.set(c0.x, 0.3, c0.z);
    this.train.mesh.rotation.y = Math.atan2(d.x - c0.x, d.z - c0.z);
    // 走行風パーティクル
    if (Math.random() < dt * 30) {
      this.particles.burst(c0.x, 0.6, c0.z, '#d8dce8', 2, 3, 0.5, 0.4);
    }
    // 通過完了
    if ((dir === 1 && this.train.t >= 1 + 0.05) || (dir === -1 && this.train.t <= -0.05)) {
      this.scene.remove(this.train.mesh);
      this.train = null;
      this.trainSpawnAt = this.time + 24;
      this.trainWarned = false;
      return;
    }
    // ダメージ判定 (権威のみ・線路上の全員が巻き込まれる)
    if (!this.authority) return;
    const halfSpan = 8.4 / RAIL_LEN; // 3両分の長さの半分
    const spanMin = Math.min(tp, tp + dir * halfSpan * 2);
    const spanMax = Math.max(tp, tp + dir * halfSpan * 2);
    const hitByTrain = (pos: THREE.Vector2): number | null => {
      // 線路への最短距離 + 沿道パラメータで列車範囲内か
      const dx = pos.x - c0.x, dz = pos.y - c0.z;
      const dlen = Math.hypot(dx, dz);
      if (dlen > 10) return null;
      const along = ((pos.x - railPoint(0).x) * (railPoint(1).x - railPoint(0).x) + (pos.y - railPoint(0).z) * (railPoint(1).z - railPoint(0).z)) / (RAIL_LEN * RAIL_LEN);
      const perp = Math.abs((pos.x - c0.x) * -(d.z - c0.z) + (pos.y - c0.z) * (d.x - c0.x));
      if (perp > 2.4) return null;
      if (along < spanMin || along > spanMax) return null;
      return perp;
    };
    const trainDmg = 320 + this.time * 0.5;
    for (const e of this.champs) {
      if (e.dead) continue;
      if (hitByTrain(e.pos) === null) continue;
      this.applyDamage({ team: e.team === 'blue' ? 'red' : 'blue', id: 'train' }, e, trainDmg, false, 0, 0, 1.4);
      // 線路の外側へ弾き飛ばす
      const rx = e.pos.x - c0.x, rz = e.pos.y - c0.z;
      const rl = Math.hypot(rx, rz) || 1;
      e.pos.x += (rx / rl) * 3.2;
      e.pos.y += (rz / rl) * 3.2;
      this.clampToMap(e.pos);
      this.particles.burst(e.pos.x, 1.4, e.pos.y, '#ff5a6a', 20, 6, 0.7);
      if (e.isPlayer && this.o.cameraShake) this.shake = 0.6;
    }
    for (const m of this.minions) {
      if (m.dead) continue;
      if (hitByTrain(m.pos) === null) continue;
      this.applyDamage({ team: m.team === 'blue' ? 'red' : 'blue', id: 'train' }, m, trainDmg, false);
    }
  }

  /** 急行電車のメッシュ (3両・発光窓・前照灯) */
  private buildTrainMesh(dir: 1 | -1): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dde8, metalness: 0.55, roughness: 0.35 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2a3a8a, metalness: 0.4, roughness: 0.4 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x7ce8ff, emissiveIntensity: 2.2, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(5.1, 2.2, 2.4), bodyMat);
      car.position.set((i - 1) * 5.5, 1.35, 0);
      car.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.14, 0.4, 2.44), stripeMat);
      stripe.position.set((i - 1) * 5.5, 0.85, 0);
      const win = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.62, 2.46), winMat);
      win.position.set((i - 1) * 5.5, 1.75, 0);
      g.add(car, stripe, win);
    }
    // 先頭のライト (進行方向)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2cc, emissiveIntensity: 3.2 }),
    );
    head.position.set(dir === 1 ? 8.6 : -8.6, 1.1, 0);
    // 擬似ライト (加算スプライト) — ヘッドライトの光だまり
    const hlight = makeGlowSprite(0xfff2cc, 0.3, 14);
    hlight.position.set(dir === 1 ? 9.8 : -9.8, 0.12, 0);
    hlight.matrixAutoUpdate = true;
    g.add(head, hlight);
    // パンタグラフ
    const pg = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 4), stripeMat);
    pg.position.set(0, 2.9, 0);
    g.add(pg);
    return g;
  }

  /** リゾート: 川を駆け上がるビッグウェーブ (ダメージ+減速+押し流し) */
  private updateRiverWave(dt: number) {
    if (!this.wave) {
      if (!this.waveWarned && this.time >= this.nextWaveSpawnAt - 2.5) {
        this.waveWarned = true;
        this.warnText = 'ビッグウェーブ接近！ 川から離れて！';
        this.sfx('horn');
        if (!this.waveAnnounced) {
          this.waveAnnounced = true;
          this.o.onEvent?.({ type: 'announce', text: 'ビッグウェーブ来襲！', sub: '川にいると押し流される！', color: '#4fd8ff' });
        }
      }
      if (this.time >= this.nextWaveSpawnAt) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x7ce8ff, transparent: true, opacity: 0.62,
          emissive: 0x4fd8ff, emissiveIntensity: 0.8,
          roughness: 0.15, metalness: 0.3,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(11, 2.3, 1.1), mat);
        this.scene.add(mesh);
        this.wave = { t: 0, mesh, hitIds: [] };
        this.warnText = null;
        this.sfx('splash');
      }
      return;
    }
    // 川を西→東へ 6.5秒で流れる
    this.wave.t += dt / 6.5;
    if (this.wave.t >= 1.05) {
      this.scene.remove(this.wave.mesh);
      (this.wave.mesh.material as THREE.Material).dispose();
      this.wave = null;
      this.nextWaveSpawnAt = this.time + 32;
      this.waveWarned = false;
      return;
    }
    const t = Math.max(0, Math.min(1, this.wave.t));
    const p0 = riverPoint(t);
    const p1 = riverPoint(Math.min(1, t + 0.02));
    this.wave.mesh.position.set(p0.x, 1.0 + Math.sin(this.time * 9) * 0.15, p0.z);
    this.wave.mesh.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    this.wave.mesh.scale.y = 1 + Math.sin(this.time * 7) * 0.18;
    if (Math.random() < dt * 24) {
      this.particles.burst(p0.x, 1.2, p0.z, '#bff4ff', 3, 3.5, 0.6, 0.5);
    }
    // ダメージ (権威のみ): 川の近くにいると押し流される
    if (!this.authority) return;
    const tanx = p1.x - p0.x, tanz = p1.z - p0.z;
    const tanl = Math.hypot(tanx, tanz) || 1;
    for (const e of this.champs) {
      if (e.dead) continue;
      if (this.wave!.hitIds.includes(e.id)) continue;
      if (dist2(e.pos, new THREE.Vector2(p0.x, p0.z)) > 5.2) continue;
      this.wave!.hitIds.push(e.id);
      this.applyDamage({ team: e.team === 'blue' ? 'red' : 'blue', id: 'wave' }, e, 230 + this.time * 0.3, false, 35, 2);
      e.pos.x += (tanx / tanl) * 3.4;
      e.pos.y += (tanz / tanl) * 3.4;
      this.clampToMap(e.pos);
      this.particles.burst(e.pos.x, 1.4, e.pos.y, '#7ce8ff', 18, 5, 0.7);
      if (e.isPlayer && this.o.cameraShake) this.shake = 0.4;
    }
    for (const m of this.minions) {
      if (m.dead) continue;
      if (dist2(m.pos, new THREE.Vector2(p0.x, p0.z)) > 4.6) continue;
      this.applyDamage({ team: m.team === 'blue' ? 'red' : 'blue', id: 'wave' }, m, 240, false);
    }
  }

  private static ORB_SPOTS = [
    { x: 0, z: 12 }, { x: -36, z: -28 }, { x: 36, z: 28 },
  ];

  /** 戦場: エーテルオーブ (取ると移動+攻撃バフのキューブ) */
  private updateOrbs(dt: number) {
    // 初回: スポットにメッシュ生成
    if (this.orbs.length === 0) {
      for (const sp of Battle.ORB_SPOTS) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: 0x8a6cff, emissive: 0x9a7aff, emissiveIntensity: 2.2,
          metalness: 0.3, roughness: 0.25,
        });
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat);
        core.position.y = 1.6;
        const base = new THREE.Mesh(
          new THREE.RingGeometry(1.0, 1.35, 24),
          new THREE.MeshBasicMaterial({ color: 0x9a7aff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        );
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.12;
        // 擬似ライト (加算スプライト) — オーブ出現中だけ見える光だまり
        const glow = makeGlowSprite(0x9a7aff, 0.16, 7.7);
        glow.position.y = 0.1;
        g.add(core, base, glow);
        g.position.set(sp.x, 0, sp.z);
        g.visible = false;
        this.scene.add(g);
        this.orbs.push({ x: sp.x, z: sp.z, mesh: g, active: false, respawnAt: 0 });
      }
    }
    if (this.time >= this.nextOrbAt) {
      // 出現後は取得されるまで次のリスポーンを待つ (毎フレーム再出現を防ぐ)
      this.nextOrbAt = Infinity;
      for (const o of this.orbs) {
        if (!o.active) {
          o.active = true;
          o.mesh.visible = true;
        }
      }
      if (!this.orbAnnounced) {
        this.orbAnnounced = true;
        this.o.onEvent?.({ type: 'announce', text: 'エーテルオーブ出現！', sub: '中央と両ジャングルに獲得バフ出現', color: '#9a7aff' });
      }
    }
    for (const o of this.orbs) {
      if (!o.active) continue;
      o.mesh.rotation.y += dt * 1.4;
      o.mesh.children[0].position.y = 1.6 + Math.sin(this.time * 2.2) * 0.2;
      // 取得判定: 自プレイヤー + 権威ならBotも
      const tryTake = (c: Champion) => {
        if (c.dead) return false;
        if (dist2(c.pos, new THREE.Vector2(o.x, o.z)) > 1.9) return false;
        o.active = false;
        o.mesh.visible = false;
        o.respawnAt = this.time + 45;
        this.nextOrbAt = Math.min(this.nextOrbAt, this.time + 45);
        this.applyBuff(c, { speedPct: 15, atkPct: 15, duration: 60 }, 'エーテルオーブ');
        this.particles.burst(o.x, 1.6, o.z, '#9a7aff', 36, 7, 1.0);
        this.rings.spawn(o.x, o.z, '#9a7aff', 4, 0.9);
        this.sfx('pickup');
        if (c.isPlayer) {
          this.o.onEvent?.({ type: 'announce', text: 'エーテルオーブ獲得！', sub: '攻撃力・移動速度アップ (60秒)', color: '#9a7aff' });
        }
        return true;
      };
      if (tryTake(this.player)) continue;
      if (this.authority) {
        for (const c of this.champs) {
          if (c.isPlayer || c.isRemote) continue;
          if (tryTake(c)) break;
        }
      }
    }
  }

  // ==========================================================
  // カメラ
  // ==========================================================

  private camPos = new THREE.Vector3(0, 26, 14);
  /** 注視点 (スムージングされたカメラの向き) */
  private camLook = new THREE.Vector3(0, 1.2, 0);

  /** 死亡中のスペクテイター対象: 戦況 (敵に最も近い味方) を追う */
  private spectateTarget(): { x: number; z: number; name: string | null } {
    const p = this.player;
    if (this.spectateChamp && (this.spectateChamp.dead || this.time > this.spectateUntil)) this.spectateChamp = null;
    if (!this.spectateChamp) {
      let best: Champion | null = null;
      let bestScore = -Infinity;
      for (const a of this.champs) {
        if (a.dead || a.isPlayer) continue;
        // 味方を優先、味方が全員死んでいれば対戦相手/敵も観戦対象に
        if (a.team !== p.team && !a.ownerPid) continue;
        let nearestEnemyD = 999;
        for (const e of this.champs) {
          if (e.team === a.team || e.dead) continue;
          nearestEnemyD = Math.min(nearestEnemyD, dist2(a.pos, e.pos));
        }
        const score = -nearestEnemyD + (a.team === p.team ? 30 : 0);
        if (score > bestScore) { bestScore = score; best = a; }
      }
      this.spectateChamp = best;
      this.spectateUntil = this.time + 4;
    }
    if (this.spectateChamp) {
      return { x: this.spectateChamp.pos.x, z: this.spectateChamp.pos.y, name: this.spectateChamp.name };
    }
    // 誰も生きていない → 自陣ネクサス
    const own = this.structures.find((s) => s.team === p.team && s.type === 'nexus');
    return { x: own ? own.pos.x : p.pos.x, z: own ? own.pos.y : p.pos.y, name: null };
  }

  private updateCamera(dt: number) {
    const p = this.player;
    // スマホモードは少し引きで見やすく
    const mob = this.o.autoAttack ? 1 : 0;
    let tx = p.pos.x, tz = p.pos.y;
    let spectating = false;
    if (p.dead) {
      const st = this.spectateTarget();
      tx = st.x; tz = st.z;
      spectating = true;
    }

    // ---- 開戦前カメライントロ (残り8秒) ----
    // 8→5秒: 敵陣地をゆっくり旋回 / 5→1秒: 味方陣地 / 1→0: 自分の場所へ戻る
    if (this.time < this.startHoldAt && !p.dead) {
      const enemyN = NEXUS_POS[p.team === 'blue' ? 'red' : 'blue'];
      const ownN = NEXUS_POS[p.team];
      let cx: number, cz: number, lx: number, lz: number;
      if (this.time < 3) {
        // 敵陣地カメラ (8→5秒相当): ゆっくり移動しながら映す
        const k = this.time / 3;
        cx = enemyN.x - 13 + k * 5;
        cz = enemyN.z + 14 - k * 4;
        lx = enemyN.x; lz = enemyN.z;
      } else if (this.time < 7) {
        // 味方陣地 (5→1秒相当)
        const k = (this.time - 3) / 4;
        cx = ownN.x - 13 + k * 5;
        cz = ownN.z + 14 - k * 4;
        lx = ownN.x; lz = ownN.z;
      } else {
        // 最後の1秒: 自分の場所へ滑らかに戻る
        cx = p.pos.x; cz = p.pos.y + 13.8;
        lx = p.pos.x; lz = p.pos.y - 1.5;
      }
      const introPos = this.tmpV3a.set(cx, 23, cz);
      this.camPos.lerp(introPos, 1 - Math.exp(-2.4 * dt));
      this.camLook.lerp(this.tmpV3b.set(lx, 1.2, lz), 1 - Math.exp(-3.2 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    const targetPos = this.tmpV3a.set(tx, 25.5 + mob * 3.2, tz + 13.8 + mob * 1.8);
    const lookAt = this.tmpV3b.set(tx, 1.2, tz - 1.5);

    // ---- 一人称視線の管理 ----
    // 最大ズーム: キャラの向きへ滑らかに追従 / 一人称寄り: 手動見回し (マウス/なぞり) を優先
    const manualLook = document.pointerLockElement === this.o.canvas || this.time < this.lookTouchUntil;
    if (this.zoom >= 0.995) {
      this.viewYaw = Battle.angleLerp(this.viewYaw, p.facing, 1 - Math.exp(-10 * dt));
      this.viewPitch *= Math.exp(-6 * dt);
    } else if (!manualLook) {
      this.viewYaw = Battle.angleLerp(this.viewYaw, p.facing, 1 - Math.exp(-8 * dt));
    }

    // ---- 視野ズーム (1=最大視野 〜 0=一人称視点) ----
    if (this.zoom < 0.995) {
      const k = this.zoom;
      const ease = k * k * (3 - 2 * k);
      const cp = Math.cos(this.viewPitch);
      const dx = Math.sin(this.viewYaw) * cp;
      const dz = Math.cos(this.viewYaw) * cp;
      const ex = p.pos.x - dx * 0.12;
      const ez = p.pos.y - dz * 0.12;
      const lx2 = p.pos.x + dx * 10;
      const lz2 = p.pos.y + dz * 10;
      const ly = 1.35 + Math.sin(this.viewPitch) * 10;
      // lerpVectors相当をスカラーで (アロケーションなし)
      targetPos.set(ex + (targetPos.x - ex) * ease, 1.62 + (targetPos.y - 1.62) * ease, ez + (targetPos.z - ez) * ease);
      lookAt.set(lx2 + (lookAt.x - lx2) * ease, ly + (lookAt.y - ly) * ease, lz2 + (lookAt.z - lz2) * ease);
    }

    // ---- 奈落落下中: 注視点が落ちていく自分を追いかける (ちゃんと落ちてる風に見える) ----
    if (p.fallingUntil > this.time && !p.dead) {
      lookAt.y += p.rootY * 0.55;
      targetPos.y += p.rootY * 0.3;
    }

    // フレームレート非依存の指数平滑 (位置も注視点もガクつかない)
    const posRate = spectating ? 2 : this.zoom < 0.995 ? 10 : 5;
    this.camPos.lerp(targetPos, 1 - Math.exp(-posRate * dt));
    this.camLook.lerp(lookAt, 1 - Math.exp(-(spectating ? 4 : 9) * dt));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(this.camLook);
  }

  // ==========================================================
  // メッシュ同期 (構造物・ニュートラル)
  // ==========================================================

  private syncMeshes(_dt: number) {
    for (const s of this.structures) {
      if (s.gemMat) {
        s.gemMat.emissiveIntensity = s.dead ? 0 : 2.2 + Math.sin(this.time * 3) * 0.7;
      }
      if (s.rangeRing && s.rangeRing.visible === s.dead) s.rangeRing.visible = !s.dead;
    }
    // ファウンテンの脈動
    for (const f of this.fountainFx) {
      const pulse = 1 + Math.sin(this.time * 2.2) * 0.045;
      f.ring.scale.setScalar(pulse);
      (f.ring.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.sin(this.time * 2.2) * 0.16;
      (f.disc.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(this.time * 2.2 + 1) * 0.045;
      f.light.intensity = 12 + Math.sin(this.time * 2.2) * 4;
    }
  }

  // ==========================================================
  // ショップ
  // ==========================================================

  buyItem(item: ShopItem): boolean {
    const p = this.player;
    if (p.gold < item.cost) return false;
    p.gold -= item.cost;
    this.applyItem(p, item);
    this.rings.spawn(p.pos.x, p.pos.y, '#ffd86a', 2.5, 0.6);
    return true;
  }

  private applyItem(c: Champion, item: ShopItem) {
    c.items.push(item);
    const st = item.stats;
    c.atk += st.atk ?? 0;
    c.maxHp += st.hp ?? 0;
    c.hp += st.hp ?? 0;
    c.armor += st.armor ?? 0;
    c.speed += st.speed ?? 0;
    c.hpRegen += st.hpRegen ?? 0;
    c.atkSpeed += st.atkSpeed ?? 0;
    c.maxMana += st.mana ?? 0;
    c.mana += st.mana ?? 0;
  }

  /** ボットの自動購入: 買える中最も高いアイテムを購入 (賢いボット) */
  private botBuy(c: Champion) {
    if (c.gold < 500) return;
    const owned = c.items.length;
    if (owned >= 6) return;
    if (c.aiBuyAt > this.time) return;
    c.aiBuyAt = this.time + 0.5;
    const affordable = SHOP_ITEMS.filter((it) => it.cost <= c.gold);
    if (affordable.length === 0) return;
    // 価格が高い順 (強力なものから)
    affordable.sort((a, b) => b.cost - a.cost);
    // 同一アイテムは最大2個まで
    const pick = affordable.find((it) => c.items.filter((x) => x.id === it.id).length < 2);
    if (!pick) return;
    c.gold -= pick.cost;
    this.applyItem(c, pick);
  }

  addGold(g: number) {
    this.player.gold += g;
  }

  // ==========================================================
  // 指令 (ピン) システム: 6角形ホイールから味方へ指令を送る
  // ==========================================================

  sendPing(text: string) {
    this.o.onEvent?.({ type: 'ping', text, team: this.player.team, from: this.player.name });
    this.sfx('ping');
    if (this.net) {
      this.pendingNetEvents.push({ t: 'ping', text, team: this.player.team });
    }
  }

  surrender() {
    this.endMatch(false);
  }

  // ==========================================================
  // HUD
  // ==========================================================

  private buildHud(): HudSnapshot {
    const p = this.player;
    const mkTeam = (team: Team) => this.champs.filter((c) => c.team === team).map((c) => ({
      name: c.name, charId: c.def.id, k: c.kills, d: c.deaths, a: c.assists,
      level: c.level, gold: Math.floor(c.gold), isPlayer: c.isPlayer,
    }));
    const mkStructs = (team: Team) => this.structures.filter((s) => s.team === team).map((s) => ({
      id: s.id, type: s.type, hpPct: s.dead ? 0 : s.hp / s.maxHp,
    }));
    const nexus = (team: Team) => {
      const n = this.structures.find((s) => s.team === team && s.type === 'nexus');
      return { hp: n ? Math.max(0, n.hp) : 0, max: n ? n.maxHp : 1 };
    };
    return {
      hp: Math.max(0, Math.round(p.hp)), maxHp: Math.round(p.maxHp),
      mana: Math.round(p.mana), maxMana: Math.round(p.maxMana),
      shield: Math.round(p.shield),
      level: p.level, xp: Math.floor(p.xp), xpNeed: p.xpNeed,
      gold: Math.floor(p.gold),
      atk: Math.round(p.atk), armor: Math.round(p.armor),
      speed: Math.round(p.speed * 10) / 10, atkSpeed: Math.round(p.atkSpeed * 100) / 100,
      hpRegen: Math.round((p.hpRegen * 3 + p.level * 0.45) * 10) / 10,
      kda: { k: p.kills, d: p.deaths, a: p.assists },
      cs: p.cs,
      skills: p.def.skills.map((s, i) => ({
        slot: s.slot, name: s.name,
        // パルの召喚: 次のスタックまでの秒数をCDとして見せる
        cd: s.kind === 'summon'
          ? (p.charges > 0 ? 0 : Math.ceil(30 - p.chargeTimer))
          : Math.ceil(cdns(p, i)),
        cdMax: Math.round(s.cooldown),
        ready: s.kind === 'summon'
          ? p.charges > 0 && p.mana >= s.manaCost
          : cdns(p, i) <= 0 && p.mana >= s.manaCost,
        manaCost: s.manaCost,
      })),
      stacks: p.def.skills.map((s) => (s.kind === 'summon' ? p.charges : 0)),
      zoom: this.zoom,
      respawnIn: p.dead ? Math.max(0, Math.ceil(p.respawnAt - this.time)) : 0,
      startIn: this.time < this.startHoldAt ? Math.max(0, Math.ceil(this.startHoldAt - this.time)) : 0,
      inFountain: p.inFountain && !p.dead,
      spectateName: p.dead ? this.spectateChamp?.name ?? null : null,
      teamScore: { blue: this.teamKills.blue, red: this.teamKills.red },
      time: Math.floor(this.time),
      items: p.items.map((i) => i.id),
      buffs: p.buffs.map((b) => ({ name: b.name, t: Math.ceil(b.until - this.time) })),
      hidden: this.inBush(p.pos),
      fps: this.fps,
      anger: (p.def.id === 'frill' || p.def.id === 'stella') ? Math.round(p.anger) : 0,
      angerLabel: p.def.id === 'stella' ? '負荷' : '怒り',
      stunned: p.stunnedUntil > this.time ? Math.max(0, Math.round((p.stunnedUntil - this.time) * 10) / 10) : 0,
      cowered: p.coweredUntil > this.time ? Math.max(0, Math.round((p.coweredUntil - this.time) * 10) / 10) : 0,
      warn: this.warnText,
      teams: { blue: mkTeam('blue'), red: mkTeam('red') },
      structures: { blue: mkStructs('blue'), red: mkStructs('red') },
      nexusHp: { blue: nexus('blue').hp, red: nexus('red').hp, blueMax: nexus('blue').max, redMax: nexus('red').max },
    };

    function cdns(c: Champion, i: number) { return c.cooldowns[i]; }
  }

  getMinimapDots(): MiniDot[] {
    const dots: MiniDot[] = [];
    for (const c of this.champs) {
      const vis = c.team === this.player.team || this.isVisibleToPlayer(c);
      dots.push({ x: c.pos.x, z: c.pos.y, team: c.team, kind: 'champ', visible: vis, isPlayer: c.isPlayer, hidden: !vis });
    }
    for (const m of this.minions) {
      if (m.dead) continue;
      dots.push({ x: m.pos.x, z: m.pos.y, team: m.team, kind: 'minion', visible: m.team === this.player.team });
    }
    for (const s of this.structures) {
      if (s.dead) continue;
      dots.push({ x: s.pos.x, z: s.pos.y, team: s.team, kind: s.type === 'nexus' ? 'nexus' : 'tower', visible: true });
    }
    for (const n of this.neutrals) {
      if (n.dead) continue;
      dots.push({ x: n.pos.x, z: n.pos.y, kind: 'neutral', visible: true });
    }
    return dots;
  }

  getBushes() { return this.bushes; }

  // ==========================================================
  // 終了
  // ==========================================================

  private endMatch(win: boolean) {
    if (this.ended) return;
    this.ended = true;
    const p = this.player;
    // パッシブゴールド込み
    const minutes = Math.max(1, this.time / 60);
    void minutes;
    this.o.onEvent?.({
      type: 'end',
      result: {
        win,
        stats: {
          kills: p.kills, deaths: p.deaths, assists: p.assists, cs: p.cs,
          damage: this.resultStats.damage, towers: this.resultStats.towers,
          duration: Math.floor(this.time), charId: p.def.id,
          mapId: this.mapDef.id, win, mode: this.o.mode,
        },
        rewards: { playerExp: 0, coins: 0, bpExp: 0, trophiesUnlocked: [] },
      },
    });
    this.o.onEnd?.();
  }

  // ==========================================================
  // ネットワーク
  // ==========================================================

  private setupNet() {
    const net = this.net!;
    net.onChampion = (pid, s) => {
      const rc = this.remoteChamps.get(pid);
      if (!rc) return;
      this.applyRemoteState(rc, s);
    };
    net.onEvents = (pid, evs) => {
      for (const ev of evs) this.handleNetEvent(ev, pid);
    };
    net.onWorld = (snap) => {
      if (this.authority) return;
      // AI bot チャンプ同期 (authority がローカルAI実行分)
      if (snap.c) {
        for (const [bpid, x, z, hp, maxHp, lv, dead, anim, facing] of snap.c) {
          const bc = this.remoteChamps.get(bpid);
          if (!bc) continue;
          bc.pos.x += (x - bc.pos.x) * 0.45;
          bc.pos.y += (z - bc.pos.y) * 0.45;
          bc.facing = facing;
          bc.hp = hp; bc.maxHp = maxHp;
          bc.level = lv;
          bc.anim = anim;
          if (dead !== bc.dead) {
            if (dead) {
              this.killChampion(bc, undefined);
            } else {
              bc.dead = false;
              bc.hp = maxHp;
              bc.rig.root.visible = true;
            }
          }
          bc.rig.anim = anim as CharacterRig['anim'];
        }
      }
      // ミニオン同期
      for (const [id, x, z, hp, dead] of snap.m) {
        let m = this.minions.find((mm) => mm.id === id);
        if (!m && !dead) {
          // 新規ミニオン → 見た目だけ生成
          const team: Team = id[0] === 'b' ? 'blue' : 'red';
          const mesh = this.makeMinionMesh(team, id.includes('_1') || id.includes('_2'));
          this.scene.add(mesh);
          m = {
            id, team, kind: id.includes('_r') || id.includes('_2') ? 'ranged' : 'melee',
            lane: id.includes('_t') ? 'top' : id.includes('_m') ? 'mid' : 'bot',
            pos: new THREE.Vector2(x, z), hp, maxHp: hp, atk: 0, atkRange: 0,
            atkCd: 0, atkSpeed: 0, pathT: 0, lateral: 0, targetId: null,
            anim: 'run', animT: 0, dead: false, deadAt: 0, mesh,
          };
          this.minions.push(m);
        }
        if (m) {
          m.pos.set(x, z);
          m.hp = hp;
          if (dead && !m.dead) {
            m.dead = true;
            m.deadAt = this.time;
            m.mesh.rotation.x = Math.PI / 2;
            m.mesh.traverse((o) => {
              if (o instanceof THREE.Mesh) {
                const mm = o.material as THREE.MeshStandardMaterial;
                if (mm) { mm.transparent = true; }
              }
            });
          }
          this.animateMinionMesh(m, 0.016);
        }
      }
      // 構造物HP
      for (const [id, hp] of snap.s) {
        const s = this.structures.find((ss) => ss.id === id);
        if (s && !s.dead && hp <= 0) {
          s.hp = 0;
          this.killStructure(s, undefined);
        } else if (s) s.hp = hp;
      }
      // ニュートラル
      snap.n.forEach(([x, z, hp], i) => {
        const n = this.neutrals[i];
        if (n) {
          n.hp = hp;
          if (hp <= 0 && !n.dead) { n.dead = true; n.mesh.visible = false; }
          else if (hp > 0 && n.dead) { n.dead = false; n.mesh.visible = true; }
          if (!n.dead) {
            n.pos.set(x, z);
            n.mesh.position.set(x, n.mesh.position.y, z);
          }
        }
      });
      // 相手弾(視覚)
      for (const [pid, x, z, dx, dz] of snap.p) {
        let mesh = this.netProjectiles.get(pid);
        if (!mesh) {
          mesh = makeProjectileMesh('sphere', '#ffffff', 'white', 1);
          this.scene.add(mesh);
          this.netProjectiles.set(pid, mesh);
        }
        mesh.position.set(x, 1.3, z);
        mesh.rotation.y = Math.atan2(dx, dz);
        mesh.userData.netDir = [dx, dz];
      }
      // 消えた弾の掃除
      const activeIds = new Set(snap.p.map((p) => p[0]));
      for (const [pid, mesh] of this.netProjectiles) {
        if (!activeIds.has(pid)) {
          this.scene.remove(mesh);
          this.netProjectiles.delete(pid);
        }
      }
    };
    net.onOppLeft = (pid) => {
      if (this.ended) return;
      const rc = this.remoteChamps.get(pid);
      const nm = rc?.name ?? '参加者';
      if (this.remoteChamps.size <= 1) {
        // 残る相手がいない (1v1) → 勝利
        this.o.onEvent?.({ type: 'announce', text: '相手が退出しました', sub: '勝利!', color: '#ffd86a' });
        setTimeout(() => this.endMatch(true), 1200);
      } else {
        this.o.onEvent?.({ type: 'announce', text: `${nm} が退出しました`, sub: '', color: '#9fb4d8' });
      }
    };
  }

  /** 受信したチャンプ状態を適用 (補間) */
  private applyRemoteState(rc: Champion, s: { p: [number, number]; f: number; hp: number; maxHp: number; lv: number; dead: boolean; anim: string }) {
    const nx = s.p[0], nz = s.p[1];
    rc.pos.x += (nx - rc.pos.x) * 0.45;
    rc.pos.y += (nz - rc.pos.y) * 0.45;
    rc.facing = s.f;
    rc.hp = s.hp; rc.maxHp = s.maxHp;
    rc.level = s.lv;
    rc.dead = s.dead;
    rc.anim = s.anim;
    rc.rig.anim = s.anim as CharacterRig['anim'];
    rc.rig.root.visible = !s.dead;
    if (s.dead && rc.hp > 0) rc.hp = 0;
  }

  // ---- ミニオンメッシュ共有キャッシュ (軽量化: ジオメトリ/マテリアルを全ミニオンで共有) ----
  // 従来: ミニオンごとに10メッシュ+専用マテリアル (最大640描画呼び出し)
  // 改善: 頂点色で3バケット (布/金属/発光) に統合 → 3描画呼び出し/体
  private static minionGeoCache = new Map<string, { cloth: THREE.BufferGeometry; metal: THREE.BufferGeometry; glow: THREE.BufferGeometry }>();
  private static minionMatCache = new Map<string, { cloth: THREE.MeshStandardMaterial; metal: THREE.MeshStandardMaterial; glow: THREE.MeshStandardMaterial }>();

  /** ミニオンのジオメトリを1度だけ生成してキャッシュ (頂点色でパーツ色を焼き込む) */
  private static buildMinionGeometries(team: Team, ranged: boolean) {
    const color = new THREE.Color(team === 'blue' ? 0x3a8aff : 0xff4a5c);
    const dark = new THREE.Color(team === 'blue' ? 0x2a4a8a : 0x8a2a38);
    const skin = new THREE.Color(0xe8d8b8);
    const steel = new THREE.Color(0x9aa2b8);
    const clothParts: THREE.BufferGeometry[] = [];
    const metalParts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];
    const bake = (geo: THREE.BufferGeometry, c: THREE.Color, mul = 1) => {
      // 統合のため全パーツを非インデックスに統一 (CapsuleGeometry等は非インデックスで
      // 生成されるバージョンがあり、indexed/non-indexed混在はmergeGeometriesが失敗する)
      const g = geo.index ? geo.toNonIndexed() : geo;
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r * mul; arr[i * 3 + 1] = c.g * mul; arr[i * 3 + 2] = c.b * mul;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    };
    // 胴体 (布)
    const body = new THREE.CapsuleGeometry(0.3, 0.44, 4, 10);
    body.translate(0, 0.72, 0);
    clothParts.push(bake(body, color));
    // 背中の旗 pole (金属) + 旗 (布・やや明るく = 発光感を維持)
    const fp = new THREE.CylinderGeometry(0.018, 0.018, 0.62, 5);
    fp.rotateX(-0.15);
    fp.translate(0, 1.05, -0.26);
    metalParts.push(bake(fp, steel));
    const flag = new THREE.PlaneGeometry(0.34, 0.24);
    flag.translate(0.17, 1.24, -0.29);
    clothParts.push(bake(flag, color, 1.16));
    // 頭 (肌色)
    const head = new THREE.SphereGeometry(0.23, 10, 8);
    head.translate(0, 1.3, 0);
    clothParts.push(bake(head, skin));
    // ヘルメット
    if (ranged) {
      const helm = new THREE.ConeGeometry(0.27, 0.4, 8);
      helm.translate(0, 1.48, 0);
      metalParts.push(bake(helm, dark));
    } else {
      const helm = new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
      helm.translate(0, 1.34, 0);
      metalParts.push(bake(helm, steel));
    }
    // 胸当て (金属)
    const chest = new THREE.BoxGeometry(0.5, 0.34, 0.3);
    chest.translate(0, 0.86, 0.1);
    metalParts.push(bake(chest, steel));
    // 発光パーツ (鎧の飾り + バイザー)
    const crest = new THREE.ConeGeometry(0.05, 0.22, 5);
    crest.translate(0, ranged ? 1.72 : 1.52, 0);
    glowParts.push(crest);
    const visor = new THREE.BoxGeometry(0.24, 0.05, 0.05);
    visor.translate(0, 1.31, 0.2);
    glowParts.push(visor);
    // 武器
    if (ranged) {
      const staff = new THREE.CylinderGeometry(0.03, 0.035, 0.95, 6);
      staff.rotateZ(-0.12);
      staff.translate(0.34, 0.82, 0.05);
      metalParts.push(bake(staff, steel));
      const orb = new THREE.OctahedronGeometry(0.08);
      orb.translate(0.4, 1.3, 0.05);
      glowParts.push(orb);
    } else {
      const blade = new THREE.BoxGeometry(0.07, 0.55, 0.035);
      blade.translate(0.36, 0.95, 0.05);
      metalParts.push(bake(blade, steel));
      const guard = new THREE.BoxGeometry(0.16, 0.04, 0.06);
      guard.translate(0.36, 0.68, 0.05);
      metalParts.push(bake(guard, dark));
    }
    const merge = (parts: THREE.BufferGeometry[]) =>
      parts.length === 1 ? parts[0] : mergeGeometries(parts, false)!;
    return { cloth: merge(clothParts), metal: merge(metalParts), glow: merge(glowParts) };
  }

  /** ミニオンの死亡フェード開始: 共有マテリアルを複製して透過 (他のミニオンに影響させない) */
  private beginMinionFade(m: Minion) {
    m.mesh.rotation.x = Math.PI / 2;
    m.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mm = (o.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true;
        o.material = mm;
      }
    });
  }

  /** ミニオンメッシュ生成 (ジオメトリ/マテリアルは共有 → 描画呼び出し 10→3) */
  private makeMinionMesh(team: Team, ranged: boolean): THREE.Group {
    const key = `${team[0]}${ranged ? 'r' : 'm'}`;
    let geos = Battle.minionGeoCache.get(key);
    if (!geos) {
      geos = Battle.buildMinionGeometries(team, ranged);
      Battle.minionGeoCache.set(key, geos);
    }
    let mats = Battle.minionMatCache.get(key);
    if (!mats) {
      const color = team === 'blue' ? 0x3a8aff : 0xff4a5c;
      mats = {
        // 布バケット: 頂点色でパーツ色を表現 (旗は明るめに焼き込み)
        cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.04, emissive: color, emissiveIntensity: 0.2, side: THREE.DoubleSide }),
        // 金属バケット: 胸当て/ポール/ヘルメット/武器 (metalness 0.58で統一)
        metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.58 }),
        glow: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.3 }),
      };
      Battle.minionMatCache.set(key, mats);
    }
    const mesh = new THREE.Group();
    const cloth = new THREE.Mesh(geos.cloth, mats.cloth);
    const metal = new THREE.Mesh(geos.metal, mats.metal);
    const glow = new THREE.Mesh(geos.glow, mats.glow);
    cloth.castShadow = true;
    for (const part of [cloth, metal, glow]) {
      part.matrixAutoUpdate = false;
      part.updateMatrix();
    }
    mesh.add(cloth, metal, glow);
    return mesh;
  }

  private handleNetEvent(ev: NetEvent, from: string) {
    switch (ev.t) {
      case 'dmg': {
        // 相手側エンティティへのダメージ報告 → 自分が権威なら適用 (from pid のチャンプがキラー)
        if (!this.authority) break;
        const tgt = this.resolveEntity(ev.id);
        if (!tgt) break;
        const killer = this.remoteChamps.get(from) ?? undefined;
        (tgt as Minion).hp -= ev.amt;
        if (ev.kill || (tgt as Minion).hp <= 0) {
          if ((tgt as Minion).kind) {
            const m = tgt as Minion;
            m.dead = true;
            m.deadAt = this.time;
            this.beginMinionFade(m);
            this.particles.burst(m.pos.x, 0.8, m.pos.y, TEAM_HEX[m.team], 14, 4, 0.5);
            if (killer) { killer.cs++; killer.gold += m.kind === 'melee' ? 21 : 17; }
            this.grantXpToNearbyChamps(m.pos, 25, m.team === 'blue' ? 'red' : 'blue');
          } else if ((tgt as Structure).type) {
            this.killStructure(tgt as Structure, killer);
          } else {
            const n = tgt as Neutral;
            n.dead = true;
            n.respawnAt = this.time + 90;
            n.mesh.visible = false;
            if (killer) { killer.gold += 150; this.applyBuff(killer, { speedPct: 15, atkPct: 15, duration: 75 }, 'エーテルバフ'); }
          }
        }
        break;
      }
      case 'champDmg': {
        // 自分のチャンピオンが相手からダメージを受けた (pid が自分宛のものだけ)
        if (ev.pid !== this.o.myPid) break;
        const p = this.player;
        let dmg = ev.amt * (100 / (100 + p.armor)) * (p.guardHeld ? 0.35 : 1);
        if (p.shield > 0) {
          const ab = Math.min(p.shield, dmg);
          p.shield -= ab; dmg -= ab;
        }
        p.hp -= dmg;
        p.lastCombat = this.time;
        // フリル: 被弾フック (怒り蓄積)
        this.onFrillDamaged(p, dmg);
        if (ev.stun && ev.stun > 0) this.applyStun(p, ev.stun);
        if (ev.cower && ev.cower > 0) this.applyCower(p, ev.cower);
        if (this.o.cameraShake && dmg > 40) this.shake = Math.max(this.shake, 0.25);
        if (dmg > 0) this.o.onEvent?.({ type: 'dmg', x: p.pos.x, y: 2.2, z: p.pos.y, amount: Math.round(dmg) });
        if (p.hp <= 0) this.killChampion(p, this.remoteChamps.get(ev.from) ?? undefined);
        break;
      }
      case 'champKill': {
        // pid のチャンピオンが倒れた: 自分宛なら既に champDmg で処理済み、他人宛なら死亡演出
        if (ev.pid === this.o.myPid) break;
        const rc = this.remoteChamps.get(ev.pid);
        if (rc && !rc.dead) {
          const killer = this.remoteChamps.get(ev.from) ?? this.player;
          this.killChampion(rc, killer);
          rc.hp = 0;
        }
        break;
      }
      case 'fx': {
        if (ev.kind === 'ring') {
          this.rings.spawn(ev.x, ev.z, ev.color, ev.r, 0.8);
        } else if (ev.kind === 'burst') {
          this.particles.burst(ev.x, 1.2, ev.z, ev.color, ev.n, 7, 0.8);
        } else if (ev.kind === 'rage') {
          // 相手のフリルの大雷怒り (衝撃波の演出を再現・権威ならひよりも適用)
          const R = ev.r ?? 7.5;
          this.rings.spawn(ev.x, ev.z, '#ff7a5c', R, 0.9);
          this.rings.spawn(ev.x, ev.z, '#ffb02e', R * 0.72, 0.7);
          this.rings.spawn(ev.x, ev.z, '#ffffff', R * 0.45, 0.55);
          this.particles.burst(ev.x, 1.6, ev.z, '#ff7a5c', 46, 9, 1.1, 0.5);
          this.particles.burst(ev.x, 1.0, ev.z, '#ffffff', 24, 6.5, 0.8, 0.4);
          this.sfx('rage');
          this.o.onEvent?.({ type: 'announce', text: 'プンプン！！怒ったぞ〜！！', sub: '相手のフリルが大雷怒り！ 近くにいたらひよる！', color: '#ff7a5c' });
          if (this.authority) {
            for (const e of this.champs) {
              if (e.team === ev.team || e.dead) continue;
              if (dist2(e.pos, new THREE.Vector2(ev.x, ev.z)) <= R + 0.8) {
                this.applyCower(e, 2.5);
                const dx = e.pos.x - ev.x, dz = e.pos.y - ev.z;
                const len = Math.max(0.001, Math.hypot(dx, dz));
                e.pos.x += (dx / len) * 2.6;
                e.pos.y += (dz / len) * 2.6;
                this.clampToMap(e.pos);
              }
            }
          }
        } else if (ev.kind === 'bed') {
          // 相手のフリルのお昼寝ベッド (権威なら気絶判定も有効)
          const owner = this.champs.find((c) => c.def.id === 'frill' && c.team === ev.team && !c.isPlayer);
          if (owner) owner.sleepUntil = Math.max(owner.sleepUntil, this.time + 2);
          this.createBed(ev.x, ev.z, ev.rot, ev.team, owner?.id ?? 'remote-bed', owner);
        }
        break;
      }
      case 'end': {
        if (!this.ended) this.endMatch(ev.winBlue === (this.player.team === 'blue'));
        break;
      }
      case 'ping': {
        // 相手チームからの指令は流さず、味方 (同チーム) のものだけ表示
        if (ev.team === this.player.team) {
          this.o.onEvent?.({ type: 'ping', text: ev.text, team: ev.team, from: '味方' });
          this.sfx('ping');
        }
        break;
      }
    }
  }

  private updateNet(dt: number) {
    const net = this.net!;
    this.netAcc += dt;
    const p = this.player;
    if (this.netAcc >= 1 / 15) {
      this.netAcc = 0;
      net.sendChampion({
        p: [p.pos.x, p.pos.y],
        f: p.facing,
        hp: Math.round(p.hp), maxHp: Math.round(p.maxHp),
        lv: p.level, dead: p.dead, anim: p.anim === 'run' ? 'run' : p.anim,
      });
      if (this.authority) {
        // ワールドスナップショット送信 (AI bot チャンプ含む)
        const snap: NetWorld = {
          m: this.minions.slice(0, 60).map((m): [string, number, number, number, boolean] => [m.id, +m.pos.x.toFixed(1), +m.pos.y.toFixed(1), Math.round(m.hp), m.dead]),
          s: this.structures.map((s): [string, number] => [s.id, Math.round(s.dead ? 0 : s.hp)]),
          n: this.neutrals.map((n): [number, number, number] => [n.pos.x, n.pos.y, Math.round(n.dead ? 0 : n.hp)]),
          p: this.projectiles.filter((pr) => pr.team === this.player.team === false ? false : true).slice(0, 30).map((pr): [string, number, number, number, number] => [pr.id, +pr.pos.x.toFixed(1), +pr.pos.z.toFixed(1), +pr.dir.x.toFixed(2), +pr.dir.y.toFixed(2)]),
          c: this.champs
            .filter((c) => !c.isPlayer && !c.isRemote)
            .map((c): [string, number, number, number, number, number, boolean, string, number] => [c.ownerPid ?? '', +c.pos.x.toFixed(1), +c.pos.y.toFixed(1), Math.round(c.hp), Math.round(c.maxHp), c.level, c.dead, c.anim, +c.facing.toFixed(2)]),
          nx: [0, 0],
        };
        net.sendWorld(snap);
      } else {
        // 非権威: 弾の視覚情報
        net.sendEvents(this.pendingNetEvents.filter((e) => e.t === 'fx').map((e) => e));
      }
    }
    // イベントフラッシュ
    if (this.pendingNetEvents.length) {
      const evs = this.pendingNetEvents.splice(0, this.pendingNetEvents.length);
      // 自分の弾ヒット情報等
      const fxOnly = evs.filter((e) => e.t === 'fx');
      const rest = evs.filter((e) => e.t !== 'fx') as typeof evs;
      net.sendEvents([...rest, ...fxOnly]);
    }
    // 終了時に通知
    if (this.ended && !this.endSent) {
      this.endSent = true;
      net.sendEvents([{ t: 'end', winBlue: this.player.team === 'blue' }]);
    }
  }
  private endSent = false;
}


