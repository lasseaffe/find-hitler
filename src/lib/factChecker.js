export const SCORE_CONFIG = {
  easy:     { correct: 100,  wrong: -30  },
  medium:   { correct: 100,  wrong: -50  },
  hard:     { correct: 150,  wrong: -75  },
  hardcore: { correct: 200,  wrong: -150 },
}

const STRIP_ARTICLES = /^(the|a|an)\s+/i

export function normalizeSelection(text) {
  return text.trim().replace(STRIP_ARTICLES, '').toLowerCase()
}

export function scoreAccusation(rawSelection, mistakes, difficulty) {
  const normalized = normalizeSelection(rawSelection)
  const match = mistakes.find(m => normalizeSelection(m.span) === normalized)
  const config = SCORE_CONFIG[difficulty] ?? SCORE_CONFIG.medium

  if (match) {
    return { correct: true, delta: config.correct, explanation: match.explanation, answer: match.correct }
  }
  return { correct: false, delta: config.wrong, explanation: null, answer: null }
}
