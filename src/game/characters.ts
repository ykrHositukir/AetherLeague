// ============================================================
// AETHER LEAGUE - キャラクター定義 (13体)
// 近接/遠距離・スキル・移動速度・武器がそれぞれ異なる
// ※ 体力・攻撃力は 2倍強化済み (シールド/回復量も比例)
// ============================================================

import type { CharacterDef } from './types';

export const CHARACTERS: CharacterDef[] = [
  // ----------------------------------------------------------
  // 1. ブレイズ - 炎の剣士 (近接ファイター)
  // ----------------------------------------------------------
  {
    id: 'blaze',
    name: 'ブレイズ',
    title: '紅蓮の剣士',
    role: 'ファイター',
    element: '炎',
    desc: '焼けつく闘志を剣に乗せる、前線の主役。接近戦の火力と機動力を兼ね備える。',
    difficulty: 2,
    colors: {
      primary: '#e8442e', secondary: '#7a1d10', accent: '#ffb02e',
      skin: '#f0c8a0', hair: '#ff6a2e', eye: '#ffcf5c', aura: '#ff7a2e',
    },
    stats: {
      hp: 1320, mana: 300, atk: 128, atkSpeed: 0.85, range: 3.2,
      speed: 7.2, armor: 32, hpRegen: 3.2, manaRegen: 3.2,
    },
    attack: { type: 'melee', shape: 'sphere', color: '#ff9a4d', glow: 'white' },
    weapon: 'sword',
    bodyType: 'normal',
    hat: 'spiky',
    cape: true,
    skills: [
      {
        slot: 'Q', name: '烈火突き', kind: 'dash', glyph: 'flame-thrust',
        desc: '前方に炎を纏って突撃し、触れた敵にダメージ。',
        cooldown: 7, manaCost: 45, dashDist: 9, dashDamage: 1.1,
        shape: 'sphere', color: '#ff7a2e', glow: 'white',
      },
      {
        slot: 'E', name: '火炎旋風', kind: 'aoe', glyph: 'fire-cyclone',
        desc: '自身の周囲に炎の渦を巻き起こし、範囲内の敵を燃やし尽くす。',
        cooldown: 10, manaCost: 60, damage: 1.4, aoeRadius: 5.5,
        shape: 'torus', color: '#ff5c2e', glow: 'white',
      },
      {
        slot: 'R', name: '焔滅斬・紅', kind: 'burst', ult: true, glyph: 'blazing-slash',
        desc: '渾身の一撃で地面ごと切り裂く。広範囲に大ダメージ+移動速度上昇バフ。',
        cooldown: 60, manaCost: 100, damage: 3.2, aoeRadius: 7,
        shape: 'cone', color: '#ff4d1f', glow: 'white',
        buff: { speedPct: 30, duration: 5 },
      },
    ],
    voice: 'burn bright! その胸に紅の炎を。',
  },

  // ----------------------------------------------------------
  // 2. フロスト - 氷の魔導師 (遠距離メイジ)
  // ----------------------------------------------------------
  {
    id: 'frost',
    name: 'フロスト',
    title: '氷結の詩人',
    role: 'メイジ',
    element: '氷',
    desc: '優雅に舞う氷の魔導師。敵の動きを止め、戦場を支配する。',
    difficulty: 1,
    colors: {
      primary: '#5cd6ff', secondary: '#1d4d7a', accent: '#c8f0ff',
      skin: '#f4d6c0', hair: '#bfeaff', eye: '#4fc8ff', aura: '#7ce0ff',
    },
    stats: {
      hp: 1080, mana: 420, atk: 116, atkSpeed: 0.72, range: 11,
      speed: 6.4, armor: 22, hpRegen: 2.4, manaRegen: 4.2,
    },
    attack: { type: 'ranged', shape: 'crystal', color: '#8fe8ff', glow: 'white' },
    weapon: 'staff',
    bodyType: 'slim',
    hat: 'witch',
    cape: true,
    skills: [
      {
        slot: 'Q', name: '氷槍アイシクル', kind: 'projectile', glyph: 'icicle',
        desc: '鋭い氷の槍を放つ。命中した敵を移動速度ダウン。',
        cooldown: 5, manaCost: 40, damage: 1.5, range: 16, projSpeed: 26,
        count: 1, shape: 'diamond', color: '#aef0ff', glow: 'white',
        slowPct: 40, slowDur: 2,
      },
      {
        slot: 'E', name: '吹雪の環', kind: 'aoe', glyph: 'blizzard-ring',
        desc: '指定地点に吹雪の渦を呼び、範囲内の敵にダメージと減速。',
        cooldown: 11, manaCost: 70, damage: 1.3, aoeRadius: 6,
        shape: 'ring', color: '#7cd8ff', glow: 'white',
        slowPct: 30, slowDur: 2.5,
      },
      {
        slot: 'R', name: '永凍氷獄', kind: 'burst', ult: true, glyph: 'frozen-nova',
        desc: '広範囲を凍結させ、大ダメージ+長時間の強力な減速。',
        cooldown: 70, manaCost: 100, damage: 2.6, aoeRadius: 9,
        shape: 'icosa', color: '#b8f4ff', glow: 'white',
        slowPct: 60, slowDur: 3.5,
      },
    ],
    voice: '静かに、凍てつけ。',
  },

  // ----------------------------------------------------------
  // 3. ボルト - 雷光の暗殺者 (近接アサシン)
  //    ※ v1.1 大弱体化 → v1.4 プレイ感調整 (数字は味方敵共通なので公平)
  // ----------------------------------------------------------
  {
    id: 'volt',
    name: 'ボルト',
    title: '迅雷の残像',
    role: 'アサシン',
    element: '雷',
    desc: 'かつて戦場を席捲した雷の暗殺者。度重なる弱体化で牙は鈍ったが、磨かれた稲妻はまだ鋭い。弱った敵を見逃さないのが暗殺者の流儀。',
    difficulty: 3,
    colors: {
      primary: '#ffe14d', secondary: '#4a3a10', accent: '#fff7b0',
      skin: '#e8c8a8', hair: '#ffe14d', eye: '#7df0ff', aura: '#fff04d',
    },
    stats: {
      hp: 1000, mana: 260, atk: 112, atkSpeed: 0.82, range: 2.7,
      speed: 7.0, armor: 22, hpRegen: 2.2, manaRegen: 2.8,
    },
    attack: { type: 'melee', shape: 'tetra', color: '#fff04d', glow: 'white' },
    weapon: 'daggers',
    bodyType: 'slim',
    hat: 'spiky',
    cape: false,
    skills: [
      {
        slot: 'Q', name: '雷爪', kind: 'projectile', glyph: 'thunder-claw',
        desc: '電撃の爪痕を飛ばし、貫通ダメージ。',
        cooldown: 6.5, manaCost: 40, damage: 0.95, range: 10, projSpeed: 30,
        count: 1, shape: 'box', color: '#fff56c', glow: 'white',
      },
      {
        slot: 'E', name: '電光疾走', kind: 'dash', glyph: 'lightning-dash',
        desc: '稲妻のように駆け抜け、通過した敵にダメージ。',
        cooldown: 12, manaCost: 55, dashDist: 10, dashDamage: 0.75,
        shape: 'octa', color: '#ffe14d', glow: 'white',
      },
      {
        slot: 'R', name: 'サンダーゴッド', kind: 'burst', ult: true, glyph: 'thunder-god',
        desc: '雷神の如き連撃。範囲内の敵を削り、自分も稲妻に乗る。',
        cooldown: 80, manaCost: 100, damage: 2.45, aoeRadius: 5.5,
        shape: 'star', color: '#fff7b0', glow: 'white',
        buff: { speedPct: 12, atkPct: 8, duration: 4 },
      },
    ],
    voice: '見えたか？ …まあ、最近は見えてもらってもいいけど。',
  },

  // ----------------------------------------------------------
  // 4. テラ - 大地の守護者 (近接タンク・最硬)
  // ----------------------------------------------------------
  {
    id: 'terra',
    name: 'テラ',
    title: '山脈の心臓',
    role: 'タンク',
    element: '土',
    desc: '動かぬ大山地獄の守護神。仲間の盾となり、大地の力で敵を砕く。',
    difficulty: 1,
    colors: {
      primary: '#8a6a3c', secondary: '#4a3418', accent: '#7ce87c',
      skin: '#c8a878', hair: '#5c4428', eye: '#9cff7c', aura: '#a8d86a',
    },
    stats: {
      hp: 1760, mana: 260, atk: 112, atkSpeed: 0.68, range: 3.0,
      speed: 5.8, armor: 48, hpRegen: 4.8, manaRegen: 2.8,
    },
    attack: { type: 'melee', shape: 'box', color: '#c89a4d', glow: 'white' },
    weapon: 'hammer',
    bodyType: 'heavy',
    hat: 'helm',
    cape: false,
    skills: [
      {
        slot: 'Q', name: '岩礫投擲', kind: 'projectile', glyph: 'rock-throw',
        desc: '巨大な岩を投げつける。着弾点に小範囲ダメージ。',
        cooldown: 6, manaCost: 40, damage: 1.3, range: 13, projSpeed: 20,
        count: 1, shape: 'box', color: '#b8925c', glow: 'white',
      },
      {
        slot: 'E', name: '大地の加護', kind: 'buff', glyph: 'earth-shield',
        desc: '岩の鎧を纏い、シールド+防御力アップ。',
        cooldown: 14, manaCost: 60,
        shape: 'ring', color: '#8ce88c', glow: 'white',
        buff: { shield: 440, armorPct: 40, duration: 6 },
      },
      {
        slot: 'R', name: 'グラビティクエイク', kind: 'burst', ult: true, glyph: 'gravity-quake',
        desc: '大地を割る衝撃波。広範囲に大ダメージ+自身シールド。',
        cooldown: 65, manaCost: 100, damage: 2.4, aoeRadius: 8,
        shape: 'octa', color: '#d8a84d', glow: 'white',
        buff: { shield: 600, duration: 5 },
      },
    ],
    voice: 'この身は山となり、壁となる。',
  },

  // ----------------------------------------------------------
  // 5. ルミナ - 光の癒し手 (遠距離サポーター)
  // ----------------------------------------------------------
  {
    id: 'lumina',
    name: 'ルミナ',
    title: '暁の祈祷師',
    role: 'サポーター',
    element: '光',
    desc: '慈悲の光で味方を癒し、裁きの光で敵を浄化する聖なる歌姫。',
    difficulty: 1,
    colors: {
      primary: '#fff4c8', secondary: '#c8a84d', accent: '#ffd86a',
      skin: '#f8e0cc', hair: '#fff0b0', eye: '#ffdf6a', aura: '#fff4a0',
    },
    stats: {
      hp: 1200, mana: 440, atk: 104, atkSpeed: 0.75, range: 10.5,
      speed: 6.8, armor: 26, hpRegen: 3.6, manaRegen: 4.6,
    },
    attack: { type: 'ranged', shape: 'star', color: '#fff8d0', glow: 'white' },
    weapon: 'wand',
    bodyType: 'slim',
    hat: 'crown',
    cape: true,
    skills: [
      {
        slot: 'Q', name: 'ホーリーレイ', kind: 'projectile', glyph: 'holy-ray',
        desc: '光の弾丸を放つ。敵に命中すると小さな聖域が炸裂。',
        cooldown: 4, manaCost: 35, damage: 1.1, range: 14, projSpeed: 24,
        count: 2, spreadDeg: 8, shape: 'star', color: '#fff4a0', glow: 'white',
      },
      {
        slot: 'E', name: '癒しの波動', kind: 'heal', glyph: 'heal-wave',
        desc: '聖なる光でHPを回復+一時的なシールドを獲得。',
        cooldown: 12, manaCost: 65,
        shape: 'ring', color: '#fff4c8', glow: 'white',
        buff: { heal: 400, shield: 240, duration: 4 },
      },
      {
        slot: 'R', name: '裁きの聖光', kind: 'burst', ult: true, glyph: 'judgment-light',
        desc: '天より降り注ぐ裁き。広範囲に大ダメージ+自己回復。',
        cooldown: 68, manaCost: 100, damage: 2.8, aoeRadius: 8.5,
        shape: 'sphere', color: '#ffffff', glow: 'white',
        buff: { heal: 500, duration: 3 },
      },
    ],
    voice: '光は、必ず道を示すわ。',
  },

  // ----------------------------------------------------------
  // 6. シャドウ - 闇の忍者 (遠距離×機動アサシン・黒発光)
  // ----------------------------------------------------------
  {
    id: 'shadow',
    name: 'シャドウ',
    title: '漆黒の影法師',
    role: 'アサシン',
    element: '闇',
    desc: '闇に溶け、影から影へ移る忍者。黒発光の手裏剣が夜を切り裂く。',
    difficulty: 3,
    colors: {
      primary: '#3c3450', secondary: '#181228', accent: '#b06aff',
      skin: '#d8b8a0', hair: '#282038', eye: '#c86aff', aura: '#8a4dff',
    },
    stats: {
      hp: 1110, mana: 300, atk: 132, atkSpeed: 0.95, range: 9.5,
      speed: 8.0, armor: 22, hpRegen: 2.6, manaRegen: 3.4,
    },
    attack: { type: 'ranged', shape: 'shuriken', color: '#2a1f3d', glow: 'black' },
    weapon: 'shuriken',
    bodyType: 'slim',
    hat: 'ninja',
    cape: false,
    skills: [
      {
        slot: 'Q', name: '三連黒手裏剣', kind: 'projectile', glyph: 'triple-shuriken',
        desc: '黒き手裏剣を三方向へ放つ。全弾命中で追加ダメージ。',
        cooldown: 5, manaCost: 40, damage: 0.85, range: 13, projSpeed: 28,
        count: 3, spreadDeg: 14, shape: 'shuriken', color: '#221a38', glow: 'black',
      },
      {
        slot: 'E', name: '影縫い歩法', kind: 'dash', glyph: 'shadow-step',
        desc: '影に潜って高速移動。通過した敵を闇で削る。',
        cooldown: 9, manaCost: 55, dashDist: 11, dashDamage: 1.2,
        shape: 'tetra', color: '#1a1030', glow: 'black',
      },
      {
        slot: 'R', name: '暗殺円舞曲', kind: 'burst', ult: true, glyph: 'dark-waltz',
        desc: '闇の領域を展開。範囲内の敵に執拗な連撃を浴びせる。',
        cooldown: 58, manaCost: 95, damage: 3.4, aoeRadius: 6.5,
        shape: 'torus', color: '#120a24', glow: 'black',
        buff: { speedPct: 40, duration: 4 },
      },
    ],
    voice: '……影は、既にお前の背後にいる。',
  },

  // ----------------------------------------------------------
  // 7. アクア - 水の歌姫 (遠距離メイジ)
  // ----------------------------------------------------------
  {
    id: 'aqua',
    name: 'アクア',
    title: '潮騒の歌姫',
    role: 'メイジ',
    element: '水',
    desc: '歌声で海を呼び覚まし、波に乗る自由人。弾くような水魔法が得意。',
    difficulty: 2,
    colors: {
      primary: '#4dc8ff', secondary: '#1a5c8a', accent: '#a8f0e0',
      skin: '#f4d6c0', hair: '#6ad8ff', eye: '#4fffd8', aura: '#5ce0ff',
    },
    stats: {
      hp: 1150, mana: 410, atk: 114, atkSpeed: 0.78, range: 11.5,
      speed: 6.6, armor: 24, hpRegen: 2.8, manaRegen: 4.4,
    },
    attack: { type: 'ranged', shape: 'sphere', color: '#6ae0ff', glow: 'white' },
    weapon: 'trident',
    bodyType: 'normal',
    hat: 'twin',
    cape: false,
    skills: [
      {
        slot: 'Q', name: 'バブルショット', kind: 'projectile', glyph: 'bubble-shot',
        desc: '弾む水球を3連射。ヒットでわずかに減速させる。',
        cooldown: 5.5, manaCost: 45, damage: 0.95, range: 14, projSpeed: 22,
        count: 3, spreadDeg: 6, shape: 'sphere', color: '#7ce8ff', glow: 'white',
        slowPct: 20, slowDur: 1.5,
      },
      {
        slot: 'E', name: '潮流バースト', kind: 'aoe', glyph: 'tide-burst',
        desc: '渦潮を起こし、周囲の敵を押し出しつつダメージ。',
        cooldown: 10, manaCost: 65, damage: 1.25, aoeRadius: 5.8,
        shape: 'ring', color: '#4fd8ff', glow: 'white',
      },
      {
        slot: 'R', name: 'ツナミ・エターナル', kind: 'burst', ult: true, glyph: 'tsunami',
        desc: '巨大な津波を呼び、直線上の敵をまとめて飲み込む。',
        cooldown: 62, manaCost: 100, damage: 3.0, aoeRadius: 7.5,
        shape: 'cone', color: '#3ec8ff', glow: 'white',
        buff: { shield: 300, duration: 4 },
      },
    ],
    voice: '乗り遅れないで〜！ 波、来るよ！',
  },

  // ----------------------------------------------------------
  // 8. ゲイル - 風の弓箭手 (遠距離マークスマン)
  // ----------------------------------------------------------
  {
    id: 'gale',
    name: 'ゲイル',
    title: '疾風の狙撃手',
    role: 'マークスマン',
    element: '風',
    desc: '風を読み、一矢で戦況を変える狙撃手。遠距離からの火力要。',
    difficulty: 2,
    colors: {
      primary: '#7ce8a8', secondary: '#2a6a4a', accent: '#e0fff0',
      skin: '#ecc8a8', hair: '#a8f0c8', eye: '#7cffe0', aura: '#8cf0c0',
    },
    stats: {
      hp: 1170, mana: 290, atk: 136, atkSpeed: 1.1, range: 12.5,
      speed: 7.6, armor: 20, hpRegen: 2.6, manaRegen: 3.0,
    },
    attack: { type: 'ranged', shape: 'arrow', color: '#c8ffe8', glow: 'white' },
    weapon: 'bow',
    bodyType: 'normal',
    hat: 'band',
    cape: true,
    skills: [
      {
        slot: 'Q', name: 'ウィンドピアース', kind: 'projectile', glyph: 'wind-arrow',
        desc: '風を纏った矢を放つ。直線上の敵を全て貫通。',
        cooldown: 5, manaCost: 40, damage: 1.4, range: 18, projSpeed: 36,
        count: 1, shape: 'arrow', color: '#d8fff0', glow: 'white',
      },
      {
        slot: 'E', name: '疾風ステップ', kind: 'dash', glyph: 'gale-step',
        desc: '風のように間合いを調整。短CDの緊急回避+攻撃速度アップ。',
        cooldown: 7, manaCost: 45, dashDist: 8,
        shape: 'octa', color: '#9cf0c8', glow: 'white',
        buff: { atkPct: 15, speedPct: 20, duration: 4 },
      },
      {
        slot: 'R', name: 'ストームアロー・嵐', kind: 'burst', ult: true, glyph: 'storm-arrows',
        desc: '空より無数の矢を降らせ、広範囲を嵐に包む。',
        cooldown: 60, manaCost: 100, damage: 2.9, aoeRadius: 8,
        shape: 'arrow', color: '#e8fff8', glow: 'white',
      },
    ],
    voice: '風が、俺に狙うべき標的を教えてくれる。',
  },

  // ----------------------------------------------------------
  // 9. フリル - おてんば魔女見習い (遠距離サポートメイジ)
  //    パッシブ: 被ダメで「怒り」が溜まり、満タンで大雷怒り！
  //    → 周囲の敵をひよらせて (震えて動けなくする) 逃げる
  // ----------------------------------------------------------
  {
    id: 'frill',
    name: 'フリル',
    title: 'おてんば魔女見習い',
    role: 'メイジ',
    element: '水',
    desc: 'ふわふわのフリルドレスが自慢、正義感あふれるおてんば魔女見習い。ダメージを受けるたびに頭上の「怒りゲージ」が溜まり、満タンになると大雷怒り！ 周囲の敵はびっくりしてひよってしまい、その隙にすたこら逃げられる。魔法のびっくり爆弾とお昼寝ベッドを操る。',
    difficulty: 2,
    colors: {
      primary: '#ffd0e8', secondary: '#8a4d78', accent: '#fff4fa',
      skin: '#fae4d4', hair: '#ffb0d8', eye: '#ff6aa8', aura: '#ff9ad0',
    },
    stats: {
      hp: 1150, mana: 400, atk: 108, atkSpeed: 0.75, range: 10.5,
      speed: 6.7, armor: 24, hpRegen: 3.0, manaRegen: 4.4,
    },
    attack: { type: 'ranged', shape: 'sphere', color: '#ffe0f0', glow: 'white' },
    weapon: 'plush',
    bodyType: 'slim',
    hat: 'frill',
    cape: false,
    skills: [
      {
        slot: 'Q', name: 'マジカル・ビックリ弾', kind: 'projectile', glyph: 'surprise-bomb',
        desc: 'ぱっと開くびっくり爆弾を投げる。命中した相手は大音量にびっくりして2.5秒間ひよる (動けなくなる)。',
        cooldown: 14, manaCost: 70, damage: 0.9, range: 13, projSpeed: 20,
        count: 1, shape: 'sphere', color: '#ffd76a', glow: 'white',
        cowerDur: 2.5,
      },
      {
        slot: 'E', name: 'お昼寝ベッド', kind: 'buff', glyph: 'nap-bed',
        desc: 'その場にあったかいベッドを出して飛び乗り、2秒間無敵のお昼寝 (1秒ごとに500回復)。そっと触れた相手は衝撃で3秒気絶する (ベッドは10秒間残る)。',
        cooldown: 22, manaCost: 80,
        shape: 'ring', color: '#ffe9a0', glow: 'white',
        sleepSec: 2, sleepHeal: 500,
      },
      {
        slot: 'R', name: 'スーパーおこりんぼ大爆発', kind: 'burst', ult: true, glyph: 'rage-burst',
        desc: '渾身のどなり声で衝撃波を炸裂させる！ 広範囲に大ダメージ+敵はみんな3秒間ひよって動けなくなり、その後も足が遅くなる。',
        cooldown: 75, manaCost: 100, damage: 2.6, aoeRadius: 8.5,
        shape: 'star', color: '#ff7a5c', glow: 'white',
        cowerDur: 3, slowPct: 35, slowDur: 3,
      },
    ],
    voice: 'ぷんぷん！ フリルの正義の怒り、受け取ってよね！',
  },

  // ----------------------------------------------------------
  // 10. パル - 影縫いの相棒 (近接アサシン / 猟犬召喚)
  //     E: 体力600の猟犬シャドウを召喚。30秒ごとにスタック回復 (最大3)
  // ----------------------------------------------------------
  {
    id: 'pal',
    name: 'パル',
    title: '影縫いの相棒',
    role: 'アサシン',
    element: '闇',
    desc: '影の組織で鍛えられた若き暗殺者。口数は少ないが心は熱い。スキルで相棒の猟犬シャドウ (体力600) を召喚でき、犬は自分の後をついて歩き、自分が攻撃した敵に飛びかかる。チャージは30秒ごとに1スタック (最大3スタック)。',
    difficulty: 3,
    colors: {
      primary: '#3ad8b8', secondary: '#123c44', accent: '#c8fff0',
      skin: '#e8c8a8', hair: '#1ae0b8', eye: '#5cf0d8', aura: '#4ff0d0',
    },
    stats: {
      hp: 1090, mana: 300, atk: 126, atkSpeed: 1.0, range: 2.9,
      speed: 8.1, armor: 22, hpRegen: 2.6, manaRegen: 3.6,
    },
    attack: { type: 'melee', shape: 'diamond', color: '#5cf0d8', glow: 'white' },
    weapon: 'daggers',
    bodyType: 'slim',
    hat: 'hood',
    cape: true,
    skills: [
      {
        slot: 'Q', name: 'シャドウファング', kind: 'projectile', glyph: 'void-fang',
        desc: '闇の牙を飛ばし、命中した敵にダメージとわずかな減速。',
        cooldown: 5, manaCost: 40, damage: 1.25, range: 12, projSpeed: 32,
        count: 1, shape: 'diamond', color: '#5cf0d8', glow: 'white',
        slowPct: 25, slowDur: 1.5,
      },
      {
        slot: 'E', name: 'ハウンド・コール', kind: 'summon', glyph: 'hound-call',
        desc: '自分の位置に体力600の猟犬シャドウを召喚。通常は自分について行き、近くの敵に自分が攻撃すると犬もその敵に攻撃しに行く。スタックは30秒ごとに1つ回復 (最大3スタック・最大3連続使用)。',
        cooldown: 30, manaCost: 60,
        shape: 'ring', color: '#4ff0d0', glow: 'white',
      },
      {
        slot: 'R', name: 'ファントム・リーパー', kind: 'burst', ult: true, glyph: 'phantom-reap',
        desc: '影の鎌が戦場を薙ぎ、広範囲に大ダメージ。自分は影に溶けて移動速度アップ。',
        cooldown: 60, manaCost: 90, damage: 2.9, aoeRadius: 6.5,
        shape: 'torus', color: '#3ad8b8', glow: 'white',
        buff: { speedPct: 30, duration: 4 },
      },
    ],
    voice: '……行くぞ、シャドウ。相棒。',
  },

  // ----------------------------------------------------------
  // 11. アイゼン - 鉄壁の城兵 (近接タンク / 味方を守る鉄の壁)
  // ----------------------------------------------------------
  {
    id: 'eisen',
    name: 'アイゼン',
    title: '鉄壁の城兵',
    role: 'タンク',
    element: '土',
    desc: '王国最強と謳われる鋼の城兵。分厚い鉄鎧と挑発の咆哮で味方の盾となり、不動の要塞として敵の進軍を食い止める。慌てると意外と可愛いと言われるのが悩み。',
    difficulty: 1,
    colors: {
      primary: '#8a97b8', secondary: '#3c445c', accent: '#d8e4ff',
      skin: '#d8b898', hair: '#5a6478', eye: '#a8d8ff', aura: '#9ab4d8',
    },
    stats: {
      hp: 1980, mana: 240, atk: 108, atkSpeed: 0.62, range: 2.8,
      speed: 5.6, armor: 56, hpRegen: 5.2, manaRegen: 2.6,
    },
    attack: { type: 'melee', shape: 'box', color: '#b8c4dc', glow: 'white' },
    weapon: 'hammer',
    bodyType: 'heavy',
    hat: 'helm',
    cape: true,
    skills: [
      {
        slot: 'Q', name: 'アイアン・スマッシュ', kind: 'aoe', glyph: 'iron-smash',
        desc: '大鉄鎚を振り下ろし、地面ごと砕く。範囲内の敵にダメージ。',
        cooldown: 8, manaCost: 40, damage: 1.15, aoeRadius: 4.5,
        shape: 'octa', color: '#b8c4dc', glow: 'white',
      },
      {
        slot: 'E', name: 'ウォークライ', kind: 'buff', glyph: 'taunt-horn',
        desc: '挑発の咆哮で周囲の敵の注意を引きつけて動きを鈍らせ (2.5秒)、自身は岩の鎧 (シールド+防御力アップ) を纏う。',
        cooldown: 15, manaCost: 55, damage: 0.5, aoeRadius: 5.5,
        shape: 'ring', color: '#9ab4d8', glow: 'white',
        slowPct: 40, slowDur: 2.5,
        buff: { shield: 420, armorPct: 40, duration: 6 },
      },
      {
        slot: 'R', name: '不動の要塞', kind: 'burst', ult: true, glyph: 'fortress-wall',
        desc: '大地に城壁の如く立ちはだかり、広範囲に衝撃波+敵を大きく減速。自身は巨大なシールドを獲得する。',
        cooldown: 70, manaCost: 100, damage: 2.2, aoeRadius: 7.5,
        shape: 'box', color: '#d8e4ff', glow: 'white',
        slowPct: 50, slowDur: 2.5,
        buff: { shield: 800, duration: 6 },
      },
    ],
    voice: 'この壁を、誰も越えられない。',
  },

  // ----------------------------------------------------------
  // 12. ルーミー - 桃色の癒やし手 (遠距離サポーター / 味方全員回復)
  //     ※ ピンクのふわふわワンピース × 白ソックス (前リボン付き)
  // ----------------------------------------------------------
  {
    id: 'roomy',
    name: 'ルーミー',
    title: '桃色の癒やし手',
    role: 'サポーター',
    element: '光',
    desc: 'ふわふわのピンクのワンピースと白いソックス、前におリボンがチャームポイントの元気いっぱいヒーラー。ハートの光で仲間を回復させ、星の歌でみんなを強くする。チームのムードメーカーで、ピンチのときほど明るい声が響く。',
    difficulty: 1,
    colors: {
      primary: '#ffb8d8', secondary: '#a84d78', accent: '#fff0f8',
      skin: '#fae4d4', hair: '#ff8ac8', eye: '#ff9ac8', aura: '#ffb8d8',
    },
    stats: {
      hp: 1180, mana: 460, atk: 98, atkSpeed: 0.72, range: 10,
      speed: 6.9, armor: 28, hpRegen: 4.0, manaRegen: 4.8,
    },
    attack: { type: 'ranged', shape: 'star', color: '#ffc8e0', glow: 'white' },
    weapon: 'wand',
    bodyType: 'slim',
    hat: 'twin',
    cape: false,
    skills: [
      {
        slot: 'Q', name: 'ハートビーム', kind: 'projectile', glyph: 'heart-beam',
        desc: 'ハートの光弾を放つ。敵に命中すると小さなハートがはじける。',
        cooldown: 4.5, manaCost: 35, damage: 0.95, range: 12, projSpeed: 24,
        count: 1, shape: 'star', color: '#ffc8e0', glow: 'white',
      },
      {
        slot: 'E', name: 'ヒール・サイクロン', kind: 'heal', glyph: 'heal-cyclone',
        desc: 'ハートの風を巻き起こし、自分と近くの味方のHPを回復 (340) してシールド (200) を付与。',
        cooldown: 12, manaCost: 65,
        shape: 'ring', color: '#ffc8e0', glow: 'white',
        allyHeal: 340, allyRadius: 8,
        buff: { heal: 340, shield: 200, duration: 4 },
      },
      {
        slot: 'R', name: 'スターライト・ハイム', kind: 'burst', ult: true, glyph: 'star-hymn',
        desc: '星の歌をささげて、範囲内の味方を大きく回復 (450) させ足も軽くする。範囲内の敵には光の裁き (ダメージ)。',
        cooldown: 66, manaCost: 100, damage: 1.8, aoeRadius: 8.5,
        shape: 'sphere', color: '#fff0f8', glow: 'white',
        allyHeal: 450, allyRadius: 10,
        buff: { speedPct: 20, duration: 4 },
      },
    ],
    voice: 'ルーミーの応援、受け取って〜！ みんないっしょにがんばろう！',
  },

  // ----------------------------------------------------------
  // 13. ステラ - 星剣の天使 (近接ファイター / 距離火力の大剣使い)
  //     通常攻撃: 大剣が前方160度にくるくる飛んでいく (近いほど高火力・射程5.5)
  //     Q: 体の周り360度に星6個 → 近くの敵へ飛ぶ
  //     E: 敵の背後→前→背後へダッシュ斬り (最後に白黒で大切り)
  //     R: 最も近い敵の周りを十角形の対角線のように順番にダッシュ斬り (足跡を残す)
  //        → 納刀 → 敵の下に大魔法陣 → 上にビーム
  //     パッシブ「負荷メータ」: ダメージを与えると負荷が溜まり、満タンで
  //        360度剣舞 (剣が自分の周りを曲がるように攻撃) できる
  // ----------------------------------------------------------
  {
    id: 'stella',
    name: 'ステラ',
    title: '星剣の天使',
    role: 'ファイター',
    element: '光',
    desc: '天使の輪と黄色い長い髪がトレードマークの星剣士。大剣を振りかざし、剣をくるくらせて飛ばす遠近両用の剣技の達人。ダメージを与えるほど頭上の「負荷メータ」が溜まり、満タンになると剣が自分の周りを曲がるように舞う360度の剣舞が解き放たれる。',
    difficulty: 3,
    colors: {
      primary: '#ffe66a', secondary: '#7a5c14', accent: '#fff8d0',
      skin: '#fae8d4', hair: '#ffd94d', eye: '#6ad8ff', aura: '#ffe66a',
    },
    stats: {
      hp: 1270, mana: 320, atk: 124, atkSpeed: 0.78, range: 5.5,
      speed: 6.9, armor: 30, hpRegen: 3.4, manaRegen: 3.4,
    },
    attack: { type: 'ranged', shape: 'sword', color: '#ffe66a', glow: 'white' },
    weapon: 'greatsword',
    bodyType: 'slim',
    hat: 'halo',
    cape: false,
    skills: [
      {
        slot: 'Q', name: 'スターバースト', kind: 'projectile', glyph: 'star-ring', starRing: true,
        desc: '体の周りに星が6個出現し (360度)、近くの敵にひとつずつ飛んでいく。',
        cooldown: 10, manaCost: 50, damage: 0.55, range: 12, projSpeed: 22,
        count: 6, shape: 'star', color: '#ffe66a', glow: 'white',
      },
      {
        slot: 'E', name: 'ステラッシュ', kind: 'dash', glyph: 'star-slash', comboKind: 'stellarush',
        desc: '近くの敵の背後にダッシュして切り、次に敵の前にダッシュして切り、さらに背後へ。最後に敵が白黒になったところを大切り！',
        cooldown: 20, manaCost: 65,
        dashDist: 6, dashDamage: 0,
        shape: 'star', color: '#fff4b0', glow: 'white',
      },
      {
        slot: 'R', name: 'ステライド', kind: 'burst', ult: true, glyph: 'star-ride', comboKind: 'stellaride',
        desc: '最も近い敵の周りを十角形の対角線のように順番にダッシュして切りつけ (その経路が足跡として残る)、最後に剣を収めて敵の下に大きな魔法陣を出現させ、天に向かってビームを放つ！',
        cooldown: 80, manaCost: 100,
        aoeRadius: 2.8, damage: 1.3,
        shape: 'star', color: '#fff4b0', glow: 'white',
      },
    ],
    voice: '星の導き、あなたに。ステラ、参上！',
  },
];

