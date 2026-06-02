'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FactCheckerHUD from '@/components/FactCheckerHUD'
import FactCheckerArticle from '@/components/FactCheckerArticle'

export default function FactCheckerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') ?? 'medium'
  const initializedRef = useRef(false)

  const [article, setArticle] = useState(null)
  const [accusations, setAccusations] = useState([])
  const [score, setScore] = useState(0)
  const [found, setFound] = useState(0)
  const [done, setDone] = useState(false)
  const [revealMistakes, setRevealMistakes] = useState(null)
  const [loading, setLoading] = useState(true)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    fetch(`/api/fact-checker/article?difficulty=${difficulty}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoading(false); router.push('/'); return }
        setArticle(data)
        setLoading(false)
      })
      .catch(() => { setLoading(false); router.push('/') })
  }, [difficulty, router])

  async function handleAccuse(payload) {
    if (done || !article) return
    const label = payload.label
    // Dedupe: by fcId for clicks, by normalized label for selections.
    const dup = accusations.some(a =>
      (payload.fcId && a.fcId === payload.fcId) ||
      (!payload.fcId && a.label?.toLowerCase() === label?.toLowerCase())
    )
    if (dup) return

    const res = await fetch('/api/fact-checker/accuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        fcId: payload.fcId,
        selection: payload.selection,
        foundSoFar: accusations.filter(a => a.correct && a.foundId).map(a => a.foundId),
      }),
    })
    const data = await res.json()

    const newAcc = { label, fcId: data.foundId ?? payload.fcId, correct: data.correct, delta: data.delta }
    setAccusations(prev => [...prev, newAcc])
    setScore(prev => prev + data.delta)
    if (data.correct) {
      const newFound = found + 1
      setFound(newFound)
      if (data.allFound) {
        setDone(true)
        await finishGame(score + data.delta, newFound)
      }
    }
  }

  async function finishGame(finalScore, finalFound) {
    const seconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    const wrongCount = accusations.filter(a => a.correct === false).length

    await fetch('/api/fact-checker/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        score: finalScore,
        correct: finalFound,
        wrong: wrongCount,
        seconds,
      }),
    }).catch(() => {})

    const r = await fetch(`/api/fact-checker/article?id=${article.id}&reveal=true`)
    const d = await r.json()
    setRevealMistakes(d.mistakes ?? [])
  }

  async function handleGiveUp() {
    if (done) return
    setDone(true)
    await finishGame(score, found)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-mono">
        <p className="text-[#94a3b8] text-sm">Loading article...</p>
      </div>
    )
  }

  if (revealMistakes !== null) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pt-20 px-6 font-mono max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">{article.subject} — Results</h2>
        <p className="text-[#64748b] mb-6">
          Score: <strong>{score}</strong> · Found {found}/{article.mistakeCount}
        </p>
        <h3 className="text-lg font-bold mb-3">The planted mistakes:</h3>
        <div className="flex flex-col gap-4 mb-8">
          {revealMistakes.map((m, i) => (
            <div key={i} className="border border-[#e2e8f0] rounded p-4 bg-white">
              <p className="text-[13px] font-bold text-red-600 mb-1">&ldquo;{m.span}&rdquo; was wrong</p>
              <p className="text-[13px] text-[#1a1a1a] mb-1">Correct: <strong>{m.correct}</strong></p>
              <p className="text-[12px] text-[#64748b]">{m.explanation}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-[#2563eb] text-white font-bold rounded font-mono"
        >
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <FactCheckerHUD
        subject={article.subject}
        found={found}
        total={article.mistakeCount}
        score={score}
        accusations={accusations}
      />
      <div className="pt-24">
        <FactCheckerArticle
          html={article.clientHtml}
          difficulty={difficulty}
          onAccuse={handleAccuse}
          accused={accusations}
        />
      </div>
      {article.sourceUrl && (
        <p className="text-center text-[11px] text-[#94a3b8] py-4 font-mono">
          Adapted from Wikipedia (CC BY-SA) ·{' '}
          <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a>
        </p>
      )}
      {!done && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={handleGiveUp}
            className="px-4 py-2 bg-[#1a1a2e] text-[#94a3b8] text-sm font-mono rounded border border-[#334155] hover:text-[#e2e8f0]"
          >
            Give Up
          </button>
        </div>
      )}
    </div>
  )
}
