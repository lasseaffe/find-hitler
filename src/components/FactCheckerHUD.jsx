'use client'

// Two-row HUD pinned to top of screen.
// Row 1: article subject + latest accusation chip + found counter + score
// Row 2: scrollable chips bar showing all accusations so far
export default function FactCheckerHUD({ subject, found, total, score, accusations = [] }) {
  const latest = accusations.at(-1) ?? null

  function chipColor(acc) {
    if (acc.correct === true)  return 'bg-green-100 text-green-800 border-green-300'
    if (acc.correct === false) return 'bg-red-100 text-red-400 border-red-300 border-dashed'
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  }

  function chipSymbol(acc) {
    if (acc.correct === true)  return '✓'
    if (acc.correct === false) return '✗'
    return '?'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 font-mono">
      {/* Row 1 — main HUD */}
      <div className="bg-[#1a1a2e] border-b border-[#334155] px-4 py-2 flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-[#94a3b8] tracking-[0.12em] uppercase">Fact Checker</span>
          <span className="text-[13px] font-bold text-[#e2e8f0]">{subject}</span>
        </div>
        <div className="flex items-center gap-4">
          {latest && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Latest</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] border ${chipColor(latest)}`}>
                &ldquo;{latest.label}&rdquo; {chipSymbol(latest)}
              </span>
            </div>
          )}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Found</span>
            <span className="text-[18px] font-bold text-[#f59e0b]">
              {found}<span className="text-[12px] text-[#475569]">/{total}</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Score</span>
            <span className={`text-[14px] font-bold ${score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {score >= 0 ? '+' : ''}{score}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 — accusations chips bar */}
      <div className="bg-[#0f172a] border-b-2 border-[#2563eb] px-4 py-1.5 flex gap-2 items-center overflow-x-auto min-h-[30px]">
        <span className="text-[#475569] text-[10px] shrink-0">accusations →</span>
        {accusations.length === 0 && (
          <span className="text-[#334155] text-[10px]">click text to accuse</span>
        )}
        {accusations.map((acc, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-full text-[10px] border shrink-0 ${chipColor(acc)}`}
          >
            {chipSymbol(acc)} &ldquo;{acc.label}&rdquo;
          </span>
        ))}
      </div>
    </div>
  )
}
