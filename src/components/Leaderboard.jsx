'use client'

export default function Leaderboard({ entries }) {
  if (!entries.length) {
    return (
      <div className="border-4 border-ink bg-paper px-6 py-16 text-center">
        <p className="font-display text-xl uppercase">No races recorded</p>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/60">
          Play a game to get on the board
        </p>
        <a href="/" className="mt-5 inline-block bg-red px-5 py-2.5 font-display uppercase tracking-wide text-sm text-paper">Start Race →</a>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-4 border-ink">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr className="bg-ink text-left uppercase tracking-widest text-paper">
            <th className="w-8 px-3 py-2.5">#</th>
            <th className="px-3 py-2.5">Player</th>
            <th className="px-3 py-2.5">Target</th>
            <th className="px-3 py-2.5">Mode</th>
            <th className="px-3 py-2.5">Clk</th>
            <th className="px-3 py-2.5">Time</th>
            <th className="px-3 py-2.5">Score</th>
            <th className="px-3 py-2.5">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const top = i === 0
            return (
              <tr key={i} className={`border-t-2 border-ink ${top ? 'bg-ink text-paper' : 'bg-paper'}`}>
                <td className={`px-3 py-2 font-display ${top ? 'text-red' : ''}`}>{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2 font-display uppercase">{e.playerName}</td>
                <td className={`px-3 py-2 ${top ? 'text-paper' : 'text-red'}`}>{e.target}</td>
                <td className="px-3 py-2 uppercase opacity-70">{e.mode}</td>
                <td className="px-3 py-2">{e.clicks}</td>
                <td className="px-3 py-2 opacity-70">{e.time != null ? `${e.time}s` : '—'}</td>
                <td className="px-3 py-2">{e.score?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2 opacity-50">{e.date}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
