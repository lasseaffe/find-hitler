'use client'
import { useState, useEffect } from 'react'
import HitlerMark from '@/components/ui/HitlerMark'

// Brutalist race HUD: a fixed top data-bar (wraps to 2 rows on mobile) + a fixed
// bottom action bar (UNDO is thumb-reachable on mobile, a footer control on desktop).
export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo, timeLimitSeconds, jesusRound, onTimeUp }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!timeLimitSeconds) return
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= timeLimitSeconds && onTimeUp) onTimeUp()
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, onTimeUp])

  const remaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null
  const mins = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, '0') : null
  const secs = remaining !== null ? String(remaining % 60).padStart(2, '0') : null
  const danger = remaining !== null && remaining <= 30

  return (
    <>
      {/* TOP DATA BAR */}
      <header className="fixed inset-x-0 top-0 z-40 border-b-4 border-ink bg-ink text-paper pt-safe">
        <div className="flex flex-wrap items-stretch font-mono text-[10px] leading-none">
          <div className="flex items-center gap-2 px-3 py-2.5 border-r border-paper/20 min-w-0">
            <HitlerMark size={20} fill="var(--color-paper)" className="flex-none" />
            <div className="min-w-0">
              <div className="text-[8px] uppercase tracking-widest text-paper/50">Target</div>
              <div className="truncate font-display text-xs uppercase tracking-wide">{target}</div>
            </div>
          </div>
          <div className="hidden sm:flex flex-1 items-center gap-1 px-3 py-2.5 border-r border-paper/20 min-w-0">
            <span className="text-paper/50">PATH</span>
            <span className="truncate">{startPage} <span className="text-paper/40">›</span> …</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-paper/20">
            <span className="text-paper/50">CLICKS</span>
            <span className="font-display text-base">{clicks}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-paper/20">
            <span className="text-paper/50">UNDO</span>
            <span className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className={`h-2.5 w-2.5 ${i < undoTokens ? 'bg-paper' : 'bg-paper/25'}`} />
              ))}
            </span>
          </div>
          {jesusRound != null && (
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-paper/20">
              <span className="text-paper/50">ROUND</span>
              <span className="font-display text-base">{jesusRound}<span className="text-paper/40 text-xs"> / 5</span></span>
            </div>
          )}
          {remaining !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-2.5 ${danger ? 'bg-red animate-pulse' : 'bg-red'} text-paper`}>
              <span className="text-paper/70">TIME</span>
              <span className="font-display text-base">{mins}:{secs}</span>
            </div>
          )}
        </div>
      </header>

      {/* BOTTOM ACTION BAR */}
      <footer className="fixed inset-x-0 bottom-0 z-40 flex border-t-4 border-ink bg-paper pb-safe">
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          className="flex-none min-h-[52px] border-r-4 border-ink px-5 font-display uppercase text-sm tracking-wide disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-paper-dim"
        >
          ↶ Undo{undoTokens > 0 ? ` (${undoTokens})` : ''}
        </button>
        <div className="flex flex-1 items-center justify-end px-4 font-mono text-[10px] uppercase tracking-widest text-ink/60">
          {clicks} clicks · keep going
        </div>
      </footer>
    </>
  )
}
