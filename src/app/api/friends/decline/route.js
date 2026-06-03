import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { friendshipId } = await request.json()

  const row = await prisma.friendship.findFirst({
    where: { id: friendshipId, addresseeId: session.user.id, status: 'PENDING' },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.friendship.update({ where: { id: friendshipId }, data: { status: 'DECLINED' } })
  return NextResponse.json({ ok: true })
}
