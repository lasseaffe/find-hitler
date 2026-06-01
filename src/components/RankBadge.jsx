import { RANKS } from '@/lib/elo'

export default function RankBadge({ rank, elo, showElo = true, size = 'md' }) {
  const tier = RANKS[rank] || RANKS.BRONZE
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }[size] || 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-black font-mono uppercase tracking-widest border ${sizeClasses}`}
      style={{ color: tier.color, borderColor: tier.color + '60', background: tier.color + '15' }}
    >
      <span>{tier.label}</span>
      {showElo && <span className="opacity-70">{elo}</span>}
    </span>
  )
}
