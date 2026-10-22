'use client';

// ============================================================
// AETHER LEAGUE - 設定 (グラフィック / 操作 / 一般 / スマホ)
// ※ 絵文字不使用: すべて SVG アイコンで描画
// ============================================================

import { useEffect, useState } from 'react';
import type { ActionKey, GraphicsTier, SaveData } from '@/game/types';
import { ACTION_LABELS, DEFAULT_KEYBINDS, GRAPHICS_INFO, keyLabel } from '@/game/storage';
import { DynButton, SectionTitle, Slider, Toggle } from '../ui';
import {
  ScreenIcon, GamepadIcon, WrenchIcon, PhoneIcon, WarningIcon, InfoIcon,
  LeafIcon, StarIcon, GemIcon, FlameIcon, GalaxyIcon, CheckIcon,
} from '../Icons';

type Tab = 'graphics' | 'controls' | 'general' | 'mobile';

const TIERS: GraphicsTier[] = ['low', 'medium', 'high', 'ultra', 'ultimate'];
const TIER_PERF: Record<GraphicsTier, string> = {
  low: '60fps 最優先',
  medium: 'アンリアルエンジン並み',
  high: 'アンリアルエンジン以上',
  ultra: 'アンリアルを超える絶景',
  ultimate: '銀河級の絶景 + 軽量設計',
};
const TIER_ICON: Record<GraphicsTier, React.ReactNode> = {
  low: <LeafIcon size={26} className="text-emerald-300" />,
  medium: <StarIcon size={26} className="text-sky-300" />,
  high: <GemIcon size={26} className="text-cyan-200" />,
  ultra: <FlameIcon size={26} className="text-orange-300" />,
  ultimate: <GalaxyIcon size={26} className="text-violet-300" />,
};

const ACTION_ORDER: ActionKey[] = ['up', 'down', 'left', 'right', 'attack', 'guard', 'skill1', 'skill2', 'ult', 'menu', 'status', 'shop', 'ping'];

const TABS: [Tab, string, React.ReactNode][] = [
  ['graphics', 'グラフィック', <ScreenIcon size={13} key="g" />],
  ['controls', '操作', <GamepadIcon size={13} key="c" />],
  ['general', '一般', <WrenchIcon size={13} key="s" />],
  ['mobile', 'スマホオプション', <PhoneIcon size={13} key="m" />],
];

