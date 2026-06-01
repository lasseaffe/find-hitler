'use client'

const HUB_PAGES = new Set([
  'world war ii', 'united states', 'germany', 'europe', 'asia',
  'united kingdom', 'france', 'russia', 'china', 'india',
])
function isHubRisk(page) { return HUB_PAGES.has(page?.toLowerCase()) }

export default function LiveFeed({ players, myId, compact = false }) {
  const sorted = [...players].sort((a, b) => a.clicks - b.clicks)

  return (
    <div className={`flex flex-col border-l-4 border-ink bg-paper border-b-4 ${compact ? '' : 'h-full'}`} style={{ width: 264, maxHeight: compact ? 200 : undefined }}>
      <div className="border-b-4 border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 flex-shrink-0">
        ⚡ Live Race Feed
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map(p => (
          <div key={p.id} className={`border-b-2 border-ink px-3 py-2 font-mono text-xs ${p.id === myId ? 'border-l-[6px] border-l-red bg-red/10' : ''}`}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="max-w-[120px] truncate font-display uppercase text-[11px]">
                {p.id === myId ? '▶ You' : p.name}
              </span>
              <span className="ml-2 font-display text-sm">{p.clicks}</span>
            </div>
            <div className={`truncate text-[9px] ${isHubRisk(p.currentPage) ? 'text-red' : 'text-ink/60'}`}>
              {p.currentPage || 'Starting…'}
            </div>
            {p.finished && <div className="text-[9px] uppercase tracking-wide text-red">✓ Finished</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
