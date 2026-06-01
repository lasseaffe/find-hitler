import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinQueue,
  leaveQueue,
  findMatch,
  getQueueEntry,
} from '../src/lib/rankedQueue.js'

beforeEach(() => {
  globalThis._rankedQueue = new Map()
})

describe('joinQueue', () => {
  it('adds a player to the queue', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    expect(getQueueEntry('p1')).toBeDefined()
  })

  it('overwrites if same player joins again', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p1', socketId: 's2', elo: 1050, name: 'Alice' })
    expect(getQueueEntry('p1').elo).toBe(1050)
  })
})

describe('leaveQueue', () => {
  it('removes a player from the queue', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    leaveQueue('p1')
    expect(getQueueEntry('p1')).toBeNull()
  })
})

describe('findMatch', () => {
  it('matches two players within 200 ELO of each other', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p2', socketId: 's2', elo: 1150, name: 'Bob' })
    const match = findMatch('p1', 200)
    expect(match).not.toBeNull()
    expect(match.playerId).toBe('p2')
  })

  it('does not match players outside ELO range', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p2', socketId: 's2', elo: 1300, name: 'Bob' })
    const match = findMatch('p1', 200)
    expect(match).toBeNull()
  })

  it('does not match player with themselves', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    const match = findMatch('p1', 500)
    expect(match).toBeNull()
  })
})
