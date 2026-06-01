'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RankBadge from '@/components/RankBadge'

function formatSeconds(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, router])

  if (loading || status === 'loading') {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">Loading...</div>
  }

  if (!data?.user) {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">No profile data.</div>
  }

  const { user, matches, stats } = data

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">{user.name || user.email}</h1>
            <p className="text-gray-500 font-mono text-sm mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 border border-red-500/40 hover:border-red-500 text-red-400 font-mono text-xs uppercase tracking-widest rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'ELO', value: <RankBadge rank={user.rank} elo={user.elo} size="md" /> },
            { label: 'Matches', value: stats.totalMatches },
            { label: 'Win Rate', value: `${stats.winRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 text-center">
              <div className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-2">{label}</div>
              <div className="text-white font-black text-xl">{value}</div>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest font-mono">Match History</h2>
          {matches.length === 0 ? (
            <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-8 text-center text-gray-500 font-mono text-sm">
              No matches yet. <a href="/" className="text-yellow-400 hover:underline">Play a race</a> to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-sm border ${m.won ? 'bg-green-900/10 border-green-500/20' : 'bg-[#1a1a2e] border-gray-700'}`}>
                  <span className="text-base">{m.won ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white">{m.target}</span>
                    <span className="text-gray-500 ml-2 text-xs uppercase">{m.mode}</span>
                  </div>
                  <span className="text-gray-300 shrink-0">{m.clicks} clicks</span>
                  <span className="text-gray-500 shrink-0">{formatSeconds(m.seconds)}</span>
                  {m.eloChange !== 0 && (
                    <span className={`font-black shrink-0 ${m.eloChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {m.eloChange > 0 ? '+' : ''}{m.eloChange}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <a href="/" className="px-6 py-2 border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">
            ← Home
          </a>
          <a href="/ranked" className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors">
            Ranked Duels ⚔
          </a>
        </div>
      </div>
    </div>
  )
}
