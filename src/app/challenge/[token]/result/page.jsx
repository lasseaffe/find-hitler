'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ChallengeResult() {
  const { token } = useParams()
  const router = useRouter()
  const [challenge, setChallenge] = useState(null)
  const [myResult, setMyResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const stored = sessionStorage.getItem('challengeResult')
    if (stored) {
      setMyResult(JSON.parse(stored))
      sessionStorage.removeItem('challengeResult')
    }

    fetch(`/api/challenge/${token}`)
      .then(r => r.json())
      .then(d => { setChallenge(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60">Loading...</div>
  }

  const myScore = myResult?.score ?? 0
  const creatorScore = challenge?.creatorScore ?? 0
  const iWon = myScore > creatorScore

  return (
    <div className="min-h-screen bg-paper px-6 py-12 font-mono max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{iWon ? '🏆 You won!' : '😤 They beat you'}</h1>
      <p className="text-ink/60 mb-8 text-sm">Target: {challenge?.target} · Mode: {challenge?.mode}</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className={`border-4 rounded p-4 ${iWon ? 'border-[#2563eb] bg-[#2563eb]/10' : 'border-ink bg-paper'}`}>
          <p className="text-[10px] uppercase tracking-wider mb-2 text-ink/60">You</p>
          <p className="text-3xl font-bold">{myScore}</p>
          <p className="text-[11px] mt-1 text-ink/60">{myResult?.clicks} clicks · {myResult?.seconds}s</p>
        </div>
        <div className={`border-4 rounded p-4 ${!iWon ? 'border-[#2563eb] bg-[#2563eb]/10' : 'border-ink bg-paper'}`}>
          <p className="text-[10px] uppercase tracking-wider mb-2 text-ink/60">Challenger</p>
          <p className="text-3xl font-bold">{creatorScore}</p>
          <p className="text-[11px] mt-1 text-ink/60">{challenge?.creatorClicks} clicks · {challenge?.creatorSeconds}s</p>
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="border-4 border-ink px-6 py-3 font-bold uppercase tracking-wide hover:bg-ink hover:text-paper"
      >
        Play Again
      </button>
    </div>
  )
}
