import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { stripTruthForClient } from '@/lib/factCheckerGen'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const reveal = searchParams.get('reveal') === 'true'

  // Reveal (post-game): returns the truth. Auth-gated.
  if (id && reveal) {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const article = await prisma.factCheckArticle.findUnique({ where: { id } })
      if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ mistakes: article.mistakes })
    } catch (err) {
      console.error('[fact-checker/article reveal]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  const difficulty = searchParams.get('difficulty') ?? 'medium'
  const category = searchParams.get('category') ?? null
  const where = { status: 'approved', difficulty }
  if (category) where.category = category

  try {
    const count = await prisma.factCheckArticle.count({ where })
    if (count === 0) {
      return NextResponse.json({ error: 'No approved articles' }, { status: 404 })
    }
    const skip = Math.floor(Math.random() * count)
    const article = await prisma.factCheckArticle.findFirst({ where, skip })
    if (!article) return NextResponse.json({ error: 'No approved articles' }, { status: 404 })

    // The browser never receives `mistakes`/`decoys` or the data-fc-mistake truth flag.
    const clientHtml = stripTruthForClient(article.tampered, article.difficulty)

    return NextResponse.json({
      id: article.id,
      title: article.title,
      subject: article.subject,
      category: article.category,
      difficulty: article.difficulty,
      clientHtml,
      sourceUrl: article.sourceUrl,
      mistakeCount: article.mistakes.length,
    })
  } catch (err) {
    console.error('[fact-checker/article]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
