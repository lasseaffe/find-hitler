'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import RankBadge from '@/components/RankBadge'
import HitlerMark from '@/components/ui/HitlerMark'
import { RedButton } from '@/components/ui/primitives'

export default function RankedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [queueState, setQueueState] = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [waitSeconds, setWaitSeconds] = useState(0)
  const timerRef = useRef(null)

  const handlers = {
    'ranked:queued': ({ message }) => {
      setQueueState('queued'); setStatusMsg(message); setWaitSeconds(0)
      timerRef.current = setInterval(() => setWaitSeconds(s => s + 1), 1000)
    },
    'ranked:left': () => { setQueueState('idle'); clearInterval(timerRef.current) },
    'ranked:matched': (data) => {
      setQueueState('matched'); clearInterval(timerRef.current)
      sessionStorage.setItem('rankedGameInit', JSON.stringify(data))
      router.push('/play/ranked')
    },
  }
  const socketRef = useSocket(handlers)
  useEffect(() => () => clearInterval(timerRef.current), [])

  const handleJoinQueue = () => {
    if (!socketRef.current || !session?.user) return
    socketRef.current.emit('ranked:join', {
      userId: session.user.id, elo: session.user.elo || 1000,
      name: session.user.name || session.user.email,
    })
  }
  const handleLeaveQueue = () => socketRef.current?.emit('ranked:leave')

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
        <HitlerMark size={64} />
        <h1 className="text-4xl">Ranked Duels</h1>
        <p className="max-w-xs text-center font-mono text-xs uppercase tracking-wider text-ink/60">
          Sign in to compete on the ranked ladder. Guest play stays free on the home screen.
        </p>
        <div className="w-full max-w-xs"><RedButton onClick={() => router.push('/login')}>Sign In to Play Ranked →</RedButton></div>
        <a href="/" className="font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-red">← Back to guest play</a>
      </div>
    )
  }

  const user = session.user
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper px-4">
      <div className="text-center">
        <h1 className="text-4xl">Ranked Duels</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">1v1 · HP Duel · ELO ladder</p>
      </div>

      <div className="min-w-[280px] border-4 border-ink bg-paper px-8 py-6 text-center">
        <div className="font-display text-lg uppercase">{user.name || user.email}</div>
        <div className="my-3"><RankBadge rank={user.rank || 'BRONZE'} elo={user.elo || 1000} size="lg" /></div>
        <a href="/profile" className="font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-red">View Match History →</a>
      </div>

      {queueState === 'idle' && <div className="w-full max-w-xs"><RedButton onClick={handleJoinQueue}>Find Match →</RedButton></div>}

      {queueState === 'queued' && (
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="h-3 w-3 animate-pulse bg-red" />
            <span className="font-mono text-sm uppercase tracking-widest">{statusMsg} · {waitSeconds}s</span>
          </div>
          <button onClick={handleLeaveQueue} className="border-[3px] border-ink px-6 py-2 font-mono text-xs uppercase tracking-widest hover:bg-paper-dim cursor-pointer">✕ Cancel</button>
        </div>
      )}

      {queueState === 'matched' && (
        <div className="animate-pulse font-mono text-sm uppercase tracking-widest text-red">Opponent found — starting duel…</div>
      )}

      <a href="/" className="font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-red">← Home</a>
    </div>
  )
}
