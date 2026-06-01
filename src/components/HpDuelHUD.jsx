'use client'

function HpBar({ hp, maxHp = 5000, name, isMe, color }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const barColor = hp < 1000 ? '#e74c3c' : hp < 2500 ? '#e67e22' : color

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-1">
        <span className={`font-mono text-xs font-bold uppercase tracking-widest ${isMe ? 'text-yellow-400' : 'text-gray-300'}`}>
          {name}{isMe ? ' (you)' : ''}
        </span>
        <span className="font-mono text-xs text-gray-400">{hp.toLocaleString()} HP</span>
      </div>
      <div className="h-3 bg-[#1a1a2e] rounded-full overflow-hidden border border-gray-700">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

export default function HpDuelHUD({ duelPlayers, myId, round }) {
  const playerEntries = Object.entries(duelPlayers || {})
  if (playerEntries.length === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0d1117]/95 border-b border-yellow-400/20 px-4 py-3">
      <div className="max-w-2xl mx-auto">
        <div className="text-center font-mono text-xs text-yellow-400/60 uppercase tracking-widest mb-2">
          ⚔ Ranked Duel · Round {round || 1}
        </div>
        <div className="flex gap-4 items-center">
          {playerEntries.map(([id, player]) => (
            <HpBar
              key={id}
              hp={player.hp}
              name={player.name}
              isMe={id === myId}
              color={id === myId ? '#2ecc71' : '#e74c3c'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
