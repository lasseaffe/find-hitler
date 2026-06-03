import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(request.url)
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }
  const userId = session.user.id
  const { code } = await params

  const friendCodeRow = await prisma.friendCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!friendCodeRow) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
  if (friendCodeRow.userId === userId) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendCodeRow.userId },
        { requesterId: friendCodeRow.userId, addresseeId: userId },
      ],
    },
  })
  if (existing) return NextResponse.json({ error: 'Already friends or pending' }, { status: 409 })

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: friendCodeRow.userId, status: 'PENDING' },
  })

  return NextResponse.redirect(new URL('/profile?friendRequested=1', request.url))
}
