'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import HitlerMark from '@/components/ui/HitlerMark'
import { RedButton } from '@/components/ui/primitives'

export default function JoinPage({ params }) {
  const { code } = use(params)
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')

  const handleJoin = () => {
    if (!playerName.trim()) return
    sessionStorage.setItem('playerName', playerName.trim())
    router.push(`/lobby/${code}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <main className="w-full max-w-xs border-4 border-ink bg-paper">
        <div className="border-b-4 border-ink px-5 py-5 text-center">
          <HitlerMark size={44} className="mx-auto" />
          <h1 className="mt-3 text-2xl">Join Room</h1>
          <div className="mt-1 font-display text-3xl tracking-[0.15em] text-red">{code}</div>
        </div>
        <div className="space-y-4 px-5 py-5">
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="enter codename"
            className="w-full border-[3px] border-ink bg-paper px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
          />
          <RedButton onClick={handleJoin}>Join →</RedButton>
        </div>
      </main>
    </div>
  )
}
