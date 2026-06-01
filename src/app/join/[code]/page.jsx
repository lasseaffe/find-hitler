'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage({ params }) {
  const { code } = use(params)
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')

  const handleJoin = () => {
    if (!playerName.trim()) return
    sessionStorage.setItem('playerName', playerName.trim())
    router.push(`/lobby/${code}`)
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-black text-yellow-400 mb-8">
        Join Room <span className="text-white">{code}</span>
      </h1>
      <div className="w-full max-w-xs space-y-4">
        <input
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="Your nickname..."
          className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
        />
        <button
          onClick={handleJoin}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest"
        >
          Join →
        </button>
      </div>
    </div>
  )
}
