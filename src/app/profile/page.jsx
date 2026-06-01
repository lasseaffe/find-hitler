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

const MODE_COLORS = {
  classic:  { bg: '#2563eb', text: '#fff' },
  speedrun: { bg: '#b45309', text: '#fff' },
  golf:     { bg: '#166534', text: '#fff' },
  jesus:    { bg: '#1e40af', text: '#fff' },
  daily:    { bg: '#6b21a8', text: '#fff' },
  nohub:    { bg: '#374151', text: '#fff' },
  ranked:   { bg: '#0e0e0e', text: '#2563eb' },
}

function ModeBadge({ mode }) {
  const c = MODE_COLORS[mode] || { bg: '#222', text: '#fff' }
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 7, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>
      {mode}
    </span>
  )
}

function PathChain({ path }) {
  if (!path || path.length === 0) return <span style={{ color: '#555', fontFamily: 'ui-monospace,monospace', fontSize: 9 }}>—</span>
  const nodes = path.length > 5 ? [...path.slice(0, 2), '…', ...path.slice(-2)] : path
  return (
    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 9, color: '#666' }}>
      {nodes.map((n, i) => (
        <span key={i}>{i > 0 && <span style={{ color: '#333', margin: '0 3px' }}>›</span>}{n}</span>
      ))}
    </span>
  )
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'ranked' | 'classic' | 'other'
  const [showCount, setShowCount] = useState(20)

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
          <div className="flex items-center justify-between mb-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Match History</div>
            <div className="flex gap-[2px]">
              {['all','ranked','classic','other'].map(f => (
                <button key={f} onClick={() => { setFilter(f); setShowCount(20) }}
                  className={`font-mono text-[8px] uppercase tracking-[0.1em] px-2.5 py-1 border-[2px] border-ink cursor-pointer ${filter === f ? 'bg-ink text-paper' : 'bg-paper hover:bg-paper-dim'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const filtered = matches.filter(m => {
              if (filter === 'all') return true
              if (filter === 'ranked') return m.mode === 'ranked'
              if (filter === 'classic') return m.mode === 'classic'
              return m.mode !== 'ranked' && m.mode !== 'classic'
            })
            const visible = filtered.slice(0, showCount)

            if (filtered.length === 0) return (
              <div className="border-[3px] border-ink px-6 py-8 text-center font-mono text-xs text-ink/60">
                No matches yet. <a href="/" className="text-red underline">Play a race</a> to begin.
              </div>
            )

            return (
              <>
                <div className="border-[3px] border-ink divide-y-2 divide-ink">
                  {visible.map(m => (
                    <div key={m.id} className="px-4 py-3 font-mono" style={{ background: m.won ? 'transparent' : '#fafaf8' }}>
                      {/* Row 1: date · mode · target · clicks · rank */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 8, color: '#888' }}>{new Date(m.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <ModeBadge mode={m.mode} />
                        <span className="font-display uppercase text-[11px]">{m.target}</span>
                        <span style={{ fontSize: 9, color: '#555' }}>{m.clicks} cl · {formatSeconds(m.seconds)}</span>
                        {m.totalPlayers > 1 && m.rank > 0 && (
                          <span style={{ fontSize: 8, color: m.rank === 1 ? '#2563eb' : '#888' }}>#{m.rank} of {m.totalPlayers}</span>
                        )}
                        {m.mode === 'ranked' && m.eloChange !== 0 && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: m.eloChange > 0 ? '#16a34a' : '#2563eb' }}>
                            {m.eloChange > 0 ? '+' : ''}{m.eloChange} LP
                          </span>
                        )}
                        {m.mode === 'ranked' && m.eloBefore > 0 && (
                          <span style={{ fontSize: 8, color: '#555' }}>{m.eloBefore} → {m.eloAfter}</span>
                        )}
                      </div>
                      {/* Row 2: path */}
                      <PathChain path={m.path} />
                      {/* Row 3: opponents */}
                      {m.opponents && m.opponents.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.opponents.map(o => (
                            <a key={o.userId} href={`/profile/${o.userId}`}
                              style={{ fontSize: 8, fontFamily: 'ui-monospace,monospace', color: '#555', border: '1px solid #ccc', padding: '1px 6px', textDecoration: 'none' }}
                              className="hover:border-ink hover:text-ink transition-colors">
                              {o.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {filtered.length > showCount && (
                  <button onClick={() => setShowCount(n => n + 20)}
                    className="mt-2 w-full border-[3px] border-ink py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-paper-dim cursor-pointer">
                    Load more ({filtered.length - showCount} remaining)
                  </button>
                )}
              </>
            )
          })()}
        </div>

        <div className="grid grid-cols-2 gap-[3px] border-t-4 border-ink bg-ink">
          <a href="/" className="bg-paper py-3 text-center font-display uppercase text-sm tracking-wide hover:bg-paper-dim">← Home</a>
          <a href="/ranked" className="bg-red py-3 text-center font-display uppercase text-sm tracking-wide text-paper hover:brightness-110">Ranked Duels ⚔</a>
        </div>
      </main>
    </div>
  )
}
