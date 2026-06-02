import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const { token } = await params
    const challenge = await prisma.challenge.findUnique({
      where: { token },
      include: { responses: { orderBy: { playedAt: 'asc' }, take: 10 } },
    })

    if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 410 })
    }

    return NextResponse.json({
      id: challenge.id,
      target: challenge.target,
      mode: challenge.mode,
      startPage: challenge.startPage,
      creatorScore: challenge.creatorScore,
      creatorClicks: challenge.creatorClicks,
      creatorSeconds: challenge.creatorSeconds,
      responses: challenge.responses,
    })
  } catch (err) {
    console.error('[challenge/token]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
