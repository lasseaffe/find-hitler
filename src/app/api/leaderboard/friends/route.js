import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ entries: [] })

    const userId = session.user.id

    const [asCreator, asRespondent] = await Promise.all([
      prisma.challenge.findMany({
        where: { creatorId: userId },
        include: { responses: { select: { responderId: true } } },
      }),
      prisma.challengeResponse.findMany({
        where: { responderId: userId },
        include: { challenge: { select: { creatorId: true } } },
      }),
    ])

    const friendIds = new Set()
    for (const c of asCreator) {
      for (const r of c.responses) {
        if (r.responderId && r.responderId !== userId) friendIds.add(r.responderId)
      }
    }
    for (const r of asRespondent) {
      if (r.challenge.creatorId && r.challenge.creatorId !== userId) friendIds.add(r.challenge.creatorId)
    }

    if (friendIds.size === 0) return NextResponse.json({ entries: [] })

    const friends = await prisma.user.findMany({
      where: { id: { in: [...friendIds] } },
      select: { id: true, name: true, elo: true, rank: true },
      orderBy: { elo: 'desc' },
    })

    return NextResponse.json({ entries: friends })
  } catch (err) {
    console.error('[leaderboard/friends]', err)
    return NextResponse.json({ entries: [] })
  }
}
