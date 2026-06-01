import { describe, it, expect, beforeEach } from 'vitest'
import { ALL_ROOMS, createRoom, joinRoom, getRoom, setRoomStatus, removePlayer, roomSnapshot } from '../src/lib/rooms.js'
import { BOT_NAMES, pickBotName, gaussianDelay, scheduleBot } from '../src/lib/bots.js'

beforeEach(() => ALL_ROOMS.clear())

describe('roomSnapshot', () => {
  it('returns null for missing room', () => {
    expect(roomSnapshot('NOTHERE')).toBeNull()
  })

  it('serializes players as array', () => {
    const { code } = createRoom({ hostId: 'h1', hostName: 'Host', mode: 'classic', target: 'Hitler', botCount: 0, maxPlayers: 4 })
    const snap = roomSnapshot(code)
    expect(Array.isArray(snap.players)).toBe(true)
    expect(snap.players[0].id).toBe('h1')
    expect(snap.players[0].name).toBe('Host')
  })
})

describe('room full capacity', () => {
  it('rejects when maxPlayers exceeded', () => {
    const { code } = createRoom({ hostId: 'h1', hostName: 'A', mode: 'classic', target: 'X', botCount: 0, maxPlayers: 2 })
    joinRoom(code, 'p2', 'B')
    const r = joinRoom(code, 'p3', 'C')
    expect(r.ok).toBe(false)
  })
})

describe('scheduleBot', () => {
  it('calls onMove at least once within 4s on hard difficulty', async () => {
    const moves = []
    scheduleBot({
      roomCode: 'R1',
      botId: 'bot1',
      difficulty: 'hard',
      getPlayerLinks: () => ['Page_A', 'Page_B'],
      onMove: async (id, page) => { moves.push(page) },
      isFinished: () => moves.length >= 1,
    })
    await new Promise(r => setTimeout(r, 4000))
    expect(moves.length).toBeGreaterThanOrEqual(1)
  }, 10000)
})

describe('bot names exhaustion', () => {
  it('returns a random fallback when all names used', () => {
    const all = new Set(BOT_NAMES)
    const name = pickBotName(all)
    expect(name).toMatch(/^WikiBot_\d{4}$/)
  })
})
