'use client'

export default function WinScreen({ score, clicks, time, target, onPlayAgain }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-10 text-center max-w-sm w-full shadow-[0_0_40px_rgba(241,196,15,0.25)]">
        <div className="text-yellow-400 text-4xl font-black mb-1 tracking-tight">
          TARGET REACHED
        </div>
        <div className="text-red-400 text-lg italic mb-6">{target}</div>
        <div className="space-y-2 font-mono text-white mb-8 text-left">
          <div className="flex justify-between border-b border-[#2a2a3e] pb-2">
            <span className="text-gray-400 text-sm">Clicks</span>
            <span className="text-yellow-400 text-lg font-bold">{clicks}</span>
          </div>
          <div className="flex justify-between border-b border-[#2a2a3e] pb-2">
            <span className="text-gray-400 text-sm">Time</span>
            <span className="text-yellow-400 text-lg font-bold">{time}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Score</span>
            <span className="text-yellow-400 text-xl font-bold">{score.toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 text-white font-black rounded-lg text-base hover:bg-red-500 transition-colors uppercase tracking-wide"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
