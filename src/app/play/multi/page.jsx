'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import LiveFeed from '@/components/LiveFeed'
import MultiWinScreen from '@/components/MultiWinScreen'
import { useSocket } from '@/hooks/useSocket'
import { addEntry } from '@/lib/leaderboard'

function MultiGame() {
  const router = useRouter()
  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [myFinish, setMyFinish] = useState(null)
  const [finishers, setFinishers] = useState([])
  const [players, setPlayers] = useState([])
  const myIdRef = useRef(null)

  const handlers = {
    'connect': () => {
      if (socketRef.current) myIdRef.current = socketRef.current.id
    },
    'game:page': (data) => {
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
      setIsLoading(false)
    },
    'game:state-update': (data) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.playerId
          ? { ...p, clicks: data.clicks, currentPage: data.currentPage }
          : p
      ))
    },
    'game:player-finished': (data) => {
      setFinishers(prev => [...prev, data])
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, finished: true } : p))
    },
    'game:you-finished': (data) => {
      setMyFinish(data)
      setIsLoading(false)
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    const raw = sessionStorage.getItem('multiGameInit')
    if (!raw) { router.push('/'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('multiGameInit')
    if (socketRef.current?.id) myIdRef.current = socketRef.current.id
    setGameState({
      gameId: init.gameId,
      target: init.target,
      mode: init.mode,
      roomCode: init.snapshot?.code,
      startPage: init.title,
    })
    setHtml(init.html)
    setPlayers(init.snapshot?.players || [])
  }, [router])

  const handleNavigate = useCallback((target) => {
    if (isLoading || myFinish || !gameState) return
    setIsLoading(true)
    socketRef.current?.emit('game:navigate', { roomCode: gameState.roomCode, target })
    // Page content arrives via 'game:page' event — isLoading cleared there
  }, [gameState, isLoading, myFinish])

  const handleUndo = useCallback(async () => {
    if (isLoading || myFinish || !gameState) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/game/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: myIdRef.current }),
      })
      const data = await res.json()
      if (!res.ok) { setIsLoading(false); return }
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
    } catch { /* ignore */ } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, myFinish])

  const handleViewResults = useCallback(() => {
    const mapped = finishers.map((f) => ({
      name: f.name,
      path: f.path || [],
      clicks: f.clicks,
      time: f.seconds ?? null,
      score: f.score ?? null,
      isMe: f.playerId === myIdRef.current,
      isBot: f.isBot || false,
    }))

    // If no finisher is flagged as 'me' (e.g. you-finished fired before player-finished),
    // synthesize a fallback from myFinish
    if (!mapped.some(f => f.isMe) && myFinish) {
      mapped.unshift({
        name: myFinish.name || 'You',
        path: myFinish.path || [],
        clicks: myFinish.clicks,
        time: myFinish.seconds ?? null,
        score: myFinish.score ?? null,
        isMe: true,
        isBot: false,
      })
    }

    mapped.filter(f => f.isMe).forEach(f => {
      addEntry({
        mode: gameState.mode,
        target: gameState.target,
        clicks: f.clicks,
        time: f.time,
        score: f.score || 0,
        playerName: f.name,
      })
    })

    sessionStorage.setItem('gameResults', JSON.stringify({
      target: gameState.target,
      mode: gameState.mode,
      finishers: mapped,
    }))

    router.push('/results')
  }, [finishers, gameState, router])

  if (!gameState) {
    return <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <div className="min-w-0 flex-1">
        {isLoading && <div className="fixed inset-x-0 top-0 z-50 h-1 bg-red" />}

        <GameHUD
          startPage={gameState.startPage}
          target={gameState.target}
          mode={gameState.mode}
          clicks={clicks}
          undoTokens={undoTokens}
          onUndo={handleUndo}
        />

        <main className="mx-auto max-w-3xl px-5 pt-24 pb-24 sm:pt-20 lg:pr-72">
          <WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!myFinish} />
        </main>
      </div>

      {/* desktop right rail; hidden on mobile (v1 — mobile drawer is a follow-up) */}
      <div className="fixed right-0 top-0 z-30 hidden h-full lg:block">
        <LiveFeed players={players} myId={myIdRef.current} />
      </div>

      {myFinish && (
        <MultiWinScreen
          finishers={finishers}
          myId={myIdRef.current}
          target={gameState.target}
          onPlayAgain={() => router.push('/')}
          onViewResults={handleViewResults}
        />
      )}
    </div>
  )
}

export default function MultiPlayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">Loading…</div>}>
      <MultiGame />
    </Suspense>
  )
}
