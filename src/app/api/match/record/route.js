import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateElo, getRankTier } from '@/lib/elo'

export async function POST(request) {
  try {
    const { userId, target, mode, clicks, seconds, score, path, won, opponentElo } = await request.json()

    if (!userId || !target || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    let eloChange = 0

    if (mode === 'ranked' && typeof opponentElo === 'number') {
      if (won) {
        const { newWinner, delta } = calculateElo(user.elo, opponentElo)
        eloChange = delta
        const newRank = getRankTier(newWinner)
        await prisma.user.update({
          where: { id: userId },
          data: { elo: newWinner, rank: newRank },
        })
      } else {
        const { newLoser, delta } = calculateElo(opponentElo, user.elo)
        eloChange = -delta
        const newRank = getRankTier(newLoser)
        await prisma.user.update({
          where: { id: userId },
          data: { elo: newLoser, rank: newRank },
        })
      }
    }

    const match = await prisma.match.create({
      data: {
        userId,
        target,
        mode,
        clicks: clicks ?? 0,
        seconds: seconds ?? 0,
        score: score ?? 0,
        path: path ?? [],
        won: won ?? false,
        eloChange,
      },
    })

    return NextResponse.json({ ok: true, matchId: match.id, eloChange })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
