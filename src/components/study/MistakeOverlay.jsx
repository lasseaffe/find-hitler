'use client'

export default function MistakeOverlay({ result, onNext, onReview, isLast }) {
  const { score, correctCount, wrongCount, missedMistakes = [] } = result

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-lg font-bold text-white">+{score} pts</p>
            <p className="text-xs text-zinc-400">
              {correctCount} found · {wrongCount} wrong
              {missedMistakes.length > 0 && ` · ${missedMistakes.length} missed`}
            </p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: correctCount }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-green-500" />
            ))}
            {Array.from({ length: missedMistakes.length }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-red-600" />
            ))}
          </div>
        </div>

        {missedMistakes.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {missedMistakes.map((m, i) => (
              <div key={i} className="bg-zinc-950 border-l-2 border-red-600 px-3 py-2 rounded-r">
                <p className="text-xs text-zinc-300">
                  <span className="line-through text-red-400 mr-1">{m.span}</span>
                  → <span className="text-green-400">{m.correct}</span>
                </p>
                {m.explanation && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 italic">{m.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onReview}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2.5 rounded-lg"
          >
            Review article
          </button>
          <button
            onClick={onNext}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2.5 rounded-lg font-medium"
          >
            {isLast ? 'See results →' : 'Next article →'}
          </button>
        </div>
      </div>
    </div>
  )
}
