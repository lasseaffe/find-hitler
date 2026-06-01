'use client'
import { RedButton } from '@/components/ui/primitives'

export default function MultiWinScreen({ finishers, myId, target, onPlayAgain, onViewResults }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/85 px-4">
      <div className="w-full max-w-md border-4 border-ink bg-paper">
        <div className="border-b-4 border-ink bg-ink px-5 py-3 text-center text-paper">
          <div className="font-display text-2xl uppercase tracking-wide">Race Over</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-red">{target}</div>
        </div>

        <div className="border-b-4 border-ink">
          {finishers.map((f, i) => (
            <div key={f.playerId} className={`flex items-center gap-3 px-4 py-2.5 font-mono text-xs ${i > 0 ? 'border-t-2 border-ink' : ''} ${f.playerId === myId ? 'border-l-[6px] border-l-red bg-red/10' : ''}`}>
              <span className="w-5 text-right font-display">{i + 1}</span>
              <span className="flex-1 truncate font-display uppercase text-[13px]">{f.name}{f.playerId === myId ? ' (you)' : ''}</span>
              <span>{f.clicks} clk</span>
              <span className="text-ink/50">{f.seconds}s</span>
            </div>
          ))}
        </div>

        <RedButton onClick={onPlayAgain}>Play Again</RedButton>
        {onViewResults && (
          <button onClick={onViewResults} className="block w-full border-t-4 border-ink py-2.5 text-center font-display uppercase tracking-wide text-sm hover:bg-paper-dim cursor-pointer">
            View Results →
          </button>
        )}
      </div>
    </div>
  )
}
