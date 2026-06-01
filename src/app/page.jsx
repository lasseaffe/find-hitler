'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasPlayedDailyToday } from '@/lib/dailyChallenge'
import { Frame, Rule, MonoLabel, SelectCell, ToggleRow, RedButton } from '@/components/ui/primitives'
import HitlerMark from '@/components/ui/HitlerMark'
import CrowdIntro from '@/components/intro/CrowdIntro'
import { primeAudio } from '@/lib/sfx'

const TARGETS = [
  { label: 'Adolf Hitler', category: 'Historical', featured: true },
  { label: 'Jesus', category: 'Religion' },
  { label: 'Joseph Stalin', category: 'Historical' },
  { label: 'Taylor Swift', category: 'Pop Culture' },
  { label: 'Minecraft', category: 'Internet' },
  { label: 'Black hole', category: 'Science' },
  { label: '9/11 attacks', category: 'Controversial' },
  { label: 'Holocaust', category: 'Controversial' },
]

const MODES = [
  { value: 'classic',  label: 'Classic',          desc: 'FEWEST CLICKS · RANDOM START', shortDesc: 'RANDOM START' },
  { value: 'speedrun', label: 'Speedrun',          desc: 'FASTEST TIME · CURATED START', shortDesc: 'FASTEST TIME' },
  { value: 'golf',     label: 'Golf',              desc: '5-MIN CAP · LOWEST CLICKS',    shortDesc: '5-MIN CAP' },
  { value: 'jesus',    label: '5-Clicks',          desc: 'PAR · 5 ROUNDS · TARGET = JESUS', shortDesc: 'TO JESUS' },
  { value: 'daily',    label: 'Daily',             desc: 'ONE ATTEMPT · SAME FOR ALL',   shortDesc: 'ONE SHOT' },
  { value: 'nohub',    label: 'No-Hub',            desc: 'HUBS BOUNCE YOU · COST AN UNDO', shortDesc: 'HUB PENALTY' },
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
  const [showIntro, setShowIntro] = useState(false)
  const startReq = useRef(null)

  const targetLocked = mode === 'jesus' || mode === 'daily'
  const alreadyPlayedDaily = mode === 'daily' && hasPlayedDailyToday()

  const handleStart = () => {
    if (!playerName.trim()) { setError('Enter a codename to continue'); return }
    setError('')

    if (playType === 'solo') {
      primeAudio() // unlock audio inside the click gesture
      setLoading(true)
      // kick off the page fetch concurrently; the intro covers the latency
      startReq.current = (async () => {
        const res = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, mode, playerName: playerName.trim(), hardcore }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
        return { ...data, target: data.target || target, mode, hardcore, playerName: playerName.trim() }
      })()
      setShowIntro(true)
    } else {
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target, botCount, hardcore }))
      router.push('/lobby/new')
    }
  }

  const handleIntroDone = async () => {
    try {
      const data = await startReq.current
      sessionStorage.setItem('gameInit', JSON.stringify(data))
      router.push('/play')
    } catch (e) {
      setShowIntro(false)
      setLoading(false)
      setError(e?.message === 'Failed to fetch' ? 'Could not reach server — is it running?' : (e?.message || 'Server error'))
    }
  }

  if (showIntro) return <CrowdIntro onDone={handleIntroDone} />

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:py-12">
      <main className="mx-auto max-w-2xl">
        <Frame>
          {/* MASTHEAD */}
          <div className="flex items-center gap-4 px-5 py-5 border-b-4 border-ink">
            <HitlerMark size={56} className="flex-none" />
            <div className="flex-1">
              <h1 className="text-[clamp(2rem,9vw,2.75rem)] leading-[0.82]">Find Hitler</h1>
              <MonoLabel className="mt-1.5 block">Wikirace · Taboo Edition</MonoLabel>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2">
              <a href="/ranked" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">⚔ Ranked</a>
              <a href="/leaderboard" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">Leaderboard →</a>
            </div>
          </div>

          {/* SOLO / MULTIPLAYER */}
          <div className="grid grid-cols-2 border-b-4 border-ink">
            {[['solo', 'Solo'], ['multi', 'Multiplayer']].map(([val, lbl], i) => (
              <button
                key={val}
                onClick={() => setPlayType(val)}
                className={`min-h-[48px] py-3.5 text-center font-display uppercase tracking-[0.06em] text-base cursor-pointer ${i === 1 ? 'border-l-4 border-ink' : ''} ${playType === val ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-dim'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* CODENAME */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-2">Codename</MonoLabel>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="enter codename"
              className="w-full border-[3px] border-ink bg-paper px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
            />
          </div>

          {/* TARGET */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-2.5">Target</MonoLabel>
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-[3px] bg-ink border-[3px] border-ink ${targetLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              {TARGETS.map(t => {
                const sel = target === t.label
                return (
                  <SelectCell key={t.label} selected={sel} onClick={() => setTarget(t.label)} className="flex flex-col justify-center">
                    {t.featured && <HitlerMark size={26} fill={sel ? 'var(--color-paper)' : 'var(--color-ink)'} className="mb-1" />}
                    <span className="font-display uppercase text-[13px] leading-none">{t.label}</span>
                    <MonoLabel className={`mt-1 block ${sel ? 'text-paper/70' : ''}`}>{t.category}</MonoLabel>
                  </SelectCell>
                )
              })}
              {/* filler so the 3-col grid's empty slot isn't an ink block (hidden at 2-col) */}
              <div className="hidden sm:block bg-paper" aria-hidden />
            </div>
            {targetLocked && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-red">
                {mode === 'jesus' ? 'Target fixed: Jesus' : 'Target set by daily seed'}
              </p>
            )}
          </div>

          {/* GAME MODE */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-2.5">Game Mode</MonoLabel>

            {/* Hero: Classic */}
            <SelectCell
              selected={mode === 'classic'}
              onClick={() => setMode('classic')}
              className="w-full flex items-center gap-4 px-4 py-5 mb-[3px] border-[3px] border-ink"
            >
              <HitlerMark size={52} fill={mode === 'classic' ? 'var(--color-paper)' : 'var(--color-ink)'} className="flex-none" />
              <div className="flex-1 text-left">
                <div className="font-display uppercase text-[22px] leading-none">Classic · Find Hitler</div>
                <div className={`mt-1.5 font-mono text-[11px] ${mode === 'classic' ? 'text-paper/70' : 'text-ink/60'}`}>
                  Navigate Wikipedia from a random page to Adolf Hitler. Fewest clicks wins.
                </div>
              </div>
              {mode === 'classic' && (
                <span className="flex-none font-mono text-[8px] uppercase tracking-[0.12em] bg-paper text-red border border-red px-2 py-1">★ Main mode</span>
              )}
            </SelectCell>

            {/* Variants row */}
            <MonoLabel className="block mt-3 mb-1.5">Variants</MonoLabel>
            <div className="grid grid-cols-5 gap-[3px] bg-ink border-[3px] border-ink">
              {MODES.filter(m => m.value !== 'classic').map(m => {
                const sel = mode === m.value
                return (
                  <SelectCell key={m.value} selected={sel} onClick={() => setMode(m.value)} className="flex flex-col items-center justify-center text-center py-3 px-1">
                    <span className="font-display uppercase text-[9px] leading-tight">{m.label}</span>
                    <MonoLabel className={`mt-1 block text-[7px] ${sel ? 'text-paper/70' : ''}`}>{m.shortDesc}</MonoLabel>
                  </SelectCell>
                )
              })}
            </div>
          </div>

          {/* HARDCORE */}
          <div className="border-b-4 border-ink">
            <ToggleRow
              label="Hardcore Modifier"
              sublabel="0 undos · time caps halved · max pain"
              checked={hardcore}
              onChange={setHardcore}
            />
          </div>

          {/* BOTS (multi only) */}
          {playType === 'multi' && (
            <div className="px-5 py-4 border-b-4 border-ink">
              <MonoLabel className="block mb-2">Bot Opponents: {botCount}</MonoLabel>
              <input
                type="range" min={0} max={3} value={botCount}
                onChange={e => setBotCount(Number(e.target.value))}
                className="w-full accent-red"
              />
              <div className="mt-1 flex justify-between font-mono text-[9px] text-ink/50"><span>0 BOTS</span><span>3 BOTS</span></div>
            </div>
          )}

          {error && <p className="px-5 py-3 font-mono text-xs text-red border-b-4 border-ink">{error}</p>}

          <RedButton onClick={handleStart} disabled={loading || alreadyPlayedDaily}>
            {loading ? 'Connecting…' : alreadyPlayedDaily ? 'Already played today ✓' : playType === 'solo' ? 'Start Race →' : 'Create Lobby →'}
          </RedButton>
        </Frame>

        {/* mobile nav (masthead links are desktop-only) */}
        <div className="sm:hidden mt-3 grid grid-cols-2 gap-3">
          <a href="/ranked" className="border-[3px] border-ink py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.18em]">⚔ Ranked</a>
          <a href="/leaderboard" className="border-[3px] border-ink py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.18em]">Leaderboard →</a>
        </div>
      </main>
    </div>
  )
}
