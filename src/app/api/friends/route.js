import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isOnline } from '@/lib/socketHandlers.js'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ friends: [] })
  const userId = session.user.id

  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, name: true, elo: true, rank: true } },
      addressee: { select: { id: true, name: true, elo: true, rank: true } },
    },
  })

  const friends = rows.map(row => {
    const friend = row.requesterId === userId ? row.addressee : row.requester
    return { ...friend, online: isOnline(friend.id) }
  })

  return NextResponse.json({ friends })
}
