function getDuelsStore() {
  return globalThis._duelsStore || (globalThis._duelsStore = new Map())
}

export function createDuel({ p1Id, p1Name, p1Elo, p2Id, p2Name, p2Elo, roomCode }) {
  const duels = getDuelsStore()
  const duelId = Math.random().toString(36).slice(2, 10)
  duels.set(duelId, {
    roomCode,
    players: {
      [p1Id]: { name: p1Name, elo: p1Elo, hp: 5000, won: 0 },
      [p2Id]: { name: p2Name, elo: p2Elo, hp: 5000, won: 0 },
    },
    round: 1,
    status: 'active',
  })
  return duelId
}

export function getDuel(duelId) {
  const duels = getDuelsStore()
  return duels.get(duelId) || null
}

export function applyDamage(duelId, playerId, damage) {
  const duels = getDuelsStore()
  const duel = duels.get(duelId)
  if (!duel || !duel.players[playerId]) return
  duel.players[playerId].hp = Math.max(0, duel.players[playerId].hp - damage)
}

export function isDuelOver(duelId) {
  const duels = getDuelsStore()
  const duel = duels.get(duelId)
  if (!duel) return false
  for (const [id, player] of Object.entries(duel.players)) {
    if (player.hp <= 0) {
      return Object.keys(duel.players).find(k => k !== id)
    }
  }
  return false
}

export function advanceRound(duelId) {
  const duels = getDuelsStore()
  const duel = duels.get(duelId)
  if (duel) duel.round++
}
