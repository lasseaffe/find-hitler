// src/components/ResultsScreen.jsx
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { buildGraph } from '@/lib/pathGraph'
import { getColor } from '@/lib/resultColors'

// Dynamic import avoids SSR issues with D3 and SVG
const NodeGraph = dynamic(() => import('@/components/NodeGraph'), { ssr: false })

const MEDALS = ['🥇', '🥈', '🥉']

export default function ResultsScreen({ results }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [sharedCopied, setSharedCopied] = useState(false)

  const { nodes, links } = useMemo(() => buildGraph(results.finishers), [results.finishers])
  const me = results.finishers.find(f => f.isMe) || results.finishers[0]

  const handleCopyPath = async () => {
    const text = me?.path?.join(' → ') || ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission denied — silently ignore
    }
  }

  const handleShare = async () => {
    const lines = [
      `🎯 Find Hitler — ${results.target}`,
      ...results.finishers.map((f, i) => {
        const medal = MEDALS[i] || '▪'
        const time = f.time != null ? ` · ${f.time}s` : ''
        return `${medal} ${f.name}: ${f.clicks} clicks${time}`
      }),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setSharedCopied(true)
      setTimeout(() => setSharedCopied(false), 2000)
    } catch {
      // Clipboard permission denied — silently ignore
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <div className="text-center pt-8 pb-4 border-b border-yellow-400/20">
        <div className="text-3xl font-black text-yellow-400 tracking-tight">RACE COMPLETE</div>
        <div className="text-red-400 font-mono text-sm mt-1">Target: {results.target}</div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Node Graph */}
        {nodes.length > 0 && <NodeGraph nodes={nodes} links={links} />}

        {/* Finisher rows */}
        <div className="space-y-2">
          {results.finishers.map((f, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg font-mono text-sm ${
                f.isMe ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#1a1a2e]'
              }`}
            >
              <span className="text-base">{MEDALS[i] || '▪'}</span>
              <span
                className="flex-1 font-bold"
                style={{ color: getColor(i) }}
              >
                {f.name}{f.isMe ? ' (you)' : ''}
              </span>
              <span className="text-yellow-400">{f.clicks} clicks</span>
              {f.time != null && <span className="text-gray-400">{f.time}s</span>}
              {f.score != null && <span className="text-gray-300">{f.score.toLocaleString()} pts</span>}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCopyPath}
            className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Path'}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {sharedCopied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  )
}
