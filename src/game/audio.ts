'use client';

// ============================================================
// AETHER LEAGUE - オーディオマネージャ
// WebAudio 手続き生成 (音源ファイル不要・オフライン完結)
//   BGM: タイトル (穏やか) / バトル (激しい) の2トラック
//   SE : 攻撃・スキル・キル・タワー・購入・カウントダウン等
// 自動再生ポリシー対応: init() は最初のユーザー操作で呼ぶ
// ============================================================

type BgmTrack = 'title' | 'battle';

class AudioMgr {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private bgmVol = 0.6;  // 0-1
  private seVol = 0.8;   // 0-1

  private track: BgmTrack | null = null;
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;

  /** 最初のユーザー操作時に1回だけ呼ぶ (以後は安全な no-op) */
  init() {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 8;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.bgmGain = this.ctx.createGain();
      this.seGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmVol * 0.5;
      this.seGain.gain.value = this.seVol;
      this.bgmGain.connect(this.master);
      this.seGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // ノイズバッファ (2秒・白)
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 既存の BGM リクエストがあれば開始
      if (this.track) this.startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(bgm0to100: number, se0to100: number) {
    this.bgmVol = Math.max(0, Math.min(1, bgm0to100 / 100));
    this.seVol = Math.max(0, Math.min(1, se0to100 / 100));
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVol * 0.5;
    if (this.seGain) this.seGain.gain.value = this.seVol;
  }

  // ============================================================
  // BGM: 16分音符ステップシーケンサ (先読みスケジューリング)
  // ============================================================

  playBgm(track: BgmTrack) {
    if (this.track === track && this.schedTimer) return;
    this.track = track;
    this.step = 0;
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.ctx) this.startScheduler();
  }

  stopBgm() {
    this.track = null;
    if (this.schedTimer) { clearInterval(this.schedTimer); this.schedTimer = null; }
  }

