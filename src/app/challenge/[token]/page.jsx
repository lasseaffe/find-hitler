'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ChallengeLanding() {
  const { token } = useParams()
  const router = useRouter()
  const [challenge, setChallenge] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    fetch(`/api/challenge/${token}`)
      .then(r => r.json())
      .then(d => { setChallenge(d); setLoading(false) })
      .catch(() => { router.push('/') })
  }, [token, router])

  function handleAccept() {
    if (!name.trim() || !challenge) return
    sessionStorage.setItem('challengeContext', JSON.stringify({
      challengeId: challenge.id,
      startPage: challenge.startPage,
      target: challenge.target,
      mode: challenge.mode,
      responderName: name.trim(),
      token,
    }))
    router.push('/play?challenge=1')
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60">Loading challenge...</div>
  }
  if (challenge?.error) {
    return <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-red-500">{challenge.error}</div>
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-6 font-mono px-6">
      <h1 className="text-2xl font-bold text-ink">You&apos;ve been challenged!</h1>
      <div className="border-4 border-ink rounded p-6 max-w-md w-full bg-paper">
        <p className="text-[10px] text-ink/60 mb-1 uppercase tracking-wider">Target</p>
        <p className="text-lg font-bold mb-4">{challenge.target}</p>
        <p className="text-[10px] text-ink/60 mb-1 uppercase tracking-wider">Mode</p>
        <p className="text-base mb-4 capitalize">{challenge.mode}</p>
        <p className="text-[10px] text-ink/60 mb-1 uppercase tracking-wider">Score to beat</p>
        <p className="text-2xl font-bold text-[#2563eb]">{challenge.creatorScore}</p>
      </div>
      <div className="max-w-md w-full">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAccept()}
          placeholder="Enter your codename"
          className="w-full border-4 border-ink p-3 font-mono text-sm bg-paper mb-3"
        />
        <button
          onClick={handleAccept}
          disabled={!name.trim()}
          className="w-full bg-ink text-paper py-3 font-bold uppercase tracking-wide disabled:opacity-40 hover:bg-ink/80"
        >
          Accept Challenge →
        </button>
      </div>
    </div>
  )
}
