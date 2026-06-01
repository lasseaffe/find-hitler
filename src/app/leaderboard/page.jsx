'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEntries } from '@/lib/leaderboard'
import Leaderboard from '@/components/Leaderboard'
import HitlerMark from '@/components/ui/HitlerMark'

export default function LeaderboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])

  useEffect(() => { setEntries(getEntries()) }, [])

  return (
    <div className="min-h-screen bg-paper px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-end justify-between border-b-4 border-ink pb-4">
          <div className="flex items-center gap-3">
            <HitlerMark size={40} />
            <div>
              <h1 className="text-3xl">Leaderboard</h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Your local race history</p>
            </div>
          </div>
          <button onClick={() => router.push('/')} className="border-[3px] border-ink px-4 py-2 font-display uppercase text-xs tracking-wide hover:bg-paper-dim cursor-pointer">
            ← Home
          </button>
        </div>
        <Leaderboard entries={entries} />
      </div>
    </div>
  )
}
