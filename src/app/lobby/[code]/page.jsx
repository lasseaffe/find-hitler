'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

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
      <div className="min-h-screen bg-[#0d1117] text-red-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">{error}</div>
          <button onClick={() => router.push('/')} className="text-yellow-400 underline">Back to Home</button>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-yellow-400 font-mono flex items-center justify-center text-xl">
        Joining lobby...
      </div>
    )
  }

  const isHost = room.host === myId

  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-black text-yellow-400 mb-1">LOBBY</h1>
        <p className="font-mono text-gray-400 text-sm mb-8">
          Room code: <span className="text-white font-bold tracking-widest">{code}</span>
        </p>

        <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Target</span>
            <span className="text-red-400 font-bold italic">{room.target}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Mode</span>
            <span className="text-yellow-400 font-mono uppercase text-sm">{room.mode}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
            Players ({room.players.length})
          </div>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-[#1a1a2e] rounded-lg px-4 py-2">
                <div className={`w-2 h-2 rounded-full ${p.isBot ? 'bg-orange-400' : 'bg-green-400'}`} />
                <span className="font-mono text-sm flex-1">{p.name}</span>
                {p.id === room.host && <span className="text-[10px] text-yellow-400 font-mono uppercase">host</span>}
                {p.isBot && <span className="text-[10px] text-orange-400 font-mono uppercase">bot</span>}
              </div>
            ))}
          </div>
        </div>

        {joinUrl && (
          <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 mb-6">
            <p className="text-xs font-mono text-gray-400 mb-1">Share link</p>
            <p className="text-yellow-400 font-mono text-sm break-all">{joinUrl}</p>
          </div>
        )}

        {isHost ? (
          <>
            <button
              onClick={handleStart}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
            >
              Start Race →
            </button>
            {room.players.filter(p => !p.isBot).length === 1 && (
              <p className="text-center text-gray-500 font-mono text-xs mt-2">
                You can start with just bots — or share the link to invite friends
              </p>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 font-mono text-sm">
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  )
}
