// bests shape: { classic: {clicks, seconds, score}, speedrun: {seconds}, golf: {clicks}, ... }
export default function PersonalBest({ mode, bests }) {
  if (!bests || !bests[mode]) return null
  const b = bests[mode]

  const display =
    mode === 'speedrun'     ? `${b.seconds}s`            :
    mode === 'golf'         ? `${b.clicks} clicks`        :
    mode === 'fact-checker' ? `${b.score} pts`            :
                              `${b.clicks} clicks · ${b.seconds}s`

  return (
    <p className="text-[10px] font-mono text-[#64748b] mt-1">
      PB: <span className="text-[#94a3b8]">{display}</span>
    </p>
  )
}
