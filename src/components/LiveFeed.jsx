'use client'

const HUB_PAGES = new Set([
  'world war ii', 'united states', 'germany', 'europe', 'asia',
  'united kingdom', 'france', 'russia', 'china', 'india',
])

function isHubRisk(page) {
  return HUB_PAGES.has(page?.toLowerCase())
}

export default function LiveFeed({ players, myId }) {
  const sorted = [...players].sort((a, b) => a.clicks - b.clicks)

  return (
    <div className="w-64 h-full bg-[#1a1a2e] border-l border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">⚡ Live Race Feed</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sorted.map(p => (
          <div
            key={p.id}
            className={`rounded-lg px-3 py-2 text-xs font-mono ${
              p.id === myId ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#0d1117]'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`font-bold truncate max-w-[120px] ${p.isBot ? 'text-orange-400' : 'text-white'}`}>
                {p.id === myId ? '▶ YOU' : p.name}
              </span>
              <span className="text-yellow-400 font-bold ml-2">{p.clicks}</span>
            </div>
            <div className={`text-[10px] truncate ${isHubRisk(p.currentPage) ? 'text-orange-400' : 'text-gray-400'}`}>
              {p.currentPage || 'Starting...'}
            </div>
            {p.finished && (
              <div className="text-green-400 text-[10px] mt-1">✓ Finished</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
