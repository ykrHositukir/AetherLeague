'use client';

// ============================================================
// AETHER LEAGUE - オンラインロビー (ランダムマッチ 1vs1)
// GameClient (常駐接続) を共有。マッチ成立は GameApp の onMatch が処理し
// 直接バトル画面へ遷移するため、この画面はマッチ後自動で閉じる
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { SaveData } from '@/game/types';
import { GameClient } from '@/game/net/online';
import { DynButton } from '../ui';
import { GlobeIcon } from '../Icons';

function WarnGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 4 L21 19.5 H3 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M12 10 v4.4" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.05" fill="currentColor" />
    </svg>
  );
}
function SearchGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth={2.1} />
      <path d="M15.2 15.2 L20.5 20.5" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" />
    </svg>
  );
}

type Phase = 'idle' | 'searching' | 'error';

export function OnlineLobby({
  save, onBack, client,
}: {
  save: SaveData;
  onBack: () => void;
  client: GameClient | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('');
  const clientRef = useRef<GameClient | null>(client);
  clientRef.current = client;

  useEffect(() => {
    return () => {
      // 退出時に検索中ならキャンセル (マッチ済みならキュー外なので無害)
      clientRef.current?.cancelMatch();
    };
  }, []);

  const startSearch = () => {
    const gc = clientRef.current;
    if (!gc) { setPhase('error'); setMsg('通信モジュールが初期化されていません'); return; }
    setPhase('searching');
    setMsg('プレイヤーを探しています…');
    gc.findMatch(save.lastChar, save.playerName);
  };

  const cancel = () => {
    clientRef.current?.cancelMatch();
    setPhase('idle');
  };

  return (
    <div className="game-root flex flex-col bg-[#070b18]">
      <header className="flex items-center justify-between border-b border-sky-400/10 bg-[#0a1024]/80 px-4 py-3">
        <h1 className="flex items-center gap-2 font-display text-lg font-bold tracking-widest text-white"><GlobeIcon size={17} /> オンライン対戦 (1vs1)</h1>
        <DynButton variant="ghost" className="px-4 py-2 text-xs" onClick={onBack}>← 戻る</DynButton>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <div className="relative">
          <div className={`flex h-32 w-32 items-center justify-center rounded-full border-4 ${phase === 'searching' ? 'border-sky-400/30 border-t-sky-400' : 'border-sky-400/30'} ${phase === 'searching' ? 'animate-spin' : ''}`}>
            <span className="flex justify-center text-sky-300">{phase === 'idle' ? <GlobeIcon size={44} /> : phase === 'error' ? <WarnGlyph size={44} /> : <SearchGlyph size={44} />}</span>
          </div>
          {phase === 'searching' && (
            <>
              <div className="ring-expand absolute inset-0 rounded-full border-2 border-sky-400/60" />
              <div className="ring-expand absolute inset-0 rounded-full border-2 border-indigo-400/40" style={{ animationDelay: '0.5s' }} />
            </>
          )}
        </div>
        <div className="text-center">
          <div className="font-display text-2xl font-black tracking-widest text-white">
            {phase === 'idle' && '1 vs 1 RANKED'}
            {phase === 'searching' && 'マッチメイキング中…'}
            {phase === 'error' && 'エラー'}
          </div>
          <p className="mt-2 text-sm text-slate-400">{phase === 'idle' ? 'リアルプレイヤーとエーテル戦場で対戦。青チーム側がホスト(ワールド権威)になります。' : msg}</p>
          {phase === 'idle' && (
            <p className="mt-1 text-[11px] text-slate-500">使用キャラ: {save.lastChar} (メインメニューで選択したキャラを使用)</p>
          )}
        </div>
        {phase === 'idle' && (
          <div className="float-y">
            <DynButton variant="play" className="px-12" onClick={startSearch}>マッチを探す</DynButton>
          </div>
        )}
        {phase === 'searching' && (
          <DynButton variant="danger" className="px-8 py-3" onClick={cancel}>キャンセル</DynButton>
        )}
        {phase === 'error' && (
          <DynButton variant="primary" className="px-8 py-3" onClick={() => setPhase('idle')}>再試行</DynButton>
        )}
      </div>
    </div>
  );
}
