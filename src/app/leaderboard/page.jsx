'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEntries } from '@/lib/leaderboard'
import Leaderboard from '@/components/Leaderboard'

export default function LeaderboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    setEntries(getEntries())
  }, [])

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-yellow-400 tracking-tight">Leaderboard</h1>
            <p className="text-gray-500 font-mono text-sm mt-1">Your local race history</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-lg uppercase tracking-widest text-xs transition-colors"
          >
            ← Home
          </button>
        </div>

        <Leaderboard entries={entries} />
      </div>
    </div>
  )
}
