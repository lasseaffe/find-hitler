import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scoreAccusation } from '@/lib/factChecker'

export async function POST(request) {
  const { articleId, selection, difficulty, foundSoFar = [] } = await request.json()

  if (!articleId || !selection) {
    return NextResponse.json({ error: 'articleId and selection required' }, { status: 400 })
  }

  const article = await db.factCheckArticle.findUnique({ where: { id: articleId } })
  if (!article || article.status !== 'approved') {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const result = scoreAccusation(selection, article.mistakes, difficulty ?? 'medium')

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
}
