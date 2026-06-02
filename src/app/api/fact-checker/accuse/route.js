import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scoreAccusation, reconcileFound } from '@/lib/factChecker'

export async function POST(request) {
  const { articleId, fcId, selection, foundSoFar = [] } = await request.json()

  if (!articleId || (!fcId && (typeof selection !== 'string' || !selection.trim()))) {
    return NextResponse.json({ error: 'articleId and fcId or selection required' }, { status: 400 })
  }

  try {
    const article = await prisma.factCheckArticle.findUnique({ where: { id: articleId } })
    if (!article || article.status !== 'approved') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const difficulty = article.difficulty ?? 'medium'
    const result = scoreAccusation({ fcId, selection }, article.mistakes, difficulty)

    const { allFound, duplicate } = reconcileFound(
      foundSoFar, article.mistakes, result.correct ? result.foundId : null
    )
    // A duplicate find (same mistake re-selected) scores nothing.
    const delta = duplicate ? 0 : result.delta

    return NextResponse.json({
      correct: result.correct,
      delta,
      explanation: duplicate ? null : result.explanation,
      answer: duplicate ? null : result.answer,
      foundId: result.foundId,
      allFound,
      duplicate,
    })
  } catch (err) {
    console.error('[fact-checker/accuse]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
