import { describe, it, expect } from 'vitest'
import { computeNewBadges } from '../src/lib/badges.js'

const base = {
  totalGames: 1, won: true, clicks: 5, seconds: 120,
  mode: 'classic', hardcore: false, streak: 1,
  longestStreak: 1, elo: 1000, existingBadges: [],
  wrongAccusations: 0, correctFinds: 0,
}

describe('computeNewBadges', () => {
  it('awards first_blood on first win', () => {
    expect(computeNewBadges({ ...base, totalGames: 1 })).toContain('first_blood')
  })
  it('does not re-award first_blood if already owned', () => {
    expect(computeNewBadges({ ...base, existingBadges: ['first_blood'] })).not.toContain('first_blood')
  })
  it('awards three_clicks for classic win in 3 clicks', () => {
    expect(computeNewBadges({ ...base, clicks: 3 })).toContain('three_clicks')
  })
  it('does not award three_clicks for 4 clicks', () => {
    expect(computeNewBadges({ ...base, clicks: 4 })).not.toContain('three_clicks')
  })
  it('awards speed_demon for speedrun under 60s', () => {
    expect(computeNewBadges({ ...base, mode: 'speedrun', seconds: 59 })).toContain('speed_demon')
  })
  it('does not award speed_demon for speedrun at 60s', () => {
    expect(computeNewBadges({ ...base, mode: 'speedrun', seconds: 60 })).not.toContain('speed_demon')
  })
  it('awards daily_7 at streak 7', () => {
    expect(computeNewBadges({ ...base, streak: 7 })).toContain('daily_7')
  })
  it('awards daily_30 at streak 30', () => {
    expect(computeNewBadges({ ...base, streak: 30 })).toContain('daily_30')
  })
  it('awards century at 100 total games', () => {
    expect(computeNewBadges({ ...base, totalGames: 100 })).toContain('century')
  })
  it('awards fact_ace for fact-checker with 0 wrong accusations', () => {
    expect(computeNewBadges({ ...base, mode: 'fact-checker', wrongAccusations: 0, correctFinds: 3, won: true })).toContain('fact_ace')
  })
  it('does not award fact_ace with wrong accusations', () => {
    expect(computeNewBadges({ ...base, mode: 'fact-checker', wrongAccusations: 1, won: true })).not.toContain('fact_ace')
  })
  it('awards hardcore_clear for hardcore win', () => {
    expect(computeNewBadges({ ...base, hardcore: true })).toContain('hardcore_clear')
  })
  it('returns empty array when nothing new earned', () => {
    const all = ['first_blood','three_clicks','speed_demon','daily_7','daily_30',
      'century','fact_ace','hardcore_clear','ranked_win','gold_rank','challenger',
      'hole_in_one','no_undo','globetrotter','veteran','speed_run_1','no_hub_clear',
      'golf_eagle','fact_historian','nerd']
    expect(computeNewBadges({ ...base, existingBadges: all })).toHaveLength(0)
  })
})
