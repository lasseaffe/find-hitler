import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ invites: [] })

  const invites = await prisma.lobbyInvite.findMany({
    where: {
      toUserId: session.user.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: { from: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invites: invites.map(i => ({
      id: i.id,
      fromName: i.from.name,
      lobbyCode: i.lobbyCode,
      createdAt: i.createdAt,
    })),
  })
}
