import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoom,
  joinRoom,
  getRoom,
  setRoomStatus,
  removePlayer,
  ALL_ROOMS,
} from '../src/lib/rooms.js'

beforeEach(() => ALL_ROOMS.clear())

describe('createRoom', () => {
  it('returns a 6-char uppercase code', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('stores room with status waiting', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    const room = getRoom(code)
    expect(room.status).toBe('waiting')
    expect(room.host).toBe('p1')
  })

  it('adds host as first player', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    const room = getRoom(code)
    expect(room.players.has('p1')).toBe(true)
    expect(room.players.get('p1').name).toBe('Alice')
    expect(room.players.get('p1').isBot).toBe(false)
  })
})

describe('joinRoom', () => {
  it('adds a second player', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    const result = joinRoom(code, 'p2', 'Bob')
    expect(result.ok).toBe(true)
    expect(getRoom(code).players.size).toBe(2)
  })

  it('rejects join on full room', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 2 })
    joinRoom(code, 'p2', 'Bob')
    const result = joinRoom(code, 'p3', 'Carol')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/full/)
  })

  it('rejects join when game already started', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    setRoomStatus(code, 'racing')
    const result = joinRoom(code, 'p2', 'Bob')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/started/)
  })
})

describe('removePlayer', () => {
  it('removes a player from the room', () => {
    const { code } = createRoom({ hostId: 'p1', hostName: 'Alice', mode: 'classic', target: 'Adolf Hitler', botCount: 0, maxPlayers: 4 })
    joinRoom(code, 'p2', 'Bob')
    removePlayer(code, 'p2')
    expect(getRoom(code).players.has('p2')).toBe(false)
  })
})
