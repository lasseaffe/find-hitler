import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(request) {
  const { articleId, score, correct, wrong, seconds } = await request.json()

  const session = await auth()

  if (session?.user?.id) {
    await db.match.create({
      data: {
        userId: session.user.id,
        target: articleId,
        mode: 'fact-checker',
        clicks: correct,
        seconds,
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
  }

  return NextResponse.json({ ok: true })
}
