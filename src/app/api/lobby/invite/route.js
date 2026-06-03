import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { emitToUser } from '@/lib/socketHandlers.js'

export async function POST(request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const fromUserId = session.user.id

  const { toUserId, lobbyCode, target, mode } = await request.json()
  if (!toUserId || !lobbyCode) return NextResponse.json({ error: 'Missing toUserId or lobbyCode' }, { status: 400 })

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min
  await prisma.lobbyInvite.create({
    data: { fromUserId, toUserId, lobbyCode, expiresAt },
  })

  // Real-time delivery if recipient is online
  emitToUser(toUserId, 'lobby:invite', {
    fromName: session.user.name || 'Someone',
    lobbyCode,
    target: target || '',
    mode: mode || '',
  })

  return NextResponse.json({ ok: true })
}
