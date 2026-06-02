export const SCORE_CONFIG = {
  easy:     { correct: 100,  wrong: -30  },
  medium:   { correct: 100,  wrong: -50  },
  hard:     { correct: 150,  wrong: -75  },
  hardcore: { correct: 200,  wrong: -150 },
}

const STRIP_ARTICLES = /^(the|a|an)\s+/i

export function normalizeSelection(text) {
  return String(text ?? '').trim().replace(STRIP_ARTICLES, '').toLowerCase()
}

// Free-select matching with a server-side over-select guard.
// A selection matches a mistake's rendered false text (`span`) when they are equal,
// the selection is contained in the span, or the selection contains the span plus at
// most a little context (length <= span length * 3). The guard stops "select the whole
// paragraph" from trivially winning hard mode.
export function matchesSpan(selection, span) {
  const a = normalizeSelection(selection)
  const b = normalizeSelection(span)
  if (!a || !b) return false
  if (a === b) return true
  if (b.includes(a)) return true
  if (a.includes(b) && a.length <= b.length * 4) return true
  return false
}

// payload = { fcId } (easy/medium clicks) OR { selection } (hard/hardcore free-select).
// `mistakes` is the article's mistakes array: [{ fcId, span, correct, explanation }].
export function scoreAccusation(payload, mistakes, difficulty) {
  const config = SCORE_CONFIG[difficulty] ?? SCORE_CONFIG.medium
  const list = Array.isArray(mistakes) ? mistakes : []

  let match = null
  if (payload && payload.fcId) {
    match = list.find(m => m.fcId === payload.fcId) ?? null
  } else if (payload && payload.selection) {
    match = list.find(m => matchesSpan(payload.selection, m.span)) ?? null
  }

  if (match) {
    return { correct: true, delta: config.correct, explanation: match.explanation, answer: match.correct, foundId: match.fcId }
  }
  return { correct: false, delta: config.wrong, explanation: null, answer: null, foundId: null }
}
