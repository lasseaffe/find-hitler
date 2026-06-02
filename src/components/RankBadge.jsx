'use client'
import { getRankLabel, TIER_COLORS, getRankFromElo } from '@/lib/elo'

export default function RankBadge({ elo, isChallenger = false }) {
  if (isChallenger) {
    return (
      <span style={{ color: TIER_COLORS.CHALLENGER, fontWeight: 'bold', fontFamily: 'monospace' }}>
        ★ Challenger
      </span>
    )
  }
  const label = getRankLabel(elo)
  const { tier } = getRankFromElo(elo)
  return (
    <span style={{ color: TIER_COLORS[tier], fontWeight: 'bold', fontFamily: 'monospace' }}>
      {label}
    </span>
  )
}
