'use client';

// ============================================================
// AETHER LEAGUE - トロフィー / バトルパス / ログインボーナス
// ============================================================

import type { SaveData } from '@/game/types';
import { BP_MAX_TIER, BP_TIER_EXP, LOGIN_REWARDS, TROPHIES, bpRewardFor } from '@/game/storage';
import { DynButton, CoinIcon, SectionTitle } from '../ui';
import { TrophyIcon, TicketIcon, GiftIcon, LockIcon, CheckIcon, RewardIcon } from '../Icons';

export function TrophyScreen({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between border-b border-sky-400/10 bg-[#0a1024]/80 px-4 py-3">
        <h1 className="flex items-center gap-2 whitespace-nowrap font-display text-base font-bold tracking-widest text-white sm:text-lg"><TrophyIcon size={17} /> トロフィー</h1>
        <DynButton variant="ghost" className="whitespace-nowrap px-3 py-2 text-xs sm:px-4" onClick={onBack}>← 戻る</DynButton>
      </header>
      <div className="game-scroll min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="hud-panel rounded-lg px-4 py-2 text-sm">
              <span className="text-slate-400">獲得率 </span>
              <span className="font-display text-xl font-black text-amber-300">
                {Math.round((save.trophies.unlocked.length / TROPHIES.length) * 100)}%
              </span>
              <span className="text-slate-400"> ({save.trophies.unlocked.length}/{TROPHIES.length})</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TROPHIES.map((t) => {
              const unlocked = save.trophies.unlocked.includes(t.id);
              return (
                <div
                  key={t.id}
                  className={`trophy-card rounded-xl border p-4 ${unlocked
                    ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-transparent shadow-[0_0_18px_rgba(255,198,92,0.15)]'
                    : 'border-slate-700 bg-white/[0.02] opacity-70'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${unlocked ? 'bg-amber-400/20 text-amber-300 shadow-[0_0_16px_rgba(255,198,92,0.4)]' : 'bg-slate-800 text-slate-600'}`}>
                      {unlocked ? <RewardIcon id={t.icon} size={24} /> : <LockIcon size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-bold ${unlocked ? 'text-amber-200' : 'text-slate-300'}`}>{t.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{t.desc}</div>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-300/80">
                        <CoinIcon className="h-3.5 w-3.5" /> 報酬 {t.reward}コイン
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BattlePassScreen({
  save, onBack, onClaim, onBuyPremium,
}: {
  save: SaveData;
  onBack: () => void;
  onClaim: (tier: number, premium: boolean) => void;
  onBuyPremium: () => void;
}) {
  const bp = save.battlePass;
  const tiers = Array.from({ length: BP_MAX_TIER }, (_, i) => i + 1);
  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between gap-2 border-b border-sky-400/10 bg-[#0a1024]/80 px-3 py-2 sm:px-4 sm:py-3">
        <h1 className="flex items-center gap-2 whitespace-nowrap font-display text-base font-bold tracking-widest text-white sm:text-lg"><TicketIcon size={17} /> バトルパス S1</h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!bp.premium && (
            <DynButton variant="gold" className="whitespace-nowrap px-3 py-2 text-[11px] sm:px-4 sm:text-xs" onClick={onBuyPremium}>
              👑 プレミアム解放 (980¢)
            </DynButton>
          )}
          {bp.premium && <span className="hidden rounded bg-amber-400/90 px-2 py-1 text-[10px] font-black text-amber-950 sm:inline">PREMIUM有効</span>}
          <DynButton variant="ghost" className="whitespace-nowrap px-3 py-2 text-xs sm:px-4" onClick={onBack}>← 戻る</DynButton>
        </div>
      </header>
      <div className="border-b border-sky-400/10 bg-[#0a0f22]/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-black text-white">TIER <span className="text-glow-gold">{bp.tier}</span></span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 transition-[width]"
              style={{ width: `${(bp.exp / BP_TIER_EXP) * 100}%`, boxShadow: '0 0 12px rgba(79,209,255,0.7)' }}
            />
          </div>
          <span className="text-xs text-slate-400">{bp.exp}/{BP_TIER_EXP} BP</span>
        </div>
      </div>
      <div className="game-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-5xl gap-3 overflow-x-auto pb-2">
          {tiers.map((tier) => {
            const reached = tier <= bp.tier;
            const reward = bpRewardFor(tier);
            const freeClaimed = bp.claimedFree.includes(tier);
            const premClaimed = bp.claimedPremium.includes(tier);
            return (
              <div key={tier} className={`bp-tier-line w-40 shrink-0 rounded-xl border p-3 ${reached ? 'border-sky-400/40 bg-sky-500/5' : 'border-slate-700/60 bg-white/[0.01] opacity-60'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`font-display text-sm font-black ${reached ? 'text-sky-300' : 'text-slate-500'}`}>TIER {tier}</span>
                  {tier % 10 === 0 && <span className="rounded bg-rose-500/80 px-1.5 text-[9px] font-black text-white">MAJOR</span>}
                </div>
                {/* フリートラック */}
                <div className="mb-2 rounded-lg border border-slate-600/50 bg-[#0c1228] p-2">
                  <div className="text-[9px] tracking-widest text-slate-500">FREE</div>
                  <div className="mt-0.5 text-[11px] font-bold text-slate-200">{reward.free.label}</div>
                  <DynButton
                    variant={freeClaimed ? 'ghost' : 'primary'}
                    disabled={!reached || freeClaimed}
                    className="mt-1.5 w-full px-2 py-1.5 text-[10px]"
                    onClick={() => onClaim(tier, false)}
                  >
                    {freeClaimed ? '受取済' : reached ? '受け取る' : '未解放'}
                  </DynButton>
                </div>
                {/* プレミアムトラック */}
                <div className="rounded-lg border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-[#0c1228] p-2">
                  <div className="text-[9px] tracking-widest text-amber-400">PREMIUM</div>
                  <div className="mt-0.5 text-[11px] font-bold text-amber-200">{reward.premium.label}</div>
                  <DynButton
                    variant={premClaimed ? 'ghost' : 'gold'}
                    disabled={!reached || premClaimed || !bp.premium}
                    className="mt-1.5 w-full px-2 py-1.5 text-[10px]"
                    onClick={() => onClaim(tier, true)}
                  >
                    {premClaimed ? '受取済' : !bp.premium ? '未購入' : reached ? '受け取る' : '未解放'}
                  </DynButton>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mx-auto mt-3 max-w-5xl rounded-lg border border-sky-400/15 bg-white/[0.03] p-3 text-[11px] text-slate-400">
          💡 試合をプレイしてBPを獲得: 勝利 +60 / 敗北 +30 / キル1回ごと +6。TIER10・20・30でレアスキン解放！
        </div>
      </div>
    </div>
  );
}

export function LoginBonusModal({
  save, onClaim, onClose,
}: {
  save: SaveData;
  onClaim: () => void;
  onClose: () => void;
}) {
  const dayIdx = save.login.dayIndex;
  const canClaim = save.login.available;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="slide-up-in hud-panel w-full max-w-lg rounded-2xl p-6">
        <div className="text-center">
          <div className="flex justify-center text-emerald-300"><GiftIcon size={30} /></div>
          <h2 className="font-display mt-2 text-xl font-black tracking-widest text-white">ログインボーナス</h2>
          <p className="mt-1 text-xs text-slate-400">連続ログイン <span className="font-bold text-sky-300">{save.login.streak}日</span> - 7日サイクルでリセット</p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {LOGIN_REWARDS.map((r, i) => {
            const done = i < dayIdx || (!canClaim && i === dayIdx);
            const today = i === dayIdx && canClaim;
            return (
              <div
                key={r.day}
                className={`rounded-lg border p-2 text-center ${today
                  ? 'border-amber-400 bg-amber-400/15 shadow-[0_0_16px_rgba(255,198,92,0.4)]'
                  : done ? 'border-emerald-500/30 bg-emerald-500/10 opacity-70' : 'border-slate-700 bg-white/[0.02] opacity-60'}`}
              >
                <div className="text-[9px] tracking-widest text-slate-400">DAY {r.day}</div>
                <div className="my-1 flex justify-center text-xl">{done ? <span className="text-emerald-300"><CheckIcon size={20} /></span> : <RewardIcon id={r.icon} size={22} />}</div>
                <div className="text-[9px] font-bold text-slate-300">{r.label}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {canClaim && (
            <DynButton variant="gold" className="whitespace-nowrap px-5 py-3 sm:px-8" onClick={onClaim}>
              DAY {dayIdx + 1} の報酬を受け取る
            </DynButton>
          )}
          <DynButton variant="ghost" className="whitespace-nowrap px-6 py-3" onClick={onClose}>{canClaim ? '後で' : '閉じる'}</DynButton>
        </div>
      </div>
    </div>
  );
}

export function MissionSummary({ save }: { save: SaveData }) {
  void save;
  return <SectionTitle>ミッション</SectionTitle>;
}
