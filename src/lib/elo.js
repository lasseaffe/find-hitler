// K-factor: standard chess value
const K = 32

export const RANKS = {
  BRONZE: { min: 0, max: 1199, label: 'Bronze', color: '#cd7f32' },
  SILVER: { min: 1200, max: 1499, label: 'Silver', color: '#c0c0c0' },
  GOLD:   { min: 1500, max: 1799, label: 'Gold',   color: '#ffd700' },
  MASTER: { min: 1800, max: Infinity, label: 'Master', color: '#b24bf3' },
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
  for (const [tier, { min, max }] of Object.entries(RANKS)) {
    if (elo >= min && elo <= max) return tier
  }
  return 'BRONZE'
}
