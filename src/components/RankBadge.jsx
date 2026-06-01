import { RANKS } from '@/lib/elo'

export default function RankBadge({ rank, elo, showElo = true, size = 'md' }) {
  const tier = RANKS[rank] || RANKS.BRONZE
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 border-2',
    md: 'text-sm px-3 py-1 border-[3px]',
    lg: 'text-lg px-4 py-1.5 border-[3px]',
  }[size] || 'text-sm px-3 py-1 border-[3px]'

  // brutalist: hard ink box, display label, elo in red. (tier identity kept in label)
  return (
    <span className={`inline-flex items-center gap-2 border-ink bg-ink font-display uppercase tracking-wide text-paper ${sizeClasses}`}>
      <span>{tier.label}</span>
      {showElo && <span className="font-mono text-red">{elo}</span>}
    </span>
  )
}
