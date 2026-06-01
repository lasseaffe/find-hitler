// src/lib/dailyChallenge.js
const DAILY_PAIRS = [
  { start: 'Coffee', target: 'Adolf Hitler' },
  { start: 'Penguin', target: 'Jesus' },
  { start: 'Jazz', target: 'Joseph Stalin' },
  { start: 'Pizza', target: '9/11 attacks' },
  { start: 'Bicycle', target: 'Taylor Swift' },
  { start: 'Volcano', target: 'Black hole' },
  { start: 'Chess', target: 'Minecraft' },
  { start: 'Chocolate', target: 'Holocaust' },
  { start: 'Samurai', target: 'Adolf Hitler' },
  { start: 'Opera', target: 'Jesus' },
  { start: 'Tornado', target: 'Joseph Stalin' },
  { start: 'Sushi', target: '9/11 attacks' },
  { start: 'Skateboarding', target: 'Taylor Swift' },
  { start: 'Coral reef', target: 'Black hole' },
  { start: 'Origami', target: 'Minecraft' },
  { start: 'Tango', target: 'Holocaust' },
  { start: 'Pottery', target: 'Adolf Hitler' },
  { start: 'Surfing', target: 'Jesus' },
  { start: 'Accordion', target: 'Joseph Stalin' },
  { start: 'Graffiti', target: '9/11 attacks' },
  { start: 'Archery', target: 'Taylor Swift' },
  { start: 'Noodle', target: 'Black hole' },
  { start: 'Parkour', target: 'Minecraft' },
  { start: 'Calligraphy', target: 'Holocaust' },
  { start: 'Bonsai', target: 'Adolf Hitler' },
  { start: 'Lacrosse', target: 'Jesus' },
  { start: 'Flamenco', target: 'Joseph Stalin' },
  { start: 'Mango', target: '9/11 attacks' },
  { start: 'Fencing', target: 'Taylor Swift' },
  { start: 'Thermodynamics', target: 'Black hole' },
  { start: 'Breakdancing', target: 'Minecraft' },
]

export function seedFromDate(dateStr) {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getDailyPair(dateStr = new Date().toISOString().slice(0, 10)) {
  const seed = seedFromDate(dateStr)
  return DAILY_PAIRS[seed % DAILY_PAIRS.length]
}

const DAILY_PLAYED_KEY = 'findHitler_dailyPlayed'

export function hasPlayedDailyToday(dateStr = new Date().toISOString().slice(0, 10)) {
  if (typeof localStorage === 'undefined') return false
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_PLAYED_KEY) || 'null')
    return stored?.date === dateStr
  } catch {
    return false
  }
}

export function markDailyPlayed(dateStr = new Date().toISOString().slice(0, 10)) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DAILY_PLAYED_KEY, JSON.stringify({ date: dateStr }))
}
