import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, elo: true, rank: true, createdAt: true },
  })

  const matches = await prisma.match.findMany({
    where: { userId: session.user.id },
    orderBy: { playedAt: 'desc' },
    take: 100,
    select: {
      id: true, target: true, mode: true, clicks: true, seconds: true,
      score: true, path: true, won: true, eloChange: true, eloBefore: true,
      eloAfter: true, rank: true, totalPlayers: true, opponentIds: true, playedAt: true,
    },
  })

  // Resolve opponent names from their user IDs
  const allOpponentIds = [...new Set(matches.flatMap(m => m.opponentIds || []))]
  const opponents = allOpponentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allOpponentIds } },
        select: { id: true, name: true },
      })
    : []
  const opponentMap = Object.fromEntries(opponents.map(o => [o.id, o.name || o.id]))

  const enriched = matches.map(m => ({
    ...m,
    opponents: (m.opponentIds || []).map(id => ({ userId: id, name: opponentMap[id] || 'Unknown' })),
    playedAt: m.playedAt.toISOString(),
  }))

  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({
    user,
    matches: enriched,
    stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 },
  })
}
