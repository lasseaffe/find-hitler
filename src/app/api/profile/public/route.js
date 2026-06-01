import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, elo: true, rank: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const matches = await prisma.match.findMany({
    where: { userId },
    select: { won: true },
  })
  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({
    user,
    stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 },
  })
}
