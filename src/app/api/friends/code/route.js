import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.friendCode.findUnique({ where: { userId: session.user.id } })
  if (!row) return NextResponse.json({ error: 'No code found' }, { status: 404 })

  return NextResponse.json({ code: row.code })
}
