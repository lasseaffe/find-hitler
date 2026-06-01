'use client'

// Win reveal. Universal stamp — plays for EVERY target. Beats:
// snap-in (clean mark) -> FOUND/HIM appears in the 'stache -> scream mouth snaps
// open and the mark SLIDES down the glass (ease-in, smear, shudder) -> FALLS out
// the bottom -> onDone() reveals the results behind. Scream SFX on the slide.

import { useEffect, useRef, useState } from 'react'
import HitlerMark from '../ui/HitlerMark'
import { scream } from '../../lib/sfx'

export default function WinReveal({ onDone }) {
  const [phase, setPhase] = useState('snap') // snap -> text -> scream -> fall
  const timers = useRef([])
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // run once — immune to parent re-renders changing onDone's identity
  useEffect(() => {
    const T = (fn, ms) => timers.current.push(setTimeout(fn, ms))
    T(() => setPhase('text'), 380)
    T(() => { setPhase('scream'); scream() }, 1150)
    T(() => setPhase('fall'), 1850)
    T(() => onDoneRef.current?.(), 2400)
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [])

  const sliding = phase === 'scream' || phase === 'fall'
  const showText = phase !== 'snap'
  const mouth = sliding ? 'open' : 'none'

  // outer wrapper owns the vertical slide; inner owns the snap scale — no transform clash
  const translateY =
    phase === 'fall' ? '135vh' : phase === 'scream' ? '34vh' : '0'
  const slideTransition =
    phase === 'fall'
      ? 'transform 0.55s cubic-bezier(0.5,0,1,1)'   // gravity / ease-in
      : phase === 'scream'
        ? 'transform 0.7s cubic-bezier(0.55,0,1,0.45)'
        : 'none'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-paper pt-[12vh]">
      {/* smear trail down the "glass" while sliding */}
      {sliding && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: 'min(46vw,260px)', height: '120vh', background: 'linear-gradient(180deg, transparent, #0e0e0e1a)' }}
        />
      )}

      <div style={{ transform: `translateY(${translateY})`, transition: slideTransition }}>
        <div
          style={{
            animation: phase === 'snap' ? 'fh-snap 0.36s both' : undefined,
          }}
        >
          <div style={{ animation: phase === 'scream' ? 'fh-shudder 0.12s linear 4' : undefined }}>
            <HitlerMark size="min(72vw, 340px)" text={showText} mouth={mouth} title="Found him" />
          </div>
        </div>
      </div>
    </div>
  )
}
