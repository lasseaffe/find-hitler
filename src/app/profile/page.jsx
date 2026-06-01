'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RankBadge from '@/components/RankBadge'
import HitlerMark from '@/components/ui/HitlerMark'

function formatSeconds(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

const loadingScreen = (
  <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>
)

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/profile').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [status, router])

  if (loading || status === 'loading') return loadingScreen
  if (!data?.user) {
    return <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">No profile data.</div>
  }

  const { user, matches, stats } = data

  return (
    <div className="min-h-screen bg-paper px-4 py-8">
      <main className="mx-auto max-w-3xl border-4 border-ink bg-paper">
        {/* masthead */}
        <div className="flex items-center justify-between border-b-4 border-ink px-5 py-4">
          <div className="flex items-center gap-3">
            <HitlerMark size={44} />
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-ink/60">Codename</div>
              <h1 className="text-2xl">{user.name || user.email}</h1>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="border-[3px] border-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-paper-dim cursor-pointer">
            Sign Out
          </button>
        </div>

        {/* stat grid */}
        <div className="grid grid-cols-3 gap-[3px] border-b-4 border-ink bg-ink">
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-ink/60">Rank</div>
            <RankBadge rank={user.rank} elo={user.elo} size="sm" />
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-ink/60">Matches</div>
            <div className="font-display text-2xl">{stats.totalMatches}</div>
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-ink/60">Win Rate</div>
            <div className="font-display text-2xl text-red">{stats.winRate}%</div>
          </div>
        </div>

        {/* match history */}
        <div className="px-5 py-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Match History</div>
          {matches.length === 0 ? (
            <div className="border-[3px] border-ink px-6 py-8 text-center font-mono text-xs text-ink/60">
              No matches yet. <a href="/" className="text-red underline">Play a race</a> to begin.
            </div>
          ) : (
            <div className="border-[3px] border-ink">
              {matches.map((m, i) => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 font-mono text-xs ${i > 0 ? 'border-t-2 border-ink' : ''} ${m.won ? '' : 'bg-paper-dim'}`}>
                  <span className={`font-display ${m.won ? 'text-red' : 'text-ink/50'}`}>{m.won ? 'WON' : 'LOST'}</span>
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-display uppercase">{m.target}</span>
                    <span className="ml-2 uppercase text-ink/50">{m.mode}</span>
                  </div>
                  <span className="flex-none">{m.clicks} clk</span>
                  <span className="flex-none text-ink/50">{formatSeconds(m.seconds)}</span>
                  {m.eloChange !== 0 && (
                    <span className={`flex-none font-display ${m.eloChange > 0 ? 'text-red' : 'text-ink/50'}`}>
                      {m.eloChange > 0 ? '+' : ''}{m.eloChange}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-[3px] border-t-4 border-ink bg-ink">
          <a href="/" className="bg-paper py-3 text-center font-display uppercase text-sm tracking-wide hover:bg-paper-dim">← Home</a>
          <a href="/ranked" className="bg-red py-3 text-center font-display uppercase text-sm tracking-wide text-paper hover:brightness-110">Ranked Duels ⚔</a>
        </div>
      </main>
    </div>
  )
}
