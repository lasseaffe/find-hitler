import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

async function requireAdmin() {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.warn('[admin] ADMIN_EMAIL env var is not set')
  }
  if (!session?.user?.email || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'

  try {
    const articles = await prisma.factCheckArticle.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ articles })
  } catch (err) {
    console.error('[admin/fact-checker GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id, action } = await request.json()
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })
  }

  const data = action === 'approve'
    ? { status: 'approved', approvedAt: new Date() }
    : { status: 'rejected' }

  try {
    const updated = await prisma.factCheckArticle.update({ where: { id }, data })
    return NextResponse.json({ ok: true, article: updated })
  } catch (err) {
    console.error('[admin/fact-checker PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
