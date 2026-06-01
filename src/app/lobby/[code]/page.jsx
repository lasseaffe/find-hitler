'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import { RedButton } from '@/components/ui/primitives'

export default function LobbyPage({ params }) {
  const { code } = use(params)
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState('')

  const handlers = {
    'connect': () => {
      const socket = socketRef.current
      if (!socket) return
      setMyId(socket.id)
      const playerName = sessionStorage.getItem('playerName')
      const isHost = sessionStorage.getItem('roomCode') === code
      if (!isHost && playerName) {
        socket.emit('room:join', { roomCode: code, playerName })
      }
    },
    'room:state': (snapshot) => setRoom(snapshot),
    'room:error': ({ error }) => setError(error),
    'game:started': (data) => {
      sessionStorage.setItem('multiGameInit', JSON.stringify(data))
      router.push('/play/multi')
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    const socket = socketRef.current
    if (socket?.connected) {
      setMyId(socket.id)
      // If already connected and not host, join now
      const playerName = sessionStorage.getItem('playerName')
      const isHost = sessionStorage.getItem('roomCode') === code
      if (!isHost && playerName) {
        socket.emit('room:join', { roomCode: code, playerName })
      }
    }
  }, [code])

  const handleStart = useCallback(() => {
    socketRef.current?.emit('game:start', { roomCode: code })
  }, [code])

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${code}` : ''

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="border-4 border-red bg-paper px-8 py-6 text-center">
          <div className="font-display text-2xl uppercase text-red">{error}</div>
          <button onClick={() => router.push('/')} className="mt-4 font-mono text-xs uppercase tracking-widest underline hover:text-red cursor-pointer">Back to Home</button>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-[0.2em] text-ink/70">
        Joining lobby…
      </div>
    )
  }

  const isHost = room.host === myId

  return (
    <div className="min-h-screen bg-paper px-4 py-8 flex flex-col items-center">
      <main className="w-full max-w-md border-4 border-ink bg-paper">
        <div className="border-b-4 border-ink px-5 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Multiplayer Lobby</div>
        </div>

        {/* share code */}
        <div className="border-b-4 border-ink px-5 py-5 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/60">Share Code</div>
          <div className="mt-1 font-display text-5xl tracking-[0.15em]">{code}</div>
        </div>

        {/* mode / target */}
        <div className="flex border-b-4 border-ink font-mono text-[10px] uppercase">
          <div className="flex-1 border-r-4 border-ink px-4 py-2.5"><span className="text-ink/60">Target</span> <span className="text-red font-bold">{room.target}</span></div>
          <div className="px-4 py-2.5"><span className="text-ink/60">Mode</span> {room.mode}</div>
        </div>

        {/* players */}
        <div className="border-b-4 border-ink">
          {room.players.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs ${i > 0 ? 'border-t-2 border-ink' : ''}`}>
              <span className="text-ink/40">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 font-display uppercase text-sm">{p.name}</span>
              {p.id === room.host && <span className="bg-red px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-paper">host</span>}
              {p.isBot && <span className="border-2 border-ink px-1.5 py-0.5 text-[8px] uppercase tracking-wide">bot</span>}
            </div>
          ))}
        </div>

        {joinUrl && (
          <div className="border-b-4 border-ink px-5 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink/60">Share link</p>
            <p className="mt-1 break-all font-mono text-xs text-red">{joinUrl}</p>
          </div>
        )}

        {isHost ? (
          <>
            <RedButton onClick={handleStart}>Start Race →</RedButton>
            {room.players.filter(p => !p.isBot).length === 1 && (
              <p className="px-5 py-2 text-center font-mono text-[10px] uppercase tracking-wide text-ink/50">Start with bots, or share the link to invite friends</p>
            )}
          </>
        ) : (
          <div className="py-4 text-center font-mono text-xs uppercase tracking-widest text-ink/60">Waiting for host to start…</div>
        )}
      </main>
    </div>
  )
}
