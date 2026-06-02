import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { calculateElo, getRankKey, getRankFromElo, getTopChallengers } from '@/lib/elo'
import { computeNewBadges } from '@/lib/badges'

let challengerCache = { set: new Set(), ts: 0 }
async function getChallengerSet() {
  if (Date.now() - challengerCache.ts < 5 * 60 * 1000) return challengerCache.set
  const set = await getTopChallengers(prisma)
  challengerCache = { set, ts: Date.now() }
  return set
}

function computeStreak(lastPlayedAt, currentStreak) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (!lastPlayedAt) return 1
  const last = new Date(lastPlayedAt).toISOString().slice(0, 10)
  if (last === today) return currentStreak
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10)
  if (last === yesterday) return currentStreak + 1
  return 1
}

function updateBests(existing, { mode, clicks, seconds, score }) {
  const bests = typeof existing === 'string' ? JSON.parse(existing) : (existing ?? {})
  const current = bests[mode]
  const better =
    !current ||
    (mode === 'speedrun' ? seconds < current.seconds :
     mode === 'golf'     ? clicks < current.clicks   :
                           score > (current.score ?? 0))
  if (better) bests[mode] = { clicks, seconds, score }
  return bests
}

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      userId, target, mode, clicks, seconds, score, path,
      won, opponentElo, hardcore = false, wrongAccusations = 0, correctFinds = 0,
    } = body

    const session = await auth()
    const resolvedUserId = userId || session?.user?.id
    if (!resolvedUserId) {
      return NextResponse.json({ ok: true })
    }

    if (!target || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: resolvedUserId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // ELO (ranked only)
    let newElo = user.elo
    let eloChange = 0
    if (mode === 'ranked' && typeof opponentElo === 'number') {
      if (won) {
        const result = calculateElo(user.elo, opponentElo)
        newElo = result.newWinner
        eloChange = result.delta
      } else {
        const result = calculateElo(opponentElo, user.elo)
        newElo = result.newLoser
        eloChange = -result.delta
      }
    }

    // Streak
    const newStreak = computeStreak(user.lastPlayedAt, user.streak ?? 0)
    const newLongest = Math.max(newStreak, user.longestStreak ?? 0)

    // Personal bests (wins only)
    const newBests = won
      ? updateBests(user.bests, { mode, clicks: clicks ?? 0, seconds: seconds ?? 0, score: score ?? 0 })
      : user.bests

    // Total games for badge triggers
    const totalGames = await prisma.match.count({ where: { userId: resolvedUserId } }) + 1

    // Badges
    const challengerSet = await getChallengerSet()
    const newBadges = computeNewBadges({
      totalGames,
      won: won ?? false,
      clicks: clicks ?? 0,
      seconds: seconds ?? 0,
      mode,
      hardcore,
      streak: newStreak,
      longestStreak: newLongest,
      elo: newElo,
      existingBadges: user.badges ?? [],
      wrongAccusations,
      correctFinds,
    })

    // Challenger badge (external check — needs top-50 query)
    const isChallenger = challengerSet.has(resolvedUserId)
    if (isChallenger && !(user.badges ?? []).includes('challenger')) {
      newBadges.push('challenger')
    }

    const allBadges = [...new Set([...(user.badges ?? []), ...newBadges])]

    // Persist match
    const match = await prisma.match.create({
      data: {
        userId: resolvedUserId,
        target,
        mode,
        clicks: clicks ?? 0,
        seconds: seconds ?? 0,
        score: score ?? 0,
        path: path ?? [],
        won: won ?? false,
        eloChange,
        eloBefore: user.elo,
        eloAfter: newElo,
        totalPlayers: 1,
        opponentIds: [],
      },
    })

    // Persist user updates
    await prisma.user.update({
      where: { id: resolvedUserId },
      data: {
        elo: newElo,
        rank: getRankKey(newElo),
        division: getRankFromElo(newElo).division,
        streak: newStreak,
        longestStreak: newLongest,
        lastPlayedAt: new Date(),
        bests: newBests,
        badges: allBadges,
      },
    })

    return NextResponse.json({ ok: true, matchId: match.id, eloChange, newBadges, newStreak })
  } catch (err) {
    console.error('[match/record]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
