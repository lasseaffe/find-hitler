'use client'
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import WinScreen from '@/components/WinScreen'
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
        setBounceMessage(`⛔ "${data.hubPage}" is a hub page! Bounced back.`)
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
        if (gameState.mode === 'daily') {
          markDailyPlayed()
        }
        const playerName = playerNameRef.current
        const finisher = {
          name: playerName,
          path: data.path || [],
          clicks: data.clicks,
          time: data.time,
          score: data.score,
          isMe: true,
          isBot: false,
        }
        sessionStorage.setItem('gameResults', JSON.stringify({
          target: gameState.target,
          mode: gameState.mode,
          finishers: [finisher],
        }))
        addEntry({
          mode: gameState.mode,
          target: gameState.target,
          clicks: data.clicks,
          time: data.time,
          score: data.score,
          playerName,
        })
        setWin({
          score: data.score,
          clicks: data.clicks,
          time: data.time,
          parGrade: data.parGrade || null,
          parDelta: data.parDelta ?? null,
        })
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
    return <div className="flex items-center justify-center min-h-screen font-mono text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-[999] bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-[length:200%_auto] animate-shimmer" />
      )}

      {bounceMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[998] bg-red-700 text-white font-mono text-sm px-6 py-3 rounded-full shadow-lg animate-bounce">
          {bounceMessage}
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

      <div className="max-w-3xl mx-auto pt-20 px-6">
        <WikiArticle
          html={html}
          onNavigate={handleNavigate}
          disabled={isLoading || !!win}
        />
      </div>

      {win && (
        <WinScreen
          score={win.score}
          clicks={win.clicks}
          time={win.time}
          target={gameState.target}
          mode={gameState.mode}
          parGrade={win.parGrade}
          parDelta={win.parDelta}
          timeUp={win.timeUp}
          onPlayAgain={() => router.push('/')}
          onViewResults={() => router.push('/results')}
        />
      )}
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PlayGame />
    </Suspense>
  )
}
