'use client'
import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import HitlerMark from '@/components/ui/HitlerMark'
import { RedButton } from '@/components/ui/primitives'

// Horizontal animated flowchart node
function FlowNode({ label, target, delay }) {
  if (target) {
    return (
      <div
        className="flex flex-none items-center gap-2 bg-ink px-3 py-2 text-paper"
        style={{ animation: `fh-node-in 0.3s both, fh-target-flash 0.5s 1`, animationDelay: `${delay}s, ${delay}s` }}
      >
        <HitlerMark size={22} fill="var(--color-paper)" />
        <span className="font-display uppercase text-sm tracking-wide">{label}</span>
      </div>
    )
  }
  return (
    <div
      className="flex-none border-[3px] border-ink bg-paper px-3 py-2 font-display uppercase text-[13px] whitespace-nowrap"
      style={{ animation: 'fh-node-in 0.26s both', animationDelay: `${delay}s` }}
    >
      {label}
    </div>
  )
}

function Connector({ delay }) {
  return (
    <div className="flex flex-none items-center" aria-hidden>
      <span className="block h-1 w-5 origin-left bg-ink" style={{ animation: 'fh-line-in 0.14s both', animationDelay: `${delay}s` }} />
      <span
        className="block h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-ink"
        style={{ animation: 'fh-node-in 0.12s both', animationDelay: `${delay + 0.05}s` }}
      />
    </div>
  )
}

function HeroFlow({ path, replayKey }) {
  const steps = path.length ? path : ['—']
  return (
    <div key={replayKey} className="flex items-center overflow-x-auto px-4 py-6">
      {steps.map((node, i) => {
        const isTarget = i === steps.length - 1
        const delay = i * 0.46
        return (
          <Fragment key={i}>
            {i > 0 && <Connector delay={delay - 0.18} />}
            <FlowNode label={node} target={isTarget} delay={delay} />
          </Fragment>
        )
      })}
    </div>
  )
}

// One racer's path as a compact horizontal chain (scrolls sideways on mobile)
function RacerRow({ rank, finisher }) {
  const path = finisher.path || []
  return (
    <div className={`flex items-center gap-3 border-b-2 border-ink px-3 py-2 ${finisher.isMe ? 'border-l-[6px] border-l-red bg-red/10' : ''}`}>
      <div className="w-28 flex-none font-display uppercase text-[13px]">
        <span className={finisher.isMe ? 'text-red' : ''}>{String(rank).padStart(2, '0')}</span> · {finisher.name}
        {finisher.isMe && <span className="ml-1 font-mono text-[8px]">(YOU)</span>}
      </div>
      <div className="flex flex-1 items-center gap-0 overflow-x-auto font-mono text-[9px]">
        {path.length === 0 && <span className="text-ink/40">—</span>}
        {path.map((n, i) => {
          const last = i === path.length - 1
          return (
            <Fragment key={i}>
              <span className={`flex-none border-2 border-ink px-1.5 py-0.5 whitespace-nowrap ${last ? 'bg-ink text-paper' : 'bg-paper'}`}>{n}</span>
              {!last && <span className="flex-none px-1 text-ink/60">›</span>}
            </Fragment>
          )
        })}
      </div>
      <div className="w-16 flex-none text-right font-mono text-[10px]">
        {finisher.clicks}{finisher.time != null ? `·${finisher.time}s` : ''}
      </div>
    </div>
  )
}

export default function ResultsScreen({ results }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [replayKey, setReplayKey] = useState(0)

  const me = results.finishers.find(f => f.isMe) || results.finishers[0]

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(me?.path?.join(' → ') || '')
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  const handleShare = async () => {
    const lines = [
      `FIND HITLER — ${results.target}`,
      ...results.finishers.map((f, i) => `${String(i + 1).padStart(2, '0')} ${f.name}: ${f.clicks} clicks${f.time != null ? ` · ${f.time}s` : ''}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-8">
      <main className="mx-auto max-w-2xl border-4 border-ink bg-paper">
        {/* header */}
        <div className="flex items-center justify-between bg-ink px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
          <span>Result · Your Path</span>
          <span className="text-red">{me?.clicks} clicks{me?.time != null ? ` · ${me.time}s` : ''} · 1st</span>
        </div>

        {/* animated flowchart */}
        <HeroFlow path={me?.path || []} replayKey={replayKey} />
        <button
          onClick={() => setReplayKey(k => k + 1)}
          className="block w-full border-y-4 border-ink py-2.5 text-center font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer"
        >
          ▶ Replay Path
        </button>

        {/* all racers */}
        <div className="flex items-center justify-between bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
          <span>All Racers · {results.finishers.length}</span>
          <span className="opacity-60">Scroll ↓ · Swipe →</span>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {results.finishers.map((f, i) => <RacerRow key={i} rank={i + 1} finisher={f} />)}
        </div>

        {/* actions */}
        <div className="grid grid-cols-2 gap-[3px] border-t-4 border-ink bg-ink">
          <button onClick={handleCopyPath} className="bg-paper py-3 font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer">
            {copied ? 'Copied ✓' : 'Copy Path'}
          </button>
          <button onClick={handleShare} className="bg-paper py-3 font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer">
            {shared ? 'Copied ✓' : 'Share'}
          </button>
        </div>
        <RedButton onClick={() => router.push('/')}>Play Again →</RedButton>
      </main>
    </div>
  )
}
