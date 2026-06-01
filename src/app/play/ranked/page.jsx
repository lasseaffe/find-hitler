'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import WikiArticle from '@/components/WikiArticle'
import HpDuelHUD from '@/components/HpDuelHUD'
import EloChange from '@/components/EloChange'
import DamageOverlay from '@/components/DamageOverlay'
import { useSocket } from '@/hooks/useSocket'

function RankedGame() {
  const router = useRouter()
  const { data: session } = useSession()
  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [duelPlayers, setDuelPlayers] = useState({})
  const [round, setRound] = useState(1)
  const [duelFinished, setDuelFinished] = useState(null)
  const [eloChange, setEloChange] = useState(null)
  const [damageEvent, setDamageEvent] = useState(null)
  const [myHp, setMyHp] = useState(5000)
  const myIdRef = useRef(null)

  const handlers = {
    'connect': () => { if (socketRef.current) myIdRef.current = socketRef.current.id },
    'game:page': (data) => {
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
      setIsLoading(false)
    },
    'duel:round-end': (data) => {
      setDuelPlayers(Object.fromEntries(
        Object.entries(data.duelPlayers).map(([id, p]) => [id, { name: p.name, hp: p.hp }])
      ))
      if (data.loserId === myIdRef.current) {
        const myPlayerData = data.duelPlayers[myIdRef.current]
        if (myPlayerData) setMyHp(myPlayerData.hp)
        setDamageEvent({ damage: data.damage, timestamp: Date.now() })
      }
      setRound(r => r + 1)
      setHtml(data.nextHtml)
      setClicks(0)
      setIsLoading(false)
    },
    'duel:finished': async (data) => {
      const isWinner = data.winnerId === myIdRef.current
      setDuelPlayers(Object.fromEntries(
        Object.entries(data.players).map(([id, p]) => [id, { name: p.name, hp: p.hp }])
      ))
      setDuelFinished({ isWinner, winnerId: data.winnerId })

      if (session?.user?.id && gameState) {
        const opponentEntry = Object.entries(data.players).find(([id]) => id !== myIdRef.current)
        const opponentElo = opponentEntry?.[1]?.elo || 1000
        try {
          const res = await fetch('/api/match/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: session.user.id,
              target: gameState.target,
              mode: 'ranked',
              clicks,
              seconds: 0,
              score: 0,
              path: [],
              won: isWinner,
              opponentElo,
            }),
          })
          const result = await res.json()
          if (result.eloChange) setEloChange(result.eloChange)
        } catch { /* silent */ }
      }
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    const raw = sessionStorage.getItem('rankedGameInit')
    if (!raw) { router.push('/ranked'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('rankedGameInit')
    if (socketRef.current?.id) myIdRef.current = socketRef.current.id
    setGameState({ duelId: init.duelId, gameId: init.gameId, target: init.target, roomCode: init.roomCode, startPage: init.title, opponent: init.opponent })
    setHtml(init.html)
  }, [router])

  const handleNavigate = useCallback((target) => {
    if (isLoading || duelFinished || !gameState) return
    setIsLoading(true)
    socketRef.current?.emit('duel:navigate', { duelId: gameState.duelId, target })
  }, [gameState, isLoading, duelFinished])

  if (!gameState) {
    return <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* HpDuelHUD is the top bar for ranked (no GameHUD to avoid a double top bar) */}
      <HpDuelHUD duelPlayers={duelPlayers} myId={myIdRef.current} round={round} />

      {isLoading && <div className="fixed inset-x-0 top-0 z-50 h-1 bg-red" />}

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-28">
        <WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!duelFinished} />
      </main>

      {/* minimal clicks chip (undo not available in duels) */}
      <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between border-t-4 border-ink bg-paper px-4 py-3 pb-safe font-mono text-[10px] uppercase tracking-widest text-ink/60">
        <span>Round {round}</span>
        <span>{clicks} clicks · reach {gameState.target}</span>
      </div>

      {eloChange !== null && session?.user && (
        <EloChange delta={eloChange} oldElo={(session.user.elo || 1000) - eloChange} newElo={session.user.elo || 1000} />
      )}

      <DamageOverlay trigger={damageEvent} hp={myHp} maxHp={5000} />

      {duelFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 px-4">
          <div className="w-full max-w-sm border-4 border-ink bg-paper px-8 py-8 text-center">
            <h2 className={`text-[clamp(2.5rem,12vw,4rem)] ${duelFinished.isWinner ? 'text-red' : 'text-ink/50'}`}>
              {duelFinished.isWinner ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Duel complete · ELO updated</p>
            <div className="mt-6 grid grid-cols-2 gap-[3px] bg-ink">
              <button onClick={() => router.push('/ranked')} className="bg-red py-3 font-display uppercase text-sm tracking-wide text-paper hover:brightness-110 cursor-pointer">Play Again</button>
              <button onClick={() => router.push('/profile')} className="bg-paper py-3 font-display uppercase text-sm tracking-wide hover:bg-paper-dim cursor-pointer">Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RankedPlayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>}>
      <RankedGame />
    </Suspense>
  )
}
