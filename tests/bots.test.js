import { describe, it, expect } from 'vitest'
import { BOT_NAMES, pickBotName, gaussianDelay } from '../src/lib/bots.js'

describe('pickBotName', () => {
  it('returns a string from BOT_NAMES', () => {
    const name = pickBotName()
    expect(BOT_NAMES).toContain(name)
  })

  it('does not return a name already in usedNames set', () => {
    const used = new Set(BOT_NAMES.slice(0, BOT_NAMES.length - 1))
    const name = pickBotName(used)
    expect(name).toBe(BOT_NAMES[BOT_NAMES.length - 1])
  })
})

describe('gaussianDelay', () => {
  it('returns a positive number for easy difficulty', () => {
    const delay = gaussianDelay('easy')
    expect(delay).toBeGreaterThan(0)
  })

  it('easy is slower than hard on average', () => {
    const easyAvg = Array.from({ length: 50 }, () => gaussianDelay('easy')).reduce((a, b) => a + b) / 50
    const hardAvg = Array.from({ length: 50 }, () => gaussianDelay('hard')).reduce((a, b) => a + b) / 50
    expect(easyAvg).toBeGreaterThan(hardAvg)
  })
})