  private startScheduler() {
    if (!this.ctx || this.schedTimer) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.schedTimer = setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    if (!this.ctx || !this.track) return;
    const spb16 = this.track === 'battle' ? 60 / 140 / 4 : 60 / 104 / 4; // 16分の長さ
    while (this.nextTime < this.ctx.currentTime + 0.14) {
      this.playStep(this.track, this.step, this.nextTime, spb16);
      this.nextTime += spb16;
      this.step = (this.step + 1) % 64;
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, slide?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, vol: number, dest: GainNode, hp = 0, lp = 12000) {
    if (!this.ctx || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = s;
    if (hp > 0) { const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp < 12000) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // 和音進行 (周波数比): Am - F - C - G を 1 小節 (16step) ずつ
  private static CHORDS = [
    [220.0, 261.6, 329.6], // Am
    [174.6, 220.0, 261.6], // F
    [196.0, 246.9, 293.7], // G (後半)
    [261.6, 329.6, 392.0], // C
  ];

  private playStep(track: BgmTrack, step: number, t: number, spb16: number) {
    const bgm = this.bgmGain;
    if (!bgm) return;
    const bar = Math.floor(step / 16) % 4;
    const chord = AudioMgr.CHORDS[bar];
    const s16 = step % 16;

    if (track === 'title') {
      // ===== タイトル: 穏やかパッド + そよぐアルペジオ =====
      if (s16 === 0) {
        for (const f of chord) this.tone(f / 2, t, spb16 * 15, 'triangle', 0.05, bgm);
        this.tone(chord[0], t, spb16 * 14, 'sine', 0.035, bgm);
      }
      if (s16 % 4 === 2) {
        const f = chord[(step / 4) % 3 | 0] * 2;
        this.tone(f, t, spb16 * 2.4, 'sine', 0.045, bgm);
      }
      if (s16 === 8) this.tone(chord[2] * 2, t, spb16 * 6, 'sine', 0.03, bgm);
    } else {
      // ===== バトル: ドライブ感あるベース + アルペジオ + ビート =====
      // キック
      if (s16 % 4 === 0) this.tone(150, t, 0.13, 'sine', 0.5, bgm, 42);
      // ハット
      if (s16 % 2 === 1) this.noise(t, 0.035, 0.05, bgm, 6500);
      // スネア (2, 4拍目)
      if (s16 === 4 || s16 === 12) this.noise(t, 0.11, 0.16, bgm, 1800, 9000);
      // ベース (ルート音・8分刻み)
      if (s16 % 2 === 0) this.tone(chord[0] / 2, t, spb16 * 1.7, 'square', 0.09, bgm);
      // アルペジオ (16分)
      const arpNote = chord[step % 3] * (step % 8 < 4 ? 2 : 4);
      this.tone(arpNote, t, spb16 * 0.9, 'triangle', 0.055, bgm);
      // コードスタブ (小節頭)
      if (s16 === 0 || s16 === 10) {
        for (const f of chord) this.tone(f, t, spb16 * 2.2, 'sawtooth', 0.022, bgm);
      }
    }
  }

  // ============================================================
  // SE
  // ============================================================

  sfx(name: string) {
    if (!this.ctx || !this.seGain || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const g = this.seGain;
    switch (name) {
      case 'click':
        this.tone(760, t, 0.06, 'square', 0.14, g, 980);
        break;
      case 'hover':
        this.tone(520, t, 0.04, 'sine', 0.05, g, 560);
        break;
      case 'hit':
        this.noise(t, 0.09, 0.22, g, 900, 7000);
        this.tone(190, t, 0.09, 'triangle', 0.2, g, 90);
        break;
      case 'cast':
        this.tone(340, t, 0.17, 'sine', 0.2, g, 980);
        this.noise(t, 0.12, 0.06, g, 2200);
        break;
      case 'cast-bot':
        this.tone(280, t, 0.12, 'sine', 0.075, g, 620);
        break;
      case 'kill':
        this.tone(880, t, 0.09, 'square', 0.16, g);
        this.tone(660, t + 0.09, 0.14, 'square', 0.16, g);
        this.noise(t, 0.16, 0.2, g, 700, 6000);
        break;
      case 'death':
        this.tone(420, t, 0.5, 'sawtooth', 0.14, g, 110);
        this.noise(t, 0.3, 0.1, g, 300, 3000);
        break;
      case 'tower':
        this.noise(t, 0.7, 0.42, g, 120, 4200);
        this.tone(120, t, 0.6, 'sine', 0.4, g, 36);
        break;
      case 'tower-lose':
        this.noise(t, 0.6, 0.3, g, 120, 2600);
        this.tone(150, t, 0.5, 'sawtooth', 0.2, g, 60);
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.07, 0.16, 'triangle', 0.16, g));
        break;
      case 'buy':
        this.tone(1240, t, 0.07, 'sine', 0.16, g);
        this.tone(1860, t + 0.07, 0.12, 'sine', 0.14, g);
        break;
      case 'count':
        this.tone(880, t, 0.1, 'square', 0.16, g);
        break;
      case 'count-final':
        this.tone(1320, t, 0.22, 'square', 0.2, g);
        break;
      case 'start':
        [523, 659, 784].forEach((f) => this.tone(f, t, 0.3, 'square', 0.1, g));
        this.tone(1046, t + 0.05, 0.4, 'triangle', 0.14, g);
        this.noise(t, 0.25, 0.12, g, 3000);
        break;
      case 'invite':
        this.tone(660, t, 0.1, 'sine', 0.16, g);
        this.tone(990, t + 0.1, 0.16, 'sine', 0.16, g);
        break;
      case 'duel':
        this.tone(220, t, 0.24, 'sawtooth', 0.18, g, 440);
        this.noise(t, 0.2, 0.1, g, 1500);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, t + i * 0.13, 0.3, 'triangle', 0.17, g));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.2, 0.4, 'sine', 0.16, g));
        break;
      case 'gold':
        this.tone(1560, t, 0.06, 'sine', 0.1, g);
        break;
      // ---- マップギミック & フリル ----
      case 'horn':
        // 汽笛/警報: 2音のブレンド + 空気感
        this.tone(466, t, 0.55, 'sawtooth', 0.16, g, 440);
        this.tone(587, t, 0.55, 'sawtooth', 0.13, g, 554);
        this.tone(233, t, 0.6, 'triangle', 0.12, g);
        this.noise(t, 0.5, 0.05, g, 400, 2400);
        break;
      case 'ping':
        // 指令 (ピン): ソナー風の2連ブルップ
        this.tone(1180, t, 0.09, 'sine', 0.2, g, 1240);
        this.tone(1560, t + 0.1, 0.14, 'sine', 0.16, g, 1650);
        break;
      case 'summon':
        // 召喚: 上昇する2音 + 魔法の輝き
        this.tone(520, t, 0.12, 'triangle', 0.16, g, 700);
        this.tone(780, t + 0.09, 0.16, 'triangle', 0.16, g, 1050);
        this.tone(1560, t + 0.16, 0.2, 'sine', 0.12, g);
        this.noise(t + 0.05, 0.16, 0.05, g, 3000, 9000);
        break;
      case 'charge':
        // スタック回復 (パル): ふっくらした肯定音
        this.tone(660, t, 0.1, 'sine', 0.14, g);
        this.tone(990, t + 0.07, 0.13, 'sine', 0.12, g);
        break;
      case 'petdown':
        // 猟犬が倒れた: 低い減衰音
        this.tone(340, t, 0.3, 'triangle', 0.18, g, 130);
        this.noise(t, 0.2, 0.08, g, 600, 2400);
        break;
      case 'match':
        // マッチ成立: きらきらジングル
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.06, 0.14, 'triangle', 0.14, g));
        break;
      case 'splash':
        // 大波ギミック: 波の着水
        this.noise(t, 0.28, 0.24, g, 300, 3800);
        this.tone(320, t, 0.18, 'sine', 0.18, g, 90);
        this.tone(720, t + 0.05, 0.12, 'sine', 0.1, g, 300);
        break;
      case 'pickup':
        // オーブ取得: キラキラ上昇
        [660, 880, 1174].forEach((f, i) => this.tone(f, t + i * 0.06, 0.14, 'sine', 0.13, g));
        break;
      case 'sleep':
        // お昼寝: ゆるい子守音
        this.tone(523, t, 0.4, 'sine', 0.12, g, 470);
        this.tone(392, t + 0.25, 0.5, 'sine', 0.1, g, 350);
        this.noise(t, 0.5, 0.03, g, 200, 1200);
        break;
      case 'stun':
        // 気絶: ぐるぐる弱気音
        this.tone(620, t, 0.3, 'triangle', 0.14, g, 240);
        this.tone(430, t + 0.12, 0.28, 'triangle', 0.1, g, 200);
        break;
      case 'rage-charge':
        // 怒りチャージ: プンプン脈打つ低音 (だんだん荒ぶる)
        this.tone(98, t, 0.85, 'sawtooth', 0.16, g, 132);
        this.tone(147, t + 0.18, 0.7, 'square', 0.08, g, 196);
        this.noise(t + 0.1, 0.7, 0.07, g, 200, 900);
        break;
      case 'rage':
        // 大雷怒り: どなり声風の上昇 + 衝撃波ドン
        this.tone(180, t, 0.5, 'sawtooth', 0.2, g, 420);
        this.tone(240, t + 0.04, 0.45, 'square', 0.12, g, 560);
        this.noise(t + 0.3, 0.55, 0.28, g, 90, 1400);
        this.tone(72, t + 0.32, 0.6, 'sine', 0.3, g, 40);
        break;
      case 'cower':
        // ひより: びっくり「ひゃっ」風の下降ピコッ
        this.tone(880, t, 0.12, 'triangle', 0.14, g, 520);
        this.tone(660, t + 0.1, 0.16, 'triangle', 0.1, g, 380);
        break;
      case 'train-pass':
        // 電車通過音 (近接)
        this.noise(t, 1.6, 0.2, g, 180, 1600);
        this.tone(70, t, 1.5, 'sawtooth', 0.1, g, 52);
        break;
      case 'bed':
        // ベッド出現: ポフッ + コトッ + スプリング
        this.noise(t, 0.22, 0.14, g, 200, 900);
        this.tone(160, t + 0.12, 0.1, 'sine', 0.14, g, 120);
        this.tone(320, t + 0.24, 0.28, 'sine', 0.12, g, 210);
        this.tone(240, t + 0.4, 0.2, 'sine', 0.08, g, 300);
        break;
      case 'fall':
        // 奈落へ落下: 風切り音 (下降する唸り) + 「わーっ」的な下降ボイス風トーン
        this.noise(t, 0.9, 0.32, g, 500, 3800);
        this.tone(880, t, 0.75, 'sine', 0.14, g, 130);
        this.tone(1320, t + 0.06, 0.6, 'triangle', 0.07, g, 220);
        this.tone(70, t + 0.72, 0.3, 'sine', 0.22, g, 42);
        break;
      case 'fall-soft':
        // 他チャンプの落下 (少し遠くの風切り音)
        this.noise(t, 0.6, 0.16, g, 700, 3000);
        this.tone(760, t, 0.5, 'sine', 0.06, g, 180);
        break;
      case 'rescue':
        // 最寄りの足場へ救出転送: 着地ドスン + ほっとした上昇音
        this.noise(t, 0.16, 0.26, g, 120, 1400);
        this.tone(96, t, 0.2, 'sine', 0.3, g, 52);
        this.tone(520, t + 0.12, 0.14, 'triangle', 0.1, g, 780);
        this.tone(780, t + 0.22, 0.18, 'triangle', 0.08, g, 1040);
        break;
    }
  }
}

export const audio = new AudioMgr();
