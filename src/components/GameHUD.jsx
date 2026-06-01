'use client'
import { useState, useEffect } from 'react'

export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo, timeLimitSeconds, jesusRound, onTimeUp, onElapsedTick }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (timeLimitSeconds && next >= timeLimitSeconds && onTimeUp) onTimeUp()
        if (onElapsedTick) onElapsedTick(next)
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, onTimeUp, onElapsedTick])

  const remaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null
  const displaySeconds = remaining !== null ? remaining : elapsed
  const mins = String(Math.floor(displaySeconds / 60)).padStart(2, '0')
  const secs = String(displaySeconds % 60).padStart(2, '0')
  const danger = remaining !== null && remaining <= 30
  const ultraDanger = remaining !== null && remaining <= 10
  const isCountdown = remaining !== null

  const modeLabel = {
    classic: 'Classic · Fewest clicks wins',
    speedrun: 'Speedrun · Fastest time wins',
    golf: 'Golf · 5-min cap · lowest clicks',
    jesus: '5-Clicks to Jesus · par scoring',
    daily: 'Daily Challenge · one attempt',
    nohub: 'No-Hub · hubs bounce you',
  }[mode] ?? mode ?? 'Classic'

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 pt-safe" style={{ background: '#0e0e0e', borderBottom: '3px solid #e5241e' }}>
        <div className="flex items-stretch" style={{ minHeight: 80 }}>

          {/* LEFT: Clicks */}
          <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0" style={{ padding: '0 28px', borderRight: '1px solid #1e1e1e' }}>
            <span style={{ color: '#777', fontSize: 11, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>Clicks</span>
            <span style={{ color: '#f5f0e8', fontSize: 38, fontWeight: 700, fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>{clicks}</span>
          </div>

          {/* CENTRE: Target */}
          <div className="flex flex-col items-center justify-center gap-1.5 flex-1" style={{ padding: '10px 24px', borderRight: '1px solid #1e1e1e' }}>
            <span style={{ color: '#666', fontSize: 9, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Target</span>
            <span style={{ background: '#e5241e', color: '#fff', fontSize: 24, fontWeight: 700, padding: '3px 16px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace,monospace' }}>{target}</span>
            <span style={{ color: '#888', fontSize: 13, letterSpacing: '0.04em', fontFamily: 'ui-monospace,monospace', textAlign: 'center' }}>Navigate Wikipedia links to find him</span>
          </div>

          {/* RIGHT: Timer + Undo side-by-side, Path below */}
          <div className="flex flex-col justify-center flex-shrink-0" style={{ padding: '10px 20px', width: 270, borderLeft: '1px solid #1e1e1e', gap: 8 }}>
            <div className="flex items-center" style={{ gap: 18 }}>
              {/* Timer */}
              <div className="flex flex-col" style={{ gap: 2 }}>
                <span style={{ fontSize: 7, color: '#444', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Time</span>
                <span style={{
                  fontSize: 28, fontWeight: 700, lineHeight: 1,
                  fontFamily: 'ui-monospace,monospace', letterSpacing: '0.04em',
                  color: danger ? '#ef4444' : isCountdown ? '#fbbf24' : '#888',
                  animation: ultraDanger ? 'fh-shudder-fast 0.15s ease-in-out infinite' : danger ? 'fh-shudder 0.3s ease-in-out infinite' : undefined,
                }}>{mins}:{secs}</span>
              </div>
              <div style={{ width: 1, background: '#222', alignSelf: 'stretch' }} />
              {/* Undo */}
              <div className="flex flex-col" style={{ gap: 5 }}>
                <span style={{ fontSize: 10, color: '#888', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Undo</span>
                <div className="flex" style={{ gap: 7, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < undoTokens ? '#f5f0e8' : '#252525', border: i < undoTokens ? 'none' : '1px solid #333', display: 'inline-block' }} />
                  ))}
                </div>
              </div>
              {jesusRound != null && (
                <span style={{ color: '#f5f0e8', fontSize: 11, fontFamily: 'ui-monospace,monospace', marginLeft: 8 }}>
                  R{jesusRound}<span style={{ color: '#444' }}>/5</span>
                </span>
              )}
            </div>
            {/* Path */}
            <div className="flex flex-col" style={{ gap: 1 }}>
              <span style={{ fontSize: 6.5, color: '#333', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Path</span>
              <span className="truncate" style={{ fontSize: 8, color: '#555', fontFamily: 'ui-monospace,monospace' }}>{startPage} › … › {target}</span>
            </div>
          </div>
        </div>

        {/* Mode strip */}
        <div style={{ background: '#0a0a0a', borderTop: '1px solid #161616', padding: '3px 16px', fontSize: 7, color: '#333', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {modeLabel}
        </div>
      </header>

      {/* Bottom action bar */}
      <footer className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3 pb-safe" style={{ background: '#0e0e0e', borderTop: '3px solid #e5241e', minHeight: 48 }}>
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          style={{
            background: undoTokens === 0 ? '#252525' : '#e5241e', color: undoTokens === 0 ? '#3a3a3a' : '#fff',
            border: 'none', fontFamily: 'ui-monospace,monospace', fontSize: 8.5, fontWeight: 700,
            padding: '5px 14px', textTransform: 'uppercase', letterSpacing: '0.1em',
            cursor: undoTokens === 0 ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >↶ Undo{undoTokens > 0 ? ` (${undoTokens})` : ''}</button>
        <span className="flex-1" />
        <span className="truncate text-right" style={{ color: '#444', fontSize: 7.5, fontFamily: 'ui-monospace,monospace', maxWidth: '60%' }}>
          {startPage} › … › {target}
        </span>
      </footer>
    </>
  )
}
