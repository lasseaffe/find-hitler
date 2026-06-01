'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TARGETS = [
  { label: 'Adolf Hitler', category: 'Historical' },
  { label: 'Jesus', category: 'Religion' },
  { label: 'Joseph Stalin', category: 'Historical' },
  { label: '9/11 attacks', category: 'Controversial' },
  { label: 'Taylor Swift', category: 'Pop Culture' },
  { label: 'Black hole', category: 'Science' },
  { label: 'Minecraft', category: 'Internet' },
  { label: 'Holocaust', category: 'Controversial' },
]

const MODES = [
  { value: 'classic', label: 'Classic', desc: 'Fewest clicks wins. Random start page.' },
  { value: 'speedrun', label: 'Speedrun', desc: 'Fastest time wins. Curated start page.' },
  { value: 'golf', label: 'Golf', desc: '5-min cap. Lowest click count wins.' },
  { value: 'jesus', label: '5 Clicks to Jesus', desc: '5 rounds, par = 5 clicks. Target is always Jesus.' },
  { value: 'daily', label: 'Daily Challenge', desc: 'Same pages for everyone today. One attempt.' },
  { value: 'nohub', label: 'No-Hub', desc: 'Hub pages bounce you back and cost an undo token.' },
]

export default function HomePage() {
  const router = useRouter()
  const [playType, setPlayType] = useState('solo')
  const [target, setTarget] = useState('Adolf Hitler')
  const [mode, setMode] = useState('classic')
  const [hardcore, setHardcore] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [botCount, setBotCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const targetLocked = mode === 'jesus' || mode === 'daily'

  const handleStart = async () => {
    if (!playerName.trim()) { setError('Enter your name to continue'); return }
    setError('')
    setLoading(true)

    if (playType === 'solo') {
      try {
        const res = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, mode, playerName: playerName.trim(), hardcore }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Server error'); setLoading(false); return }
        sessionStorage.setItem('gameInit', JSON.stringify({ ...data, target: data.target || target, mode, hardcore }))
        router.push('/play')
      } catch {
        setError('Could not reach server — is it running?')
        setLoading(false)
      }
    } else {
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target, botCount, hardcore }))
      router.push('/lobby/new')
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <a
          href="/leaderboard"
          className="text-yellow-400/70 hover:text-yellow-400 font-mono text-xs uppercase tracking-widest transition-colors"
        >
          Leaderboard →
        </a>
      </div>
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black text-yellow-400 tracking-tighter mb-2">FIND HITLER</h1>
        <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">WikiRace · Taboo Edition</p>
      </div>

      <div className="w-full max-w-md space-y-6">

        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {['solo', 'multi'].map(t => (
            <button
              key={t}
              onClick={() => setPlayType(t)}
              className={`flex-1 py-2 text-sm font-bold font-mono uppercase tracking-widest transition-colors ${
                playType === t ? 'bg-yellow-400 text-black' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              {t === 'solo' ? 'Solo' : 'Multiplayer'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Your Name</label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="Enter nickname..."
            className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Target Page</label>
          <div className={`grid grid-cols-2 gap-2 ${targetLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            {TARGETS.map(t => (
              <button
                key={t.label}
                onClick={() => setTarget(t.label)}
                className={`px-3 py-2 rounded-lg text-sm font-bold text-left transition-all border ${
                  target === t.label
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-[#1a1a2e] border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div>{t.label}</div>
                <div className="text-[10px] font-normal opacity-60">{t.category}</div>
              </button>
            ))}
          </div>
          {targetLocked && (
            <p className="text-xs font-mono text-yellow-400 mt-1">
              {mode === 'jesus' ? 'Target fixed: Jesus' : 'Target selected by daily seed'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Game Mode</label>
          <div className="space-y-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`w-full px-4 py-3 rounded-lg text-left transition-all border ${
                  mode === m.value
                    ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400'
                    : 'bg-[#1a1a2e] border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-bold text-sm">{m.label}</div>
                <div className="text-[11px] opacity-60">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setHardcore(h => !h)}
          className={`w-full px-4 py-3 rounded-lg text-left transition-all border ${
            hardcore
              ? 'bg-red-900/40 border-red-500 text-red-400'
              : 'bg-[#1a1a2e] border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          <div className="font-bold text-sm flex items-center gap-2">
            <span>{hardcore ? '☠ HARDCORE ON' : '☠ Hardcore Modifier'}</span>
          </div>
          <div className="text-[11px] opacity-60">0 undos · time caps halved · max pain</div>
        </button>

        {playType === 'multi' && (
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Bot Opponents: {botCount}
            </label>
            <input
              type="range"
              min={0}
              max={3}
              value={botCount}
              onChange={e => setBotCount(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
              <span>0 bots</span><span>3 bots</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-mono text-center">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
        >
          {loading
            ? 'Connecting...'
            : playType === 'solo' ? 'Start Race →' : 'Create Lobby →'}
        </button>
      </div>
    </div>
  )
}
