// src/lib/bots.js

export const BOT_NAMES = [
  'DeepLink_9000', 'WikiBot_Krantz', 'HyperLink_Rex', 'ClickBot_Fury',
  'NavBot_Omega', 'LinkRaider_X', 'WikiWalker_Z', 'PathBot_Prime',
]

export function pickBotName(usedNames = new Set()) {
  const available = BOT_NAMES.filter(n => !usedNames.has(n))
  if (available.length === 0) return `WikiBot_${Math.floor(Math.random() * 9000 + 1000)}`
  return available[Math.floor(Math.random() * available.length)]
}

// Box-Muller gaussian sample clamped to [min, max]
function gaussianSample(mean, std, min, max) {
  let u, v
  do {
    u = Math.random()
    v = Math.random()
  } while (u === 0)
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(min, Math.min(max, mean + z * std))
}

// Returns delay in ms before bot makes its next move
// easy: ~8s/click, medium: ~4s/click, hard: ~1.5s/click
const DIFFICULTY_PARAMS = {
  easy:   { mean: 8000,  std: 2000, min: 3000,  max: 15000 },
  medium: { mean: 4000,  std: 1200, min: 1500,  max: 8000  },
  hard:   { mean: 1500,  std: 500,  min: 600,   max: 3500  },
}

export function gaussianDelay(difficulty = 'medium') {
  const p = DIFFICULTY_PARAMS[difficulty] || DIFFICULTY_PARAMS.medium
  return gaussianSample(p.mean, p.std, p.min, p.max)
}

/**
 * Schedule a bot to play a game.
 * Bots use random walks — BFS is deferred to Phase 3.
 *
 * @param {object} opts
 * @param {string} opts.roomCode
 * @param {string} opts.botId
 * @param {string} opts.difficulty - 'easy' | 'medium' | 'hard'
 * @param {Function} opts.getPlayerLinks - (botId) => string[]
 * @param {Function} opts.onMove - async (botId, targetPage) => void
 * @param {Function} opts.isFinished - () => boolean
 */
export function scheduleBot({ roomCode, botId, difficulty, getPlayerLinks, onMove, isFinished }) {
  async function tick() {
    if (isFinished()) return
    const links = getPlayerLinks(botId)
    if (!links || links.length === 0) return
    const pick = links[Math.floor(Math.random() * links.length)]
    await onMove(botId, pick)
    if (!isFinished()) {
      setTimeout(tick, gaussianDelay(difficulty))
    }
  }
  setTimeout(tick, gaussianDelay(difficulty))
}
