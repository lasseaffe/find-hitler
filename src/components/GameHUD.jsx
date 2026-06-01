'use client'

export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo }) {
  return (
    <>
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/85 backdrop-blur border border-black/10 rounded-full px-5 py-2 shadow text-sm font-black tracking-wide whitespace-nowrap">
        <span className="text-gray-700">{startPage}</span>
        <span className="text-gray-400 text-base">──→</span>
        <span className="text-red-600 italic">{target}</span>
      </div>

      <div className="fixed top-3 right-3 z-50 w-48">
        <div className="bg-[#1a1a2e] border-2 border-red-500 rounded-lg p-3 font-mono text-white">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Clicks</span>
            <span className="text-xl font-bold text-yellow-400">{clicks}</span>
          </div>
          <hr className="border-[#2a2a3e] my-1" />
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Mode</span>
            <span className="text-[10px] text-yellow-400 uppercase">{mode}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-5 z-50 flex flex-col items-center gap-2">
        <span className="text-[9px] text-gray-400 uppercase tracking-wide font-mono">Undo Tokens</span>
        <div className="flex gap-1.5">
          {[2, 1, 0].map(i => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i < undoTokens
                  ? 'bg-yellow-400 shadow-[0_0_6px_rgba(241,196,15,0.6)]'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          className="w-14 h-14 rounded-full bg-red-600 text-white text-xl shadow-[0_4px_18px_rgba(192,57,43,0.5)] hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩
        </button>
      </div>
    </>
  )
}
