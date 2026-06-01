// src/lib/scoring.js
export function calculateScore({ mode, clicks, seconds }) {
  if (mode === 'speedrun') {
    return Math.max(0, 10000 - seconds * 100 - clicks * 50)
  }
  return Math.max(0, 10000 - clicks * 500 - seconds * 10)
}

export function calculateGolfScore({ clicks }) {
  return clicks
}

export function calculateParGrade(clicks) {
  if (clicks === 1) return { grade: 'Hole-in-One', delta: -4 }
  if (clicks === 2) return { grade: 'Albatross', delta: -3 }
  if (clicks === 3) return { grade: 'Eagle', delta: -2 }
  if (clicks === 4) return { grade: 'Birdie', delta: -1 }
  if (clicks === 5) return { grade: 'Par', delta: 0 }
  if (clicks === 6) return { grade: 'Bogey', delta: +1 }
  return { grade: 'Double Bogey', delta: +2 }
}
