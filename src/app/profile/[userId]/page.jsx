'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import RankBadge from '@/components/RankBadge'
import HitlerMark from '@/components/ui/HitlerMark'

export default function PublicProfilePage() {
  const { userId } = useParams()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/profile/public?userId=${userId}`)
      .then(r => r.json())
      .then(setData)
  }, [userId])

  if (!data?.user) return (
    <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">
      {data === null ? 'Loading…' : 'Profile not found.'}
    </div>
  )

  const { user, stats } = data
  return (
    <div className="min-h-screen bg-paper px-4 py-8">
      <main className="mx-auto max-w-2xl border-4 border-ink bg-paper">
        <div className="flex items-center gap-3 border-b-4 border-ink px-5 py-4">
          <HitlerMark size={40} />
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-ink/60">Player</div>
            <h1 className="text-2xl">{user.name || 'Anonymous'}</h1>
          </div>
          <div className="ml-auto"><RankBadge rank={user.rank} elo={user.elo} size="sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-[3px] border-b-4 border-ink bg-ink">
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Matches</div>
            <div className="font-display text-2xl">{stats.totalMatches}</div>
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Wins</div>
            <div className="font-display text-2xl text-red">{stats.wins}</div>
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Win Rate</div>
            <div className="font-display text-2xl">{stats.winRate}%</div>
          </div>
        </div>
        <div className="px-5 py-4">
          <a href="/" className="font-mono text-[9px] uppercase tracking-widest text-ink/60 hover:text-red">← Home</a>
        </div>
      </main>
    </div>
  )
}
