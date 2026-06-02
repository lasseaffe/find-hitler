import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

async function requireAdmin() {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL
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

  const articles = await db.factCheckArticle.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ articles })
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

  const updated = await db.factCheckArticle.update({ where: { id }, data })
  return NextResponse.json({ ok: true, article: updated })
}
