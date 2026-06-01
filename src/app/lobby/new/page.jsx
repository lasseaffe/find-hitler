'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function LobbyNewPage() {
  const router = useRouter()
  const socketRef = useSocket({
    'room:created': ({ code }) => {
      sessionStorage.setItem('roomCode', code)
      router.replace(`/lobby/${code}`)
    },
    'room:error': ({ error }) => {
      alert(error)
      router.replace('/')
    },
  })

  useEffect(() => {
    const raw = sessionStorage.getItem('lobbyConfig')
    if (!raw) { router.replace('/'); return }
    const config = JSON.parse(raw)
    sessionStorage.removeItem('lobbyConfig')
    sessionStorage.setItem('playerName', config.playerName)
    // Socket may not be connected yet — wait for connect then emit
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('room:create', config)
    } else {
      socket?.once('connect', () => socket.emit('room:create', config))
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0d1117] text-yellow-400 font-mono flex items-center justify-center text-xl">
      Creating lobby...
    </div>
  )
}
