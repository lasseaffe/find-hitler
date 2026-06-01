'use client'

const PAR_COLORS = {
  'Hole-in-One': 'text-yellow-300',
  'Albatross': 'text-yellow-400',
  'Eagle': 'text-green-400',
  'Birdie': 'text-green-300',
  'Par': 'text-blue-400',
  'Bogey': 'text-orange-400',
  'Double Bogey': 'text-red-400',
}

export default function WinScreen({ score, clicks, time, target, mode, parGrade, parDelta, timeUp, onPlayAgain }) {
  const isGolf = mode === 'golf'
  const isJesus = mode === 'jesus'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[1000]">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-8 text-center shadow-[0_0_60px_rgba(241,196,15,0.3)] max-w-sm w-full mx-4">

        {timeUp ? (
          <>
            <div className="text-4xl font-black text-red-400 mb-2">TIME'S UP</div>
            <p className="text-gray-400 font-mono text-sm mb-4">Race ended at {clicks} clicks</p>
          </>
        ) : (
          <>
            <div className="text-5xl font-black text-yellow-400 mb-2">
              {isGolf ? `${score} CLICKS` : isJesus ? parGrade || 'FOUND IT' : 'FOUND IT'}
            </div>
            {isJesus && parGrade && (
              <div className={`text-2xl font-black mb-1 ${PAR_COLORS[parGrade] || 'text-white'}`}>
                {parDelta === 0 ? 'PAR' : parDelta < 0 ? `${parDelta}` : `+${parDelta}`}
              </div>
            )}
            <p className="text-gray-300 font-mono text-sm mb-1">
              {isGolf
                ? `${clicks} clicks · lower is better`
                : `${clicks} clicks · ${time}s`}
            </p>
            {!isGolf && !isJesus && (
              <p className="text-2xl font-black text-yellow-400 mb-2">{score.toLocaleString()} pts</p>
            )}
            <p className="text-gray-500 text-xs font-mono mb-6">Target: {target}</p>
          </>
        )}

        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
