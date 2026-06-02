import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  // Post-game reveal: return full mistakes for a specific article
  const id = searchParams.get('id')
  const reveal = searchParams.get('reveal') === 'true'
  if (id && reveal) {
    const article = await db.factCheckArticle.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ mistakes: article.mistakes })
  }

  const difficulty = searchParams.get('difficulty') ?? 'medium'
  const category = searchParams.get('category') ?? null

  const where = { status: 'approved' }
  if (category) where.category = category

  const count = await db.factCheckArticle.count({ where })
  if (count === 0) {
    return NextResponse.json({ error: 'No approved articles' }, { status: 404 })
  }

  const skip = Math.floor(Math.random() * count)
  const article = await db.factCheckArticle.findFirst({ where, skip })

  // Strip isMistake from spans — never expose answer key to client
  const safeSpans = article.spans.map(({ text }) => ({ text }))

  return NextResponse.json({
    id: article.id,
    title: article.title,
    subject: article.subject,
    category: article.category,
    tampered: article.tampered,
    spans: safeSpans,
    mistakeCount: article.mistakes.length,
    difficulty,
  })
}
