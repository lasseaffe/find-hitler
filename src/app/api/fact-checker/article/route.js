import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  const id = searchParams.get('id')
  const reveal = searchParams.get('reveal') === 'true'

  if (id && reveal) {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const article = await db.factCheckArticle.findUnique({ where: { id } })
      if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ mistakes: article.mistakes })
    } catch (err) {
      console.error('[fact-checker/article reveal]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  const category = searchParams.get('category') ?? null
  const where = { status: 'approved' }
  if (category) where.category = category

  try {
    const count = await db.factCheckArticle.count({ where })
    if (count === 0) {
      return NextResponse.json({ error: 'No approved articles' }, { status: 404 })
    }

    const skip = Math.floor(Math.random() * count)
    const article = await db.factCheckArticle.findFirst({ where, skip })
    if (!article) return NextResponse.json({ error: 'No approved articles' }, { status: 404 })

    const safeSpans = article.spans.map(({ text }) => ({ text }))

    return NextResponse.json({
      id: article.id,
      title: article.title,
      subject: article.subject,
      category: article.category,
      tampered: article.tampered,
      spans: safeSpans,
      mistakeCount: article.mistakes.length,
    })
  } catch (err) {
    console.error('[fact-checker/article]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
