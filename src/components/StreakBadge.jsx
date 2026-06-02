export default function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#f59e0b]">
      🔥 {streak}-day streak
    </span>
  )
}
