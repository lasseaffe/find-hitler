'use client'

// Game-start crowd intro (~2.4s). Where's-Waldo fake-out:
// flood in -> the mark FLASHES ~1s (red frame) -> whole crowd does a 180° rotateY
// turning their backs (the target's face vanishes with everyone else's) -> all
// identical backs + red-bordered "FIND HIM." -> onDone(). Plays while the start
// page loads behind it. Audio cues fire from the parent's START gesture.

import { useEffect, useRef, useState } from 'react'
import { vocalize, shuffle, start as startSfx } from '../../lib/sfx'

const COUNT = 32          // crowd size (grid wraps; fewer columns on mobile)
const TARGET_INDEX = 13   // which figure is the mark

// plain head + shoulders (front of normals + every back)
function Dome() {
  return (
    <svg viewBox="0 0 40 50" className="h-full w-full">
      <circle cx="20" cy="15" r="11" fill="var(--color-ink)" />
      <path d="M3 50 Q3 28 20 28 Q37 28 37 50 Z" fill="var(--color-ink)" />
    </svg>
  )
}

// the mark as a small head+shoulders figure (front of the target only)
function MarkFigure() {
  return (
    <svg viewBox="0 0 40 50" className="h-full w-full">
      <path
        d="M8 18 C7 8, 14 4, 21 4 C28 4, 33 9, 32 17 C30 13, 26 12, 23 13 C23 10, 20 9, 18 10 C15 11, 12 13, 11 16 C10 17, 9 17, 8 18 Z"
        fill="var(--color-ink)"
      />
      <rect x="17" y="15" width="5" height="6" fill="var(--color-ink)" />
      <path d="M3 50 Q3 28 20 28 Q37 28 37 50 Z" fill="var(--color-ink)" />
    </svg>
  )
}

function Figure({ index, phase, isTarget }) {
  const visible = phase !== 'init'
  const turned = phase === 'turn' || phase === 'hidden'
  const flashing = (phase === 'flash' || phase === 'shuffle') && isTarget
  return (
    <div
      className="relative aspect-[4/5] w-full transition-[opacity,transform] duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? (phase === 'shuffle' ? `scale(0.88) translateY(${index % 2 === 0 ? -4 : 4}px)` : 'none')
          : 'translateY(-8px)',
        transitionDelay: phase === 'flood' ? `${index * 22}ms` : phase === 'shuffle' ? `${index * 8}ms` : '0ms',
      }}
    >
      {/* red flash frame on the target */}
      {flashing && <span className="absolute -inset-1 border-[3px] border-red animate-pulse" />}
      {/* 3D flip container */}
      <div
        className="relative h-full w-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: turned ? 'rotateY(180deg)' : 'none' }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          {isTarget ? <MarkFigure /> : <Dome />}
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <Dome />
        </div>
      </div>
    </div>
  )
}

export default function CrowdIntro({ onDone }) {
  const [phase, setPhase] = useState('init') // init -> flood -> flash -> shuffle -> turn -> hidden
  const [order, setOrder] = useState(() => Array.from({ length: COUNT }, (_, i) => i))
  const timers = useRef([])
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // run the sequence exactly once — immune to parent re-renders (auth/session churn
  // would otherwise change onDone's identity and restart the timers).
  useEffect(() => {
    const T = (fn, ms) => timers.current.push(setTimeout(fn, ms))
    T(() => { setPhase('flood'); vocalize() }, 30)
    T(() => setPhase('flash'), 750)
    // Shuffle: randomize the grid order so the mark's position jumps unpredictably
    T(() => {
      setPhase('shuffle')
      setOrder(o => {
        const shuffled = [...o]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      })
      shuffle()
    }, 1350)
    T(() => { setPhase('turn') }, 1750)
    T(() => { setPhase('hidden'); startSfx() }, 2250)
    T(() => onDoneRef.current?.(), 2650)
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper pt-safe pb-safe">
      <div className="w-full max-w-3xl px-5">
        <div
          className="grid gap-2 sm:gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', perspective: '900px' }}
        >
          {order.map((figureId, gridPos) => (
            <Figure key={figureId} index={gridPos} phase={phase} isTarget={figureId === TARGET_INDEX} />
          ))}
        </div>
      </div>

      {/* FIND HIM. stamp — red border so it never blends into the crowd */}
      {phase === 'hidden' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-4 border-red bg-ink px-6 py-2 font-display text-3xl sm:text-5xl tracking-wide text-paper">
            FIND HIM.
          </div>
        </div>
      )}
    </div>
  )
}
