import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(request) {
  try {
    const { target, mode, startPage, creatorScore, creatorPath, creatorClicks, creatorSeconds } = await request.json()

    if (!target || !mode || !startPage) {
      return NextResponse.json({ error: 'target, mode, startPage required' }, { status: 400 })
    }

    const session = await auth()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: session?.user?.id ?? null,
        target,
        mode,
        startPage,
        creatorScore: creatorScore ?? 0,
        creatorPath: creatorPath ?? [],
        creatorClicks: creatorClicks ?? 0,
        creatorSeconds: creatorSeconds ?? 0,
        expiresAt,
      },
    })

    return NextResponse.json({ token: challenge.token })
  } catch (err) {
    console.error('[challenge/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
