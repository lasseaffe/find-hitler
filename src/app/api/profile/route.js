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
    take: 50,
    select: {
      id: true, target: true, mode: true, clicks: true, seconds: true,
      score: true, won: true, eloChange: true, playedAt: true,
    },
  })

  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({ user, matches, stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 } })
}
