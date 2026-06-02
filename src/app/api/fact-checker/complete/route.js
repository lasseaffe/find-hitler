import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(request) {
  const { articleId, score, correct, wrong, seconds } = await request.json()

  if (!articleId || typeof score !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const session = await auth()

  if (session?.user?.id) {
    try {
      await prisma.match.create({
        data: {
          userId: session.user.id,
          target: articleId,
          mode: 'fact-checker',
          clicks: correct ?? 0,
          seconds: seconds ?? 0,
          score,
          path: [],
          won: wrong === 0,
          eloChange: 0,
          eloBefore: 0,
          eloAfter: 0,
          totalPlayers: 1,
          opponentIds: [],
        },
      })
    } catch (err) {
      console.error('[fact-checker/complete]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
