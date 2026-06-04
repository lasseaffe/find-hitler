'use client'

export default function StudyHUD({ packName, current, total, totalScore }) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-2 flex items-center gap-4">
      <span className="text-xs text-zinc-400 truncate max-w-40">{packName}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className="bg-red-600 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 shrink-0">{current}/{total}</span>
      <span className="text-xs font-mono text-white shrink-0">{totalScore.toLocaleString()} pts</span>
    </div>
  )
}
