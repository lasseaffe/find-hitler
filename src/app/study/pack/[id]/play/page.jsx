'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FactCheckerHUD from '@/components/FactCheckerHUD'
import FactCheckerArticle from '@/components/FactCheckerArticle'
import StudyHUD from '@/components/study/StudyHUD'
import MistakeOverlay from '@/components/study/MistakeOverlay'

export default function StudyPlayPage({ params }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') ?? 'medium'

  const [session, setSession] = useState(null)
  const [pack, setPack] = useState(null)
  const [articleIndex, setArticleIndex] = useState(0)
  const [article, setArticle] = useState(null)
  const [accusations, setAccusations] = useState([])
  const [score, setScore] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [done, setDone] = useState(false)
  const [overlay, setOverlay] = useState(null)
  const [loading, setLoading] = useState(true)
  const startTimeRef = useRef(Date.now())
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    Promise.all([
      fetch(`/api/study/pack/${params.id}`).then(r => r.json()),
      fetch('/api/study/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: params.id, difficulty }),
      }).then(r => r.json()),
    ]).then(([packData, sessionData]) => {
      setPack(packData)
      setSession(sessionData)
      loadArticle(packData.articles[0]?.article)
    })
  }, [params.id, difficulty])

  async function loadArticle(articleData) {
    if (!articleData) return
    setLoading(true)
    const res = await fetch(`/api/study/article/${articleData.id}`)
    const full = await res.json()
    startTimeRef.current = Date.now()
    setAccusations([])
    setScore(0)
    setDone(false)
    setArticle(full)
    setLoading(false)
  }

  async function handleAccuse(payload) {
    if (done || !article) return
    const dup = accusations.some(a =>
      (payload.fcId && a.fcId === payload.fcId) ||
      (!payload.fcId && a.label?.toLowerCase() === payload.label?.toLowerCase())
    )
    if (dup) return

    const res = await fetch('/api/fact-checker/accuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        fcId: payload.fcId,
        selection: payload.selection,
        foundSoFar: accusations.filter(a => a.correct && a.fcId).map(a => a.fcId),
      }),
    })
    const data = await res.json()
    const newAccusations = [...accusations, { ...payload, ...data }]
    setAccusations(newAccusations)
    setScore(prev => prev + (data.delta ?? 0))

    if (data.allFound) {
      setDone(true)
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
      const correct = newAccusations.filter(a => a.correct).length
      const wrong = newAccusations.filter(a => !a.correct).length
      const finalScore = score + (data.delta ?? 0)
      const allMistakes = article.mistakes ?? []
      const foundIds = new Set(newAccusations.filter(a => a.correct).map(a => a.fcId))
      const missedMistakes = allMistakes.filter(m => !foundIds.has(m.fcId))

      await fetch(`/api/study/session/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          score: finalScore,
          correctCount: correct,
          wrongCount: wrong,
          timeTaken,
          missedMistakes,
        }),
      })

      setTotalScore(prev => prev + finalScore)
      setOverlay({ score: finalScore, correctCount: correct, wrongCount: wrong, missedMistakes })
    }
  }

  function handleNext() {
    const nextIndex = articleIndex + 1
    const articles = pack?.articles ?? []
    if (nextIndex >= articles.length) {
      router.push(`/study/session/${session.id}/results`)
      return
    }
    setOverlay(null)
    setArticleIndex(nextIndex)
    loadArticle(articles[nextIndex].article)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        Loading article…
      </div>
    )
  }

  const articles = pack?.articles ?? []
  const isLast = articleIndex === articles.length - 1

  return (
    <div className="min-h-screen bg-zinc-950 pt-12">
      {pack && session && (
        <StudyHUD
          packName={pack.name}
          current={articleIndex + 1}
          total={articles.length}
          totalScore={totalScore}
        />
      )}

      {article && (
        <>
          <FactCheckerHUD
            score={score}
            found={accusations.filter(a => a.correct).length}
            total={article.mistakes?.length ?? 0}
            difficulty={difficulty}
          />
          <FactCheckerArticle
            html={article.tampered}
            title={article.title}
            difficulty={difficulty}
            onAccuse={handleAccuse}
            accused={accusations}
          />
        </>
      )}

      {overlay && (
        <MistakeOverlay
          result={overlay}
          isLast={isLast}
          onNext={handleNext}
          onReview={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
