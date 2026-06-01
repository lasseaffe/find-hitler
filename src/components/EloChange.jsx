'use client'
import { useEffect, useState } from 'react'

export default function EloChange({ delta, oldElo, newElo }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const isGain = delta > 0
  return (
    <div
      className={`fixed top-20 right-8 z-50 font-black font-mono text-2xl animate-bounce px-4 py-2 rounded-xl border-2 shadow-lg ${
        isGain
          ? 'text-green-400 border-green-400/40 bg-green-400/10'
          : 'text-red-400 border-red-400/40 bg-red-400/10'
      }`}
    >
      {isGain ? '+' : ''}{delta} ELO
      <div className="text-xs font-normal opacity-70 text-center mt-0.5">
        {oldElo} → {newElo}
      </div>
    </div>
  )
}
