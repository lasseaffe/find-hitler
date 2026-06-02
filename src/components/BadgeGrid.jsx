import { ALL_BADGE_IDS, BADGE_META } from '@/lib/badges'

export default function BadgeGrid({ earned = [] }) {
  const ownedSet = new Set(earned)
  return (
    <div className="grid grid-cols-4 gap-3">
      {ALL_BADGE_IDS.map(id => {
        const meta = BADGE_META[id]
        const owned = ownedSet.has(id)
        return (
          <div
            key={id}
            title={meta.desc}
            className={`flex flex-col items-center gap-1 p-2 rounded border text-center ${
              owned
                ? 'border-[#2563eb] bg-[#1e3a5f]'
                : 'border-[#1e293b] bg-[#0f172a] opacity-40'
            }`}
          >
            <span className="text-[18px]">{owned ? '🏅' : '🔒'}</span>
            <span className="text-[10px] font-mono text-[#e2e8f0] leading-tight">{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}
