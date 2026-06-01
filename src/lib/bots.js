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

async function fetchWikiLinks(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=links&pllimit=500&format=json&origin=*`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const pages = Object.values(data.query?.pages || {})
    if (!pages[0]?.links) return []
    return pages[0].links.map(l => l.title)
  } catch {
    return []
  }
}

async function bfsPath(startPage, target, maxDepth = 8) {
  function norm(t) { return t.replace(/_/g, ' ').trim().toLowerCase() }
  const normTarget = norm(target)
  const visited = new Map([[norm(startPage), null]])
  let frontier = [startPage]

  for (let depth = 1; depth <= maxDepth; depth++) {
    const results = await Promise.all(frontier.map(page => fetchWikiLinks(page)))
    const nextFrontier = []
    for (let i = 0; i < frontier.length; i++) {
      for (const link of results[i]) {
        const normLink = norm(link)
        if (visited.has(normLink)) continue
        visited.set(normLink, frontier[i])
        if (normLink === normTarget) {
          const path = [target]
          let cur = frontier[i]
          while (cur && norm(cur) !== norm(startPage)) {
            path.unshift(cur)
            cur = visited.get(norm(cur))
          }
          return path
        }
        nextFrontier.push(link)
      }
    }
    frontier = nextFrontier
    if (frontier.length === 0) return null
  }
  return null
}

/**
 * Schedule a bot to play a game.
 * Bots pre-compute a BFS path to the target and follow it,
 * falling back to random walk if BFS fails.
 *
 * @param {object} opts
 * @param {string} opts.roomCode
 * @param {string} opts.botId
 * @param {string} opts.difficulty - 'easy' | 'medium' | 'hard'
 * @param {string} [opts.target] - target page title for BFS guidance
 * @param {Function} opts.getPlayerLinks - (botId) => string[]
 * @param {Function} opts.onMove - async (botId, targetPage) => void
 * @param {Function} opts.isFinished - () => boolean
 */
export function scheduleBot({ roomCode, botId, difficulty, target, getPlayerLinks, onMove, isFinished }) {
  async function run() {
    if (isFinished()) return

    const links = getPlayerLinks(botId)
    if (!links || links.length === 0) return

    const startGuess = links[0]
    let plannedPath = null

    if (target) {
      try {
        plannedPath = await bfsPath(startGuess, target)
      } catch {
        plannedPath = null
      }
    }

    async function tick(remainingPath) {
      if (isFinished()) return

      const currentLinks = getPlayerLinks(botId)
      let pick = null

      if (remainingPath && remainingPath.length > 0) {
        const next = remainingPath[0]
        function norm(t) { return t.replace(/_/g, ' ').trim().toLowerCase() }
        const match = currentLinks.find(l => norm(l) === norm(next))
        if (match) {
          pick = match
          remainingPath = remainingPath.slice(1)
        }
      }

      if (!pick && currentLinks.length > 0) {
        pick = currentLinks[Math.floor(Math.random() * currentLinks.length)]
      }

      if (pick) await onMove(botId, pick)

      if (!isFinished()) {
        setTimeout(() => tick(remainingPath), gaussianDelay(difficulty))
      }
    }

    setTimeout(() => tick(plannedPath), gaussianDelay(difficulty))
  }

  run()
}
