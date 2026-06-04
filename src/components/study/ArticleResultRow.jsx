'use client'
import { useState } from 'react'

export default function ArticleResultRow({ result, article }) {
  const [open, setOpen] = useState(false)
  const accuracy = result.correctCount / Math.max(1, result.correctCount + result.wrongCount)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{article?.title ?? 'Article'}</p>
          <p className="text-xs text-zinc-500">
            {result.correctCount} found · {result.wrongCount} wrong · {result.timeTaken}s
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`text-sm font-bold ${accuracy >= 0.8 ? 'text-green-400' : accuracy >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {Math.round(accuracy * 100)}%
          </div>
          <div className="text-xs font-mono text-white">+{result.score}</div>
          <div className={`text-zinc-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</div>
        </div>
      </button>
    </div>
  )
}
