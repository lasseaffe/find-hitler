'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import RankBadge from '@/components/RankBadge'

export default function RankedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [queueState, setQueueState] = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [waitSeconds, setWaitSeconds] = useState(0)
  const timerRef = useRef(null)

  const handlers = {
    'ranked:queued': ({ message }) => {
      setQueueState('queued')
      setStatusMsg(message)
      setWaitSeconds(0)
      timerRef.current = setInterval(() => setWaitSeconds(s => s + 1), 1000)
    },
    'ranked:left': () => {
      setQueueState('idle')
      clearInterval(timerRef.current)
    },
    'ranked:matched': (data) => {
      setQueueState('matched')
      clearInterval(timerRef.current)
      sessionStorage.setItem('rankedGameInit', JSON.stringify(data))
      router.push('/play/ranked')
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const handleJoinQueue = () => {
    if (!socketRef.current || !session?.user) return
    socketRef.current.emit('ranked:join', {
      userId: session.user.id,
      elo: session.user.elo || 1000,
      name: session.user.name || session.user.email,
    })
  }

  const handleLeaveQueue = () => {
    socketRef.current?.emit('ranked:leave')
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">Loading...</div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-4xl font-black text-yellow-400">Ranked Duels</h1>
        <p className="text-gray-400 font-mono text-sm text-center max-w-xs">
          Sign in to compete on the ranked ladder. Guest play remains available on the home screen.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl uppercase tracking-widest text-sm"
        >
          Sign In to Play Ranked →
        </button>
        <a href="/" className="text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
          ← Back to Guest Play
        </a>
      </div>
    )
  }

  const user = session.user

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-black text-yellow-400 tracking-tight">Ranked Duels</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">1v1 · HP Duel format · ELO ladder</p>
      </div>

      <div className="bg-[#1a1a2e] border border-yellow-400/20 rounded-2xl px-8 py-6 text-center space-y-3 min-w-[280px]">
        <div className="font-black text-lg text-white">{user.name || user.email}</div>
        <RankBadge rank={user.rank || 'BRONZE'} elo={user.elo || 1000} size="lg" />
        <a href="/profile" className="block text-xs font-mono text-gray-500 hover:text-gray-300 uppercase tracking-widest">
          View Match History →
        </a>
      </div>

      {queueState === 'idle' && (
        <button
          onClick={handleJoinQueue}
          className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl uppercase tracking-widest shadow-[0_0_30px_rgba(192,57,43,0.4)] transition-colors"
        >
          Find Match →
        </button>
      )}

      {queueState === 'queued' && (
        <div className="text-center space-y-4">
          <div className="flex items-center gap-3 justify-center">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            <span className="font-mono text-yellow-400 text-sm uppercase tracking-widest">
              {statusMsg} · {waitSeconds}s
            </span>
          </div>
          <button
            onClick={handleLeaveQueue}
            className="px-6 py-2 border border-red-500/50 hover:border-red-500 text-red-400 font-mono text-sm rounded-lg uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {queueState === 'matched' && (
        <div className="font-mono text-green-400 text-sm uppercase tracking-widest animate-pulse">
          Opponent found! Starting duel...
        </div>
      )}

      <a href="/" className="text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
        ← Home
      </a>
    </div>
  )
}
