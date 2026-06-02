import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(request) {
  try {
    const { challengeId, responderName, score, path, clicks, seconds } = await request.json()

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId required' }, { status: 400 })
    }

    const session = await auth()
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const won = (score ?? 0) > challenge.creatorScore

    const response = await prisma.challengeResponse.create({
      data: {
        challengeId,
        responderId: session?.user?.id ?? null,
        responderName: responderName ?? 'Anonymous',
        score: score ?? 0,
        path: path ?? [],
        clicks: clicks ?? 0,
        seconds: seconds ?? 0,
        won,
      },
    })

    return NextResponse.json({ ok: true, responseId: response.id, won, creatorScore: challenge.creatorScore })
  } catch (err) {
    console.error('[challenge/respond]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
