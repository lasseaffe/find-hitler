const K = 32

// 6 tiers × 5 divisions (div 5 = lowest, div 1 = highest within tier)
// ELO 0–4999 maps to Bronze–Diamond; top 50 by ELO = Challenger
export const TIER_THRESHOLDS = [
  { tier: 'BRONZE',   min: 0,    label: 'Bronze'   },
  { tier: 'SILVER',   min: 1000, label: 'Silver'   },
  { tier: 'GOLD',     min: 2000, label: 'Gold'     },
  { tier: 'PLATINUM', min: 3000, label: 'Platinum' },
  { tier: 'DIAMOND',  min: 4000, label: 'Diamond'  },
]

export const TIER_COLORS = {
  BRONZE:     '#cd7f32',
  SILVER:     '#c0c0c0',
  GOLD:       '#ffd700',
  PLATINUM:   '#00b4d8',
  DIAMOND:    '#a855f7',
  CHALLENGER: '#f59e0b',
}

export function getRankFromElo(elo) {
  let tierData = TIER_THRESHOLDS[0]
  for (const t of TIER_THRESHOLDS) {
    if (elo >= t.min) tierData = t
  }
  const offsetInTier = elo - tierData.min
  const divIndex = Math.floor(offsetInTier / 200)
  const division = 5 - Math.min(divIndex, 4)
  return { tier: tierData.tier, division, label: tierData.label }
}

export function getRankLabel(elo) {
  const { label, division } = getRankFromElo(elo)
  return `${label} ${division}`
}

export function getRankKey(elo) {
  const { tier, division } = getRankFromElo(elo)
  return `${tier}_${division}`
}

export function calculateElo(winnerElo, loserElo) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const delta = Math.round(K * (1 - expectedWinner))
  return {
    newWinner: winnerElo + delta,
    newLoser:  loserElo  - delta,
    delta,
  }
}

export function getRankTier(elo) {
  return getRankFromElo(elo).tier
}

export async function getTopChallengers(prisma) {
  const top = await prisma.user.findMany({
    orderBy: { elo: 'desc' },
    take: 50,
    select: { id: true, elo: true },
  })
  return new Set(top.map(u => u.id))
}
