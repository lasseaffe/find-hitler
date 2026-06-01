'use client'
import { useState, useEffect } from 'react'

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

  const modeLabel = {
    classic: 'Classic',
    speedrun: 'Speedrun',
    golf: 'Golf',
    jesus: '5-Clicks-to-Jesus',
    daily: 'Daily',
    nohub: 'No-Hub',
  }[mode] ?? mode ?? 'Classic'

  return (
    <>
      {/* ── TOP HEADER: two-row cockpit HUD ── */}
      <header className="fixed inset-x-0 top-0 z-40 pt-safe" style={{ background: '#0e0e0e', borderBottom: '3px solid #e5241e' }}>

        {/* Row 1: mode · target badge · spacer · timer */}
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #181818' }}>
          <span style={{ color: '#444', fontSize: 8, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>
            {modeLabel}
          </span>

          <span style={{
            background: '#e5241e', color: '#fff',
            fontSize: 9.5, fontWeight: 700,
            padding: '2px 9px',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.04em',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {target}
          </span>

          <span className="flex-1" />

          {remaining !== null && (
            <span style={{
              color: danger ? '#ef4444' : '#fbbf24',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.04em',
              flexShrink: 0,
              animation: danger ? 'fh-shudder 0.3s ease-in-out infinite' : undefined,
            }}>
              {mins}:{secs}
            </span>
          )}

          {jesusRound != null && (
            <span style={{ color: '#f5f0e8', fontSize: 11, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
              R{jesusRound}<span style={{ color: '#444' }}>/5</span>
            </span>
          )}
        </div>

        {/* Row 2: clicks · undo dots · path breadcrumb */}
        <div className="flex items-center" style={{ fontFamily: 'ui-monospace, monospace' }}>
          <div className="flex flex-col items-center gap-0.5 px-3 py-1" style={{ borderRight: '1px solid #181818', flexShrink: 0 }}>
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Clicks</span>
            <span style={{ color: '#f5f0e8', fontSize: 11, fontWeight: 600 }}>{clicks}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 px-3 py-1" style={{ borderRight: '1px solid #181818', flexShrink: 0 }}>
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Undo</span>
            <span className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: i < undoTokens ? '#f5f0e8' : '#252525',
                  display: 'inline-block',
                }} />
              ))}
            </span>
          </div>

          {/* Path breadcrumb */}
          <div className="flex flex-col gap-0.5 px-3 py-1 min-w-0 flex-1">
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Path</span>
            <span className="truncate" style={{ color: '#3a3a3a', fontSize: 8 }}>
              {startPage}
              <span style={{ color: '#2a2a2a' }}> › </span>
              <span style={{ color: '#888' }}>…</span>
            </span>
          </div>
        </div>

        {/* Desktop ticker strip */}
        <div
          className="hidden sm:block"
          style={{
            background: '#111',
            borderTop: '1px solid #181818',
            padding: '2px 12px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 7.5,
            color: '#383838',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {modeLabel.toUpperCase()} · Start: {startPage} · Target: {target} · Click blue links to navigate
        </div>
      </header>

      {/* ── BOTTOM ACTION BAR ── */}
      <footer
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3 pb-safe"
        style={{ background: '#0e0e0e', borderTop: '3px solid #e5241e', minHeight: 48 }}
      >
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          style={{
            background: undoTokens === 0 ? '#252525' : '#e5241e',
            color: undoTokens === 0 ? '#3a3a3a' : '#fff',
            border: 'none',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 8.5,
            fontWeight: 700,
            padding: '5px 14px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: undoTokens === 0 ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          ↶ Undo{undoTokens > 0 ? ` (${undoTokens})` : ''}
        </button>

        <span className="flex-1" />

        <span
          className="truncate text-right"
          style={{ color: '#2a2a2a', fontSize: 7.5, fontFamily: 'ui-monospace, monospace', maxWidth: '60%' }}
        >
          {startPage} › … › {target}
        </span>
      </footer>
    </>
  )
}
