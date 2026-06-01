// src/components/DamageOverlay.jsx
'use client'
import { useEffect, useState } from 'react'

// trigger: { damage, timestamp } — a new object reference fires the effect
// hp / maxHp: used to scale intensity
export default function DamageOverlay({ trigger, hp, maxHp = 5000 }) {
  const [active, setActive] = useState(false)
  const [intensity, setIntensity] = useState('normal') // normal | medium | hard

  useEffect(() => {
    if (!trigger) return
    const ratio = hp / maxHp
    const lvl = ratio < 0.25 ? 'hard' : ratio < 0.5 ? 'medium' : 'normal'
    setIntensity(lvl)
    setActive(true)
    const t = setTimeout(() => setActive(false), 700)
    return () => clearTimeout(t)
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  const washOpacity = { normal: 0.35, medium: 0.50, hard: 0.65 }[intensity]
  const shakeAnim = {
    normal: 'fh-chroma-shake 0.5s ease-out',
    medium: 'fh-chroma-shake-med 0.5s ease-out',
    hard:   'fh-chroma-shake-hard 0.5s ease-out',
  }[intensity]
  const blur = intensity === 'hard' ? 'blur(1px)' : 'none'

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 39 }}>
      {/* Red wash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(200,0,0,${washOpacity})`,
        animation: 'fh-overlay-fade 0.6s ease-out forwards',
      }} />
      {/* Chromatic R bleed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(255,0,0,0.12)',
        transform: 'translateX(3px)',
        animation: 'fh-overlay-fade 0.5s ease-out forwards',
        mixBlendMode: 'screen',
      }} />
      {/* Chromatic B bleed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,255,0.08)',
        transform: 'translateX(-3px)',
        animation: 'fh-overlay-fade 0.5s ease-out forwards',
        mixBlendMode: 'screen',
      }} />
      {/* Shake wrapper */}
      <div style={{
        position: 'absolute', inset: 0,
        animation: shakeAnim,
        filter: blur,
        pointerEvents: 'none',
      }} />
    </div>
  )
}
