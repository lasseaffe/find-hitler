'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import HpDuelHUD from '@/components/HpDuelHUD'
import EloChange from '@/components/EloChange'
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
    return <div className="flex items-center justify-center min-h-screen font-mono text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <HpDuelHUD duelPlayers={duelPlayers} myId={myIdRef.current} round={round} />

      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-[999] bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 animate-pulse" />
      )}

      <GameHUD
        startPage={gameState.startPage}
        target={gameState.target}
        mode="ranked"
        clicks={clicks}
        undoTokens={undoTokens}
        onUndo={() => {}}
      />

      <div className="max-w-3xl mx-auto pt-32 px-6">
        <WikiArticle
          html={html}
          onNavigate={handleNavigate}
          disabled={isLoading || !!duelFinished}
        />
      </div>

      {eloChange !== null && session?.user && (
        <EloChange
          delta={eloChange}
          oldElo={(session.user.elo || 1000) - eloChange}
          newElo={session.user.elo || 1000}
        />
      )}

      {duelFinished && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0d1117] border border-yellow-400/30 rounded-2xl px-10 py-8 text-center space-y-4 max-w-sm">
            <div className="text-5xl">{duelFinished.isWinner ? '🏆' : '💀'}</div>
            <h2 className="text-3xl font-black text-yellow-400">
              {duelFinished.isWinner ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="text-gray-400 font-mono text-sm">Duel complete · ELO updated</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/ranked')}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-sm"
              >
                Play Again
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm"
              >
                Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RankedPlayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <RankedGame />
    </Suspense>
  )
}
