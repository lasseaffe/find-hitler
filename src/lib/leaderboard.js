// src/lib/leaderboard.js
export const STORAGE_KEY = 'findHitlerLeaderboard'
const MAX_ENTRIES = 50

function today() {
  return new Date().toISOString().slice(0, 10)
}

function read() {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function write(entries) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function addEntry({ mode, target, clicks, time, score, playerName }) {
  const entries = read()
  entries.push({ mode, target, clicks, time, score, playerName, date: today() })

  if (entries.length > MAX_ENTRIES) {
    // Drop the entry with the lowest score (LRU by quality)
    const minIdx = entries.reduce((best, e, i, arr) => e.score < arr[best].score ? i : best, 0)
    entries.splice(minIdx, 1)
  }

  write(entries)
}

export function getEntries({ mode } = {}) {
  const entries = read()
  const filtered = mode ? entries.filter(e => e.mode === mode) : entries
  return [...filtered].sort((a, b) => b.score - a.score)
}
