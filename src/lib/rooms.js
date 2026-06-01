// src/lib/rooms.js
export const ALL_ROOMS = globalThis._roomsStore || (globalThis._roomsStore = new Map())

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function createRoom({ hostId, hostName, mode, target, botCount, maxPlayers }) {
  let code
  do { code = genCode() } while (ALL_ROOMS.has(code))

  const players = new Map()
  players.set(hostId, { name: hostName, isBot: false, clicks: 0, currentPage: null, finished: false })

  ALL_ROOMS.set(code, {
    host: hostId,
    mode,
    target,
    botCount,
    maxPlayers: maxPlayers || 6,
    status: 'waiting',
    players,
    gameId: null,
    startTime: null,
  })

  return { code }
}

export function getRoom(code) {
  return ALL_ROOMS.get(code) || null
}

export function joinRoom(code, playerId, playerName) {
  const room = getRoom(code)
  if (!room) return { ok: false, error: 'Room not found' }
  if (room.status !== 'waiting') return { ok: false, error: 'Game already started' }
  if (room.players.size >= room.maxPlayers) return { ok: false, error: 'Room is full' }
  room.players.set(playerId, { name: playerName, isBot: false, clicks: 0, currentPage: null, finished: false })
  return { ok: true }
}

export function setRoomStatus(code, status) {
  const room = getRoom(code)
  if (room) room.status = status
}

export function removePlayer(code, playerId) {
  const room = getRoom(code)
  if (room) room.players.delete(playerId)
}

export function roomSnapshot(code) {
  const room = getRoom(code)
  if (!room) return null
  return {
    code,
    host: room.host,
    mode: room.mode,
    target: room.target,
    status: room.status,
    players: Array.from(room.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      isBot: p.isBot,
      clicks: p.clicks,
      currentPage: p.currentPage,
      finished: p.finished,
    })),
  }
}
