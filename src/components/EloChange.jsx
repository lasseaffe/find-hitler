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
    <div className={`fixed right-6 top-24 z-50 border-[3px] px-4 py-2 text-center ${isGain ? 'border-ink bg-paper text-ink' : 'border-red bg-red text-paper'}`}>
      <div className="font-display text-2xl leading-none">
        {isGain ? '+' : ''}{delta} <span className="text-base">ELO</span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide opacity-70">{oldElo} → {newElo}</div>
    </div>
  )
}
