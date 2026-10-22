'use client'

import dynamic from 'next/dynamic'

const GameApp = dynamic(() => import('@/components/game/GameApp'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#05070f]">
      <div className="font-display text-sm tracking-[0.5em] text-sky-300/80">AETHER LEAGUE</div>
    </div>
  ),
})

export default function Home() {
  return <GameApp />
}
