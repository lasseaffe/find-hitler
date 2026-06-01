import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDuel,
  getDuel,
  applyDamage,
  isDuelOver,
} from '../src/lib/hpDuel.js'

beforeEach(() => {
  globalThis._duelsStore = new Map()
})

describe('createDuel', () => {
  it('creates two players with 5000 HP', () => {
    const duelId = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1100 })
    const duel = getDuel(duelId)
    expect(duel.players.a.hp).toBe(5000)
    expect(duel.players.b.hp).toBe(5000)
  })
})

describe('applyDamage', () => {
  it('reduces target HP by damage amount', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 1000)
    expect(getDuel(id).players.a.hp).toBe(4000)
  })

  it('floors HP at 0', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 9999)
    expect(getDuel(id).players.a.hp).toBe(0)
  })
})

describe('isDuelOver', () => {
  it('returns false when both players have HP > 0', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    expect(isDuelOver(id)).toBe(false)
  })

  it('returns winner id when a player reaches 0 HP', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 5000)
    expect(isDuelOver(id)).toBe('b')
  })
})
