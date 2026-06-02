import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scoreAccusation } from '@/lib/factChecker'

export async function POST(request) {
  const { articleId, selection, foundSoFar = [] } = await request.json()

  if (!articleId || typeof selection !== 'string' || !selection.trim()) {
    return NextResponse.json({ error: 'articleId and selection required' }, { status: 400 })
  }

  try {
    const article = await prisma.factCheckArticle.findUnique({ where: { id: articleId } })
    if (!article || article.status !== 'approved') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Use article's difficulty from DB — never trust client input for scoring
    const difficulty = article.difficulty ?? 'medium'
    const result = scoreAccusation(selection, article.mistakes, difficulty)

    const allFound = result.correct
      ? [...foundSoFar, selection].length >= article.mistakes.length
      : foundSoFar.length >= article.mistakes.length

    return NextResponse.json({
      correct: result.correct,
      delta: result.delta,
      explanation: result.explanation,
      answer: result.answer,
      allFound,
    })
  } catch (err) {
    console.error('[fact-checker/accuse]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
