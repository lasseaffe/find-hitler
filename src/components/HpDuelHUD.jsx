'use client'

function HpBar({ hp, maxHp = 5000, name, isMe }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const low = hp < 1500
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span className={`truncate font-display text-xs ${isMe ? 'text-red' : 'text-paper'}`}>{name}{isMe ? ' (you)' : ''}</span>
        <span className="text-paper/60">{hp.toLocaleString()} HP</span>
      </div>
      <div className="h-3.5 border-2 border-paper/40 bg-ink">
        <div className={`h-full transition-[width] duration-500 ${low ? 'bg-red' : 'bg-paper'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function HpDuelHUD({ duelPlayers, myId, round }) {
  const entries = Object.entries(duelPlayers || {})
  if (entries.length === 0) return null
  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b-4 border-ink bg-ink px-4 py-3 pt-safe text-paper">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">
          ⚔ Ranked Duel · Round {round || 1}
        </div>
        <div className="flex items-center gap-4">
          {entries.map(([id, player]) => (
            <HpBar key={id} hp={player.hp} name={player.name} isMe={id === myId} />
          ))}
        </div>
      </div>
    </div>
  )
}