export function SettingsScreen({
  save, onBack, onChange, onReset,
}: {
  save: SaveData;
  onBack: () => void;
  onChange: (patch: (s: SaveData) => SaveData) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>('graphics');
  const [binding, setBinding] = useState<ActionKey | null>(null);

  // キーバインドキャプチャ
  useEffect(() => {
    if (!binding) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') { setBinding(null); return; }
      onChange((s) => ({
        ...s,
        settings: {
          ...s.settings,
          keybinds: { ...s.settings.keybinds, [binding]: e.code },
        },
      }));
      setBinding(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [binding, onChange]);

  const setGfx = (g: GraphicsTier) => onChange((s) => ({ ...s, settings: { ...s.settings, graphics: g } }));
  const setPerf = <K extends keyof SaveData['settings']['perf']>(k: K, v: SaveData['settings']['perf'][K]) =>
    onChange((s) => ({ ...s, settings: { ...s.settings, perf: { ...s.settings.perf, [k]: v } } }));
  const setGen = <K extends keyof SaveData['settings']>(k: K, v: SaveData['settings'][K]) =>
    onChange((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  const setMobile = <K extends keyof SaveData['settings']['mobile']>(k: K, v: SaveData['settings']['mobile'][K]) =>
    onChange((s) => ({ ...s, settings: { ...s.settings, mobile: { ...s.settings.mobile, [k]: v } } }));

  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between gap-2 border-b border-sky-400/10 bg-[#0a1024]/80 px-3 py-2 sm:px-4 sm:py-3">
        <h1 className="whitespace-nowrap font-display text-base font-bold tracking-widest text-white sm:text-lg">設定</h1>
        <DynButton variant="ghost" className="whitespace-nowrap px-3 py-2 text-xs sm:px-4" onClick={onBack}>← 戻る</DynButton>
      </header>

      {/* タブ */}
      <div className="game-scroll flex gap-1 overflow-x-auto border-b border-sky-400/10 bg-[#0a0f22]/60 px-2 sm:px-4">
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-[11px] font-bold transition-colors sm:px-4 sm:py-3 sm:text-xs ${tab === id ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {icon}
            {label}
            {tab === id && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(79,209,255,0.9)]" />}
          </button>
        ))}
      </div>

      <div className="game-scroll min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'graphics' && (
          <div className="mx-auto max-w-3xl">
            <SectionTitle sub="描画品質を選択。アルティメットでは草木のポリゴンが激増し、圧倒的な鮮明さになる (それでいて軽量)。">グラフィック品質</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {TIERS.map((t) => {
                const active = save.settings.graphics === t;
                const info = GRAPHICS_INFO[t];
                return (
                  <button
                    key={t}
                    onClick={() => setGfx(t)}
                    className={`char-card rounded-xl border-2 p-4 text-left ${active ? 'border-sky-400 bg-sky-500/10 shadow-[0_0_24px_rgba(79,209,255,0.3)]' : 'border-sky-400/15 bg-white/[0.03]'}`}
                  >
                    <div className="flex items-center gap-3">
                      {TIER_ICON[t]}
                      <div>
                        <div className="font-display text-base font-black text-white">{info.label}<span className="ml-2 text-[10px] tracking-widest text-slate-400">{t.toUpperCase()}</span></div>
                        <div className="text-[11px] font-bold text-sky-300">{TIER_PERF[t]}</div>
                      </div>
                      {active && <span className="ml-auto rounded bg-sky-400 px-2 py-0.5 text-[10px] font-black text-sky-950">適用中</span>}
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-slate-400">{info.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* 軽量化設定 */}
            <div className="mt-6">
              <SectionTitle sub="重いと感じたらここを調整。見た目をほぼ保ったまま軽くなる。">軽量化設定</SectionTitle>
              <div className="space-y-2.5">
                <Row label="軽量モード" desc="影とブルーム発光をOFF・解像度を抑えて大幅軽量化">
                  <Toggle on={save.settings.perf.lightMode} onChange={(v) => setPerf('lightMode', v)} />
                </Row>
                <Row label="FPS制限" desc="フレームレートを制限して発熱・電池消費を抑える">
                  <div className="flex gap-1">
                    {([0, 30, 60] as const).map((cap) => (
                      <button
                        key={cap}
                        onClick={() => setPerf('fpsCap', cap)}
                        className={`rounded-md border px-3 py-1.5 text-[11px] font-bold transition-all ${
                          save.settings.perf.fpsCap === cap
                            ? 'border-sky-400 bg-sky-500/25 text-white'
                            : 'border-sky-400/25 bg-sky-500/5 text-slate-300 hover:bg-sky-500/15'
                        }`}
                      >
                        {cap === 0 ? '無制限' : `${cap}fps`}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label={`エフェクト量 (${Math.round(save.settings.perf.effectScale * 100)}%)`} desc="パーティクル (火花・魔法の輝き) の量を減らす">
                  <Slider value={save.settings.perf.effectScale} min={0.3} max={1} step={0.05} onChange={(v) => setPerf('effectScale', v)} />
                </Row>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-200/80">
              <InfoIcon size={14} className="mt-0.5 shrink-0" />
              <span>アルティメット: 影解像度4096・環境粒子3.6倍・弾に動的ライト・草木のポリゴン激増。高性能PC向け (それでいて軽量!)。</span>
            </div>
          </div>
        )}

        {tab === 'controls' && (
          <div className="mx-auto max-w-2xl">
            <SectionTitle sub="アクションをクリックしてから、割り当てたいキーを押してください。">キーコンフィグ</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-sky-400/15">
              {ACTION_ORDER.map((a, i) => (
                <div key={a} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                  <span className="w-36 text-xs font-bold text-slate-200">{ACTION_LABELS[a]}</span>
                  <button
                    onClick={() => setBinding(a)}
                    className={`min-w-20 rounded-md border px-3 py-1.5 font-mono text-xs font-bold transition-all
                      ${binding === a
                        ? 'animate-pulse border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/25'}`}
                  >
                    {binding === a ? 'キーを押して…' : keyLabel(save.settings.keybinds[a])}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <DynButton variant="ghost" className="px-4 py-2 text-xs" onClick={() => onChange((s) => ({ ...s, settings: { ...s.settings, keybinds: { ...DEFAULT_KEYBINDS } } }))}>
                デフォルトに戻す
              </DynButton>
            </div>
            <div className="mt-4 rounded-lg border border-sky-400/15 bg-white/[0.03] p-3 text-[11px] leading-5 text-slate-400">
              <InfoIcon size={12} className="mr-1 inline align-[-1px]" />
              操作方法: <b className="text-slate-200">WASD</b> 移動 / <b className="text-slate-200">SPACE</b> 攻撃・決定 / <b className="text-slate-200">Q・E</b> スキル / <b className="text-slate-200">R</b> 必殺技 / <b className="text-slate-200">F</b> ガード / <b className="text-slate-200">C</b> メニュー / <b className="text-slate-200">Tab</b> プレイヤー状態 / <b className="text-slate-200">T</b> 指令ホイール
            </div>
          </div>
        )}

        {tab === 'general' && (
          <div className="mx-auto max-w-2xl space-y-5">
            <SectionTitle>一般</SectionTitle>
            <div className="rounded-xl border border-sky-400/15 bg-white/[0.03] p-4">
              <label className="text-xs font-bold text-slate-300">プレイヤーネーム</label>
              <input
                value={save.playerName}
                maxLength={12}
                onChange={(e) => onChange((s) => ({ ...s, playerName: e.target.value }))}
                className="mt-2 w-56 rounded-lg border border-sky-400/25 bg-[#0c1430] px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              />
            </div>
            <Row label={`BGM音量 (${save.settings.bgm})`}><Slider value={save.settings.bgm} onChange={(v) => setGen('bgm', v)} /></Row>
            <Row label={`効果音 (${save.settings.se})`}><Slider value={save.settings.se} onChange={(v) => setGen('se', v)} /></Row>
            <Row label="カメラシェイク" desc="必殺技やタワー破壊時に画面が揺れる"><Toggle on={save.settings.cameraShake} onChange={(v) => setGen('cameraShake', v)} /></Row>
            <Row label="アナウンス表示" desc="ファーストブラッド等の演出"><Toggle on={save.settings.announcements} onChange={(v) => setGen('announcements', v)} /></Row>
            <Row label="FPS表示"><Toggle on={save.settings.showFps} onChange={(v) => setGen('showFps', v)} /></Row>
            <div className="pt-2">
              <DynButton variant="danger" className="px-4 py-2 text-xs" onClick={() => { if (confirm('全データを初期化します。よろしいですか？')) onReset(); }}>
                <WarningIcon size={13} /> セーブデータ初期化
              </DynButton>
            </div>
          </div>
        )}

        {tab === 'mobile' && (
          <div className="mx-auto max-w-2xl space-y-5">
            <SectionTitle sub="スマートフォン・タブレット向けのオプションです。">スマホオプション</SectionTitle>
            <Row label="タッチ操作を有効化" desc="画面に移動スティックとスキルボタンを表示">
              <Toggle
                on={save.settings.mobile.enabled}
                onChange={(v) => setMobile('enabled', v)}
              />
            </Row>
            <Row label="自動検出" desc="タッチデバイスで自動的にONにする"><Toggle on={save.settings.mobile.autoDetect} onChange={(v) => setMobile('autoDetect', v)} /></Row>
            <Row label={`ボタンサイズ (${Math.round(save.settings.mobile.buttonSize * 100)}%)`}>
              <Slider value={save.settings.mobile.buttonSize} min={0.8} max={1.4} step={0.05} onChange={(v) => setMobile('buttonSize', v)} />
            </Row>
            <Row label={`ボタン不透明度 (${Math.round(save.settings.mobile.opacity * 100)}%)`}>
              <Slider value={save.settings.mobile.opacity} min={0.3} max={1} step={0.05} onChange={(v) => setMobile('opacity', v)} />
            </Row>
            <Row label="長押しコピー防止" desc="ボタン長押しでテキスト選択が出ないようにする">
              <Toggle on={save.settings.mobile.preventCopy} onChange={(v) => setMobile('preventCopy', v)} />
            </Row>
            <Row label="バイブレーション" desc="対応端末でダメージ時に振動"><Toggle on={save.settings.mobile.haptics} onChange={(v) => setMobile('haptics', v)} /></Row>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3 text-[11px] leading-5 text-emerald-200/80">
              <CheckIcon size={14} className="mt-0.5 shrink-0" />
              <span>長押しコピー防止が有効の場合、ゲーム画面全体でユーザー選択・長押しメニュー・タップハイライトを無効化します。</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-sky-400/15 bg-white/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-200">{label}</div>
        {desc && <div className="mt-0.5 text-[10px] text-slate-500">{desc}</div>}
      </div>
      {children}
    </div>
  );
}