export function getChar(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const SKILL_SLOT_LABEL: Record<string, string> = { Q: 'Q', E: 'E', R: 'R' };

// ショップ (icon は SVG アイコンキー - Icons.tsx の ShopIcon で描画)
export const SHOP_ITEMS: import('./types').ShopItem[] = [
  { id: 'sword', name: '烈火の剣', desc: '攻撃力 +50', cost: 900, icon: 'sword', stats: { atk: 50 } },
  { id: 'staff', name: '賢者の杖', desc: '攻撃力 +70 / マナ +120', cost: 950, icon: 'staff', stats: { atk: 70, mana: 120 } },
  { id: 'armor', name: 'ルーン鎧', desc: '防御力 +30', cost: 800, icon: 'shield', stats: { armor: 30 } },
  { id: 'boots', name: '疾風の靴', desc: '移動速度 +1.2', cost: 600, icon: 'boots', stats: { speed: 1.2 } },
  { id: 'pendant', name: '生命のペンダント', desc: 'HP +300 / HP自動回復 +4', cost: 750, icon: 'gem', stats: { hp: 300, hpRegen: 4 } },
  { id: 'gauntlet', name: '雷帝の篭手', desc: '攻撃速度 +25%', cost: 850, icon: 'gauntlet', stats: { atkSpeed: 0.25 } },
  { id: 'pact', name: '魔王の契約書', desc: '攻撃力 +90 / HP +200', cost: 1700, icon: 'scroll', stats: { atk: 90, hp: 200 } },
  { id: 'kingblade', name: '王剣エーテルバスター', desc: '攻撃力 +140', cost: 2600, icon: 'blade', stats: { atk: 140 } },
];
