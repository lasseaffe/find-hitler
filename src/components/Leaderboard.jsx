'use client'

export default function Leaderboard({ entries }) {
  if (!entries.length) {
    return (
      <div className="text-center py-20 text-gray-500 font-mono">
        No races recorded yet. Play a game to get on the board.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="text-yellow-400 border-b border-yellow-400/20 text-left">
            <th className="py-2 pr-4 w-8">#</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Target</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4">Clicks</th>
            <th className="py-2 pr-4">Time</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={i}
              className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e]/50 transition-colors"
            >
              <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
              <td className="py-2 pr-4 text-white font-bold">{e.playerName}</td>
              <td className="py-2 pr-4 text-red-400">{e.target}</td>
              <td className="py-2 pr-4 text-gray-400 capitalize">{e.mode}</td>
              <td className="py-2 pr-4 text-yellow-400">{e.clicks}</td>
              <td className="py-2 pr-4 text-gray-400">{e.time != null ? `${e.time}s` : '—'}</td>
              <td className="py-2 pr-4 text-green-400">{e.score?.toLocaleString() ?? '—'}</td>
              <td className="py-2 text-gray-500">{e.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
