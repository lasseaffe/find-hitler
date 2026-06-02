'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEntries } from '@/lib/leaderboard'
import Leaderboard from '@/components/Leaderboard'
import HitlerMark from '@/components/ui/HitlerMark'

export default function LeaderboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [tab, setTab] = useState('global')
  const [friends, setFriends] = useState([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)

  useEffect(() => { setEntries(getEntries()) }, [])

  useEffect(() => {
    if (tab === 'friends' && !friendsLoaded) {
      fetch('/api/leaderboard/friends')
        .then(r => r.json())
        .then(d => { setFriends(d.entries ?? []); setFriendsLoaded(true) })
        .catch(() => setFriendsLoaded(true))
    }
  }, [tab, friendsLoaded])

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
        <div className="flex gap-3 mb-4">
          {['global', 'friends'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-[3px] px-4 py-2 font-mono text-xs uppercase tracking-wide ${
                tab === t ? 'border-ink bg-ink text-paper' : 'border-ink text-ink hover:bg-paper-dim'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'friends' ? (
          <div>
            {friends.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-wider text-ink/60 py-8 text-center">
                No friends yet — challenge someone first!
              </p>
            ) : (
              <div className="border-t-4 border-ink">
                {friends.map((f, i) => (
                  <div key={f.id} className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
                    <span className="font-display uppercase text-sm">{String(i + 1).padStart(2, '0')} · {f.name || 'Anonymous'}</span>
                    <span className="font-mono text-xs text-ink/60">{f.elo} ELO · {f.rank?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Leaderboard entries={entries} />
        )}
      </div>
    </div>
  )
}
