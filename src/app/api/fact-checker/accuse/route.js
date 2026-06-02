import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scoreAccusation } from '@/lib/factChecker'

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

    // foundSoFar is the list of previously-found mistake fcIds (server-authoritative ids).
    const foundIds = new Set(Array.isArray(foundSoFar) ? foundSoFar : [])
    if (result.correct && result.foundId) foundIds.add(result.foundId)
    const allFound = foundIds.size >= article.mistakes.length

    return NextResponse.json({
      correct: result.correct,
      delta: result.delta,
      explanation: result.explanation,
      answer: result.answer,
      foundId: result.foundId,
      allFound,
    })
  } catch (err) {
    console.error('[fact-checker/accuse]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
