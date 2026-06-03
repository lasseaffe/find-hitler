import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ recent: [] })
  const userId = session.user.id

  const matches = await prisma.match.findMany({
    where: { userId },
    select: { opponentIds: true },
    orderBy: { playedAt: 'desc' },
    take: 50,
  })
  const opponentIds = [...new Set(matches.flatMap(m => m.opponentIds))].slice(0, 20)

  if (opponentIds.length === 0) return NextResponse.json({ recent: [] })

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  })
  const friendIds = new Set(friendships.flatMap(f => [f.requesterId, f.addresseeId]))
  friendIds.delete(userId)

  const recent = await prisma.user.findMany({
    where: { id: { in: opponentIds.filter(id => id !== userId && !friendIds.has(id)) } },
    select: { id: true, name: true, elo: true },
    take: 10,
  })

  return NextResponse.json({ recent })
}
