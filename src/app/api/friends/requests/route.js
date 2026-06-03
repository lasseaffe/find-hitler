import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ requests: [] })

  const requests = await prisma.friendship.findMany({
    where: { addresseeId: session.user.id, status: 'PENDING' },
    include: { requester: { select: { id: true, name: true, elo: true } } },
  })

  return NextResponse.json({ requests })
}
