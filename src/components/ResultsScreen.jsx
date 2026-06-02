'use client'
import { Fragment, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import HitlerMark from '@/components/ui/HitlerMark'
import { RedButton } from '@/components/ui/primitives'
import { getEntries } from '@/lib/leaderboard'

// ── Path overlap helpers ────────────────────────────────────────────
// Returns a map of "A|B" → fraction of stored runs (same target) that used that edge
function computeEdgeOverlap(path, target, mode) {
  if (!path || path.length < 2) return {}
  const entries = getEntries()
  const sameTarget = entries.filter(e => e.target === target && e.path && e.path.length >= 2)
  if (sameTarget.length === 0) return {}
  const total = sameTarget.length
  const counts = {}
  for (const entry of sameTarget) {
    for (let i = 0; i < entry.path.length - 1; i++) {
      const key = `${entry.path[i]}|${entry.path[i + 1]}`
      counts[key] = (counts[key] || 0) + 1
    }
  }
  const result = {}
  for (let i = 0; i < path.length - 1; i++) {
    const key = `${path[i]}|${path[i + 1]}`
    result[key] = Math.round(((counts[key] || 0) / total) * 100)
  }
  return result
}

function getPersonalBest(target, mode) {
  const entries = getEntries({ mode })
  const forTarget = entries.filter(e => e.target === target)
  if (forTarget.length === 0) return null
  // Best = fewest clicks, then fastest time
  return forTarget.reduce((best, e) => {
    if (e.clicks < best.clicks) return e
    if (e.clicks === best.clicks && e.time != null && (best.time == null || e.time < best.time)) return e
    return best
  })
}

// ── Flow chart (no scrolling — wraps into rows if needed) ────────────
function FlowNode({ label, target, delay, timeLabel }) {
  return (
    <div className="flex flex-col items-center" style={{ animationDelay: `${delay}s` }}>
      {target ? (
        <div
          className="flex items-center gap-2 bg-ink px-3 py-2 text-paper"
          style={{ animation: `fh-node-in 0.3s both, fh-target-flash 0.5s 1`, animationDelay: `${delay}s, ${delay}s` }}
        >
          <HitlerMark size={20} fill="var(--color-paper)" />
          <span className="font-display uppercase text-sm tracking-wide">{label}</span>
        </div>
      ) : (
        <div
          className="flex-none border-[3px] border-ink bg-paper px-3 py-2 font-display uppercase text-[13px] whitespace-nowrap"
          style={{ animation: 'fh-node-in 0.26s both', animationDelay: `${delay}s` }}
        >
          {label}
        </div>
      )}
      {timeLabel && (
        <span style={{ color: '#888', fontSize: 8, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>
          {timeLabel}
        </span>
      )}
    </div>
  )
}

function Connector({ delay, overlapPct }) {
  return (
    <div className="flex flex-col items-center flex-none" style={{ minWidth: 32 }}>
      <div className="flex items-center" aria-hidden>
        <span className="block h-1 w-5 origin-left bg-ink" style={{ animation: 'fh-line-in 0.14s both', animationDelay: `${delay}s` }} />
        <span
          className="block h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-ink"
          style={{ animation: 'fh-node-in 0.12s both', animationDelay: `${delay + 0.05}s` }}
        />
      </div>
      {overlapPct != null && (
        <span style={{ color: overlapPct >= 50 ? '#2563eb' : overlapPct >= 20 ? '#fbbf24' : '#555', fontSize: 7, fontFamily: 'ui-monospace, monospace', marginTop: 2, whiteSpace: 'nowrap' }}>
          {overlapPct}%
        </span>
      )}
    </div>
  )
}

function HeroFlow({ path, nodeTimes, edgeOverlap, replayKey }) {
  const steps = path.length ? path : ['—']

  // Compute per-node duration labels (time spent on each page before moving)
  const durationLabels = steps.map((_, i) => {
    if (!nodeTimes || nodeTimes.length < steps.length) return null
    const arrivalThis = nodeTimes[i] ?? null
    const arrivalNext = nodeTimes[i + 1] ?? null
    if (arrivalThis == null) return null
    if (i === 0) return `@${arrivalThis}s`
    if (arrivalNext != null) {
      const spent = arrivalNext - arrivalThis
      return `${spent}s`
    }
    return `@${arrivalThis}s`
  })

  return (
    <div key={replayKey} className="flex flex-wrap items-start justify-center gap-y-3 px-4 py-6">
      {steps.map((node, i) => {
        const isTarget = i === steps.length - 1
        const delay = i * 0.38
        const edgeKey = i < steps.length - 1 ? `${steps[i]}|${steps[i + 1]}` : null
        const overlapPct = edgeKey ? (edgeOverlap[edgeKey] ?? null) : null
        return (
          <Fragment key={i}>
            {i > 0 && <Connector delay={delay - 0.14} overlapPct={overlapPct} />}
            <FlowNode
              label={node}
              target={isTarget}
              delay={delay}
              timeLabel={durationLabels[i]}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

// Compact racer row for leaderboard section
function RacerRow({ rank, finisher }) {
  const path = finisher.path || []
  return (
    <div className={`flex items-start gap-3 border-b-2 border-ink px-3 py-2.5 ${finisher.isMe ? 'border-l-[6px] border-l-red bg-red/10' : ''}`}>
      <div className="w-28 flex-none font-display uppercase text-[13px] pt-0.5">
        <span className={finisher.isMe ? 'text-red' : ''}>{String(rank).padStart(2, '0')}</span> · {finisher.name}
        {finisher.isMe && <span className="ml-1 font-mono text-[8px]">(YOU)</span>}
      </div>
      {/* Path: wrapping chips, not a horizontal scroll */}
      <div className="flex flex-1 flex-wrap items-center gap-1 font-mono text-[9px]">
        {path.length === 0 && <span className="text-ink/40">—</span>}
        {path.map((n, i) => {
          const last = i === path.length - 1
          return (
            <Fragment key={i}>
              <span className={`border-2 border-ink px-1.5 py-0.5 whitespace-nowrap ${last ? 'bg-ink text-paper' : 'bg-paper'}`}>{n}</span>
              {!last && <span className="text-ink/40">›</span>}
            </Fragment>
          )
        })}
      </div>
      <div className="flex-none text-right font-mono text-[10px] pt-0.5 min-w-[56px]">
        <div className="text-ink">{finisher.clicks}cl</div>
        {finisher.time != null && <div className="text-ink/60">{finisher.time}s</div>}
      </div>
    </div>
  )
}

// ── Share card canvas generator ─────────────────────────────────────
async function buildShareImage({ path, clicks, time, target, personalBest }) {
  const W = 1200, H = 630
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0e0e0e'
  ctx.fillRect(0, 0, W, H)

  // Red accent bar top
  ctx.fillStyle = '#2563eb'
  ctx.fillRect(0, 0, W, 8)

  // Red accent bar bottom
  ctx.fillRect(0, H - 8, W, 8)

  // Title
  ctx.fillStyle = '#f5f0e8'
  ctx.font = 'bold 56px Impact, Arial Black, sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText('FIND HITLER', 60, 100)

  // Target badge
  ctx.fillStyle = '#2563eb'
  const targetText = `TARGET: ${target.toUpperCase()}`
  ctx.font = 'bold 22px ui-monospace, monospace'
  const tw = ctx.measureText(targetText).width
  ctx.fillRect(58, 118, tw + 24, 38)
  ctx.fillStyle = '#fff'
  ctx.fillText(targetText, 70, 143)

  // Stats row
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 48px ui-monospace, monospace'
  ctx.fillText(`${clicks} clicks`, 60, 240)
  if (time != null) {
    ctx.fillStyle = '#888'
    ctx.font = '36px ui-monospace, monospace'
    ctx.fillText(`${time}s`, 60 + ctx.measureText(`${clicks} clicks`).width + 20, 240)
  }

  // Path
  ctx.fillStyle = '#555'
  ctx.font = '16px ui-monospace, monospace'
  ctx.fillText('YOUR PATH', 60, 290)

  ctx.fillStyle = '#f5f0e8'
  ctx.font = '20px ui-monospace, monospace'
  const pathStr = (path || []).join(' → ')
  // Wrap path text at ~1080px
  const maxWidth = W - 120
  let pathLine = ''
  let pathY = 318
  for (const word of pathStr.split(' ')) {
    const test = pathLine ? pathLine + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && pathLine) {
      ctx.fillText(pathLine, 60, pathY)
      pathLine = word
      pathY += 28
    } else {
      pathLine = test
    }
  }
  if (pathLine) ctx.fillText(pathLine, 60, pathY)

  // Personal best comparison
  if (personalBest && personalBest.clicks <= clicks) {
    pathY += 50
    ctx.fillStyle = '#3a3a3a'
    ctx.font = '15px ui-monospace, monospace'
    ctx.fillText(`Personal best: ${personalBest.clicks} clicks${personalBest.time != null ? ` · ${personalBest.time}s` : ''} (${personalBest.clicks < clicks ? `${clicks - personalBest.clicks} fewer` : 'tied'})`, 60, pathY)
  }

  // Branding
  ctx.fillStyle = '#333'
  ctx.font = '14px ui-monospace, monospace'
  ctx.fillText('Find Hitler — wikipedia navigation game', 60, H - 30)

  return canvas.toDataURL('image/png')
}

// ── Main component ───────────────────────────────────────────────────
export default function ResultsScreen({ results }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [shareState, setShareState] = useState('idle') // idle | building | done | error
  const [replayKey, setReplayKey] = useState(0)
  const [edgeOverlap, setEdgeOverlap] = useState({})
  const [personalBest, setPersonalBest] = useState(null)
  const [challengeLink, setChallengeLink] = useState(null)

  const me = results.finishers.find(f => f.isMe) || results.finishers[0]

  useEffect(() => {
    // Compute overlap and personal best client-side (localStorage)
    setEdgeOverlap(computeEdgeOverlap(me?.path, results.target, results.mode))
    setPersonalBest(getPersonalBest(results.target, results.mode))
  }, [me, results.target, results.mode])

  const myRank = results.finishers.findIndex(f => f.isMe) + 1 || 1
  const rankLabel = myRank === 1 ? '1ST' : myRank === 2 ? '2ND' : myRank === 3 ? '3RD' : `${myRank}TH`
  const isPB = personalBest && me?.clicks != null && me.clicks <= personalBest.clicks

  const handleCopyPath = async () => {
    try {
      const pathStr = me?.path?.join(' → ') || ''
      const text = `FIND HITLER — ${results.target}\n${me?.clicks} clicks · ${me?.time ?? '?'}s\n${pathStr}`
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  const handleShare = async () => {
    setShareState('building')
    try {
      const dataUrl = await buildShareImage({
        path: me?.path,
        clicks: me?.clicks,
        time: me?.time,
        target: results.target,
        personalBest,
      })
      // Try native share with image file first
      if (navigator.canShare) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], 'find-hitler-result.png', { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Find Hitler — ${results.target}`,
            text: `I found Hitler in ${me?.clicks} clicks (${me?.time}s)! Can you beat it?`,
            files: [file],
          })
          setShareState('done'); setTimeout(() => setShareState('idle'), 3000)
          return
        }
      }
      // Fallback: download the image
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'find-hitler-result.png'
      a.click()
      setShareState('done'); setTimeout(() => setShareState('idle'), 3000)
    } catch (err) {
      console.error('Share failed:', err)
      setShareState('error'); setTimeout(() => setShareState('idle'), 3000)
    }
  }

  const handleChallenge = async () => {
    if (!me) return
    try {
      const res = await fetch('/api/challenge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: results.target,
          mode: results.mode,
          startPage: me.path?.[0] ?? '',
          creatorScore: me.score ?? 0,
          creatorPath: me.path ?? [],
          creatorClicks: me.clicks ?? 0,
          creatorSeconds: me.time ?? 0,
        }),
      })
      const { token } = await res.json()
      const url = `${window.location.origin}/challenge/${token}`
      await navigator.clipboard.writeText(url).catch(() => {})
      setChallengeLink(url)
    } catch { /* non-fatal */ }
  }

  const shareLabel = { idle: 'Share Result', building: 'Generating…', done: 'Image Saved ✓', error: 'Failed' }[shareState]

  return (
    <div className="min-h-screen bg-paper px-2 py-6 sm:px-6 sm:py-10">
      <main className="mx-auto border-4 border-ink bg-paper" style={{ maxWidth: 860 }}>

        {/* ── Header bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
          <span>Result · Your Path</span>
          <span className="text-red font-bold">
            {me?.clicks} clicks
            {me?.time != null ? ` · ${me.time}s` : ''}
            {results.finishers.length > 1 && ` · ${rankLabel}`}
          </span>
        </div>

        {/* ── Personal best banner ── */}
        {personalBest && (
          <div
            className="flex items-center justify-between px-4 py-2 font-mono text-[9px] uppercase tracking-widest"
            style={{ background: isPB ? '#1a1a00' : '#111', borderBottom: '1px solid #222', color: isPB ? '#fbbf24' : '#444' }}
          >
            <span>Personal best: {personalBest.clicks} clicks{personalBest.time != null ? ` · ${personalBest.time}s` : ''}</span>
            <span>{isPB ? '★ NEW BEST' : me?.clicks != null ? `+${me.clicks - personalBest.clicks} from best` : ''}</span>
          </div>
        )}

        {/* ── Animated path flowchart (non-scrolling, wraps) ── */}
        <HeroFlow
          path={me?.path || []}
          nodeTimes={me?.nodeTimes}
          edgeOverlap={edgeOverlap}
          replayKey={replayKey}
        />

        {/* Overlap legend */}
        {Object.keys(edgeOverlap).length > 0 && (
          <div className="px-4 pb-2 font-mono text-[8px] uppercase tracking-widest" style={{ color: '#555' }}>
            % = share of your runs using that link · <span style={{ color: '#fbbf24' }}>yellow ≥ 20%</span> · <span style={{ color: '#2563eb' }}>red ≥ 50%</span>
          </div>
        )}

        <button
          onClick={() => setReplayKey(k => k + 1)}
          className="block w-full border-y-4 border-ink py-2.5 text-center font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer"
        >
          ▶ Replay Path
        </button>

        {/* ── Detailed path stats ── */}
        {me?.nodeTimes && me.path && me.path.length > 1 && (
          <div style={{ background: '#0e0e0e', borderBottom: '3px solid #181818' }}>
            <div className="px-4 py-2 font-mono text-[9px] uppercase tracking-widest" style={{ color: '#444' }}>
              Time per page
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[9px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    <th className="px-4 py-1.5 text-left" style={{ color: '#333', fontWeight: 400 }}>#</th>
                    <th className="px-4 py-1.5 text-left" style={{ color: '#333', fontWeight: 400 }}>Page</th>
                    <th className="px-4 py-1.5 text-right" style={{ color: '#333', fontWeight: 400 }}>Arrived</th>
                    <th className="px-4 py-1.5 text-right" style={{ color: '#333', fontWeight: 400 }}>Spent</th>
                    <th className="px-4 py-1.5 text-right" style={{ color: '#333', fontWeight: 400 }}>Edge pop.</th>
                  </tr>
                </thead>
                <tbody>
                  {me.path.map((page, i) => {
                    const arrived = me.nodeTimes[i] ?? null
                    const next = me.nodeTimes[i + 1] ?? null
                    const spent = arrived != null && next != null ? next - arrived : null
                    const edgeKey = i < me.path.length - 1 ? `${me.path[i]}|${me.path[i + 1]}` : null
                    const overlap = edgeKey ? (edgeOverlap[edgeKey] ?? null) : null
                    const isLast = i === me.path.length - 1
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1a1a1a', background: isLast ? '#1a0000' : 'transparent' }}>
                        <td className="px-4 py-1.5" style={{ color: '#555' }}>{i + 1}</td>
                        <td className="px-4 py-1.5" style={{ color: isLast ? '#2563eb' : '#f5f0e8', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page}</td>
                        <td className="px-4 py-1.5 text-right" style={{ color: '#666' }}>{arrived != null ? `${arrived}s` : '—'}</td>
                        <td className="px-4 py-1.5 text-right" style={{ color: spent != null && spent <= 5 ? '#fbbf24' : '#555' }}>{spent != null ? `${spent}s` : isLast ? 'finish' : '—'}</td>
                        <td className="px-4 py-1.5 text-right" style={{ color: overlap != null && overlap >= 50 ? '#2563eb' : overlap != null && overlap >= 20 ? '#fbbf24' : '#444' }}>
                          {overlap != null ? `${overlap}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── All racers ── */}
        {results.finishers.length > 1 && (
          <>
            <div className="flex items-center justify-between bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
              <span>All Racers · {results.finishers.length}</span>
            </div>
            <div>
              {results.finishers.map((f, i) => <RacerRow key={i} rank={i + 1} finisher={f} />)}
            </div>
          </>
        )}

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 gap-[3px] border-t-4 border-ink bg-ink">
          <button onClick={handleCopyPath} className="bg-paper py-3 font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer">
            {copied ? 'Copied ✓' : 'Copy Path'}
          </button>
          <button
            onClick={handleShare}
            disabled={shareState === 'building'}
            className="bg-paper py-3 font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer disabled:opacity-50"
          >
            {shareLabel}
          </button>
        </div>

        {/* ── Challenge ── */}
        <div className="flex flex-col items-center gap-1 border-t-4 border-ink px-4 py-4">
          <button
            onClick={handleChallenge}
            className="border-[3px] border-[#2563eb] text-[#2563eb] px-4 py-2 font-mono text-xs uppercase tracking-wide hover:bg-[#2563eb] hover:text-paper"
          >
            Challenge a Friend →
          </button>
          {challengeLink && (
            <p className="font-mono text-[9px] text-ink/60 mt-1">Link copied! {challengeLink}</p>
          )}
        </div>

        <RedButton onClick={() => router.push('/')}>Play Again →</RedButton>
      </main>
    </div>
  )
}
