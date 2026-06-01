'use client'

export default function MultiWinScreen({ finishers, myId, target, onPlayAgain, onViewResults }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-8 text-center max-w-md w-full shadow-[0_0_40px_rgba(241,196,15,0.25)]">
        <div className="text-yellow-400 text-3xl font-black mb-1 tracking-tight">RACE OVER</div>
        <div className="text-red-400 italic mb-6">{target}</div>

        <div className="space-y-2 mb-8">
          {finishers.map((f, i) => (
            <div
              key={f.playerId}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg font-mono ${
                f.playerId === myId ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#0d1117]'
              }`}
            >
              <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
              <span className={`flex-1 text-left font-bold ${f.isBot ? 'text-orange-400' : 'text-white'}`}>
                {f.name}{f.playerId === myId ? ' (you)' : ''}
              </span>
              <span className="text-yellow-400">{f.clicks} clicks</span>
              <span className="text-gray-400 text-xs">{f.seconds}s</span>
            </div>
          ))}
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-lg uppercase tracking-wide transition-colors"
        >
          Play Again
        </button>
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="w-full mt-2 py-2 bg-transparent border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-lg uppercase tracking-wide text-sm transition-colors"
          >
            View Results →
          </button>
        )}
      </div>
    </div>
  )
}
