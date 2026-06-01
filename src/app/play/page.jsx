'use client'
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import WinReveal from '@/components/win/WinReveal'
import { RedButton } from '@/components/ui/primitives'
import { addEntry } from '@/lib/leaderboard'
import { markDailyPlayed } from '@/lib/dailyChallenge'

function PlayGame() {
  const router = useRouter()
  const playerNameRef = useRef('You')

  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [win, setWin] = useState(null)
  const [bounceMessage, setBounceMessage] = useState(null)
  const [jesusRound, setJesusRound] = useState(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('gameInit')
    if (!raw) { router.push('/'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('gameInit')
    playerNameRef.current = init.playerName || 'You'
    setGameState({
      gameId: init.gameId,
      playerId: init.playerId,
      target: init.target,
      mode: init.mode,
      hardcore: init.hardcore || false,
      startPage: init.title,
      timeLimitSeconds: init.timeLimitSeconds || null,
    })
    setHtml(init.html)
    setClicks(init.clicks)
    setUndoTokens(init.undoTokens)
    if (init.jesusRound) setJesusRound(init.jesusRound)
  }, [router])

  const handleTimeUp = useCallback(() => {
    if (!win) setWin({ timeUp: true, clicks, score: clicks, time: null })
  }, [win, clicks])

  const handleNavigate = useCallback(async (target) => {
    if (isLoading || win || !gameState) return
    setIsLoading(true)
    setBounceMessage(null)
    try {
      const res = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: gameState.playerId, target }),
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); setIsLoading(false); return }

      if (data.status === 'HUB_BOUNCE') {
        setUndoTokens(data.undoTokens)
        setBounceMessage(`"${data.hubPage}" is a hub page — bounced back.`)
        setTimeout(() => setBounceMessage(null), 3000)
        setIsLoading(false)
        return
      }

      if (data.status === 'TIME_UP') {
        setWin({ timeUp: true, clicks: data.clicks, score: data.clicks, time: null })
        setIsLoading(false)
        return
      }

      setClicks(data.clicks)
      if (data.status === 'WIN') {
        if (gameState.mode === 'daily') markDailyPlayed()
        const playerName = playerNameRef.current
        const finisher = {
          name: playerName, path: data.path || [], clicks: data.clicks,
          time: data.time, score: data.score, isMe: true, isBot: false,
        }
        sessionStorage.setItem('gameResults', JSON.stringify({
          target: gameState.target, mode: gameState.mode, finishers: [finisher],
        }))
        addEntry({
          mode: gameState.mode, target: gameState.target,
          clicks: data.clicks, time: data.time, score: data.score, playerName,
        })
        setWin({ score: data.score, clicks: data.clicks, time: data.time, parGrade: data.parGrade || null, parDelta: data.parDelta ?? null })
      } else {
        setHtml(data.html)
        setUndoTokens(data.undoTokens)
      }
    } catch (err) {
      console.error('Move failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, win])

  const handleUndo = useCallback(async () => {
    if (isLoading || win || !gameState) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/game/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: gameState.playerId }),
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); setIsLoading(false); return }
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
    } catch (err) {
      console.error('Undo failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, win])

  if (!gameState) {
    return <div className="flex min-h-screen items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>
  }

  // WIN -> dramatic FOUND HIM reveal, then results
  if (win && !win.timeUp) {
    return <WinReveal onDone={() => router.push('/results')} />
  }

  // TIME UP -> brutalist loss screen
  if (win && win.timeUp) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-paper">
        <div className="border-4 border-red px-8 py-6 text-center">
          <h1 className="text-[clamp(2.5rem,12vw,5rem)] text-red">TIME UP</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-paper/70">
            He got away · {win.clicks} clicks
          </p>
        </div>
        <div className="mt-8 w-full max-w-xs space-y-3">
          <RedButton onClick={() => router.push('/')}>Try Again →</RedButton>
          <button onClick={() => router.push('/leaderboard')} className="block w-full border-[3px] border-paper py-3 text-center font-display uppercase tracking-wide text-paper hover:bg-paper hover:text-ink">
            Leaderboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      {isLoading && <div className="fixed inset-x-0 top-0 z-50 h-1 bg-red" />}

      {bounceMessage && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 border-[3px] border-red bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-wide text-paper">
          ⛔ {bounceMessage}
        </div>
      )}

      <GameHUD
        startPage={gameState.startPage}
        target={gameState.target}
        mode={gameState.mode}
        clicks={clicks}
        undoTokens={undoTokens}
        onUndo={handleUndo}
        timeLimitSeconds={gameState.timeLimitSeconds}
        jesusRound={jesusRound}
        onTimeUp={handleTimeUp}
      />

      <main className="mx-auto max-w-3xl px-5 pt-24 pb-24 sm:pt-20">
        <WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!win} />
      </main>
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>}>
      <PlayGame />
    </Suspense>
  )
}
