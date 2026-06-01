function getQueue() {
  return globalThis._rankedQueue || (globalThis._rankedQueue = new Map())
}

export function joinQueue({ playerId, socketId, elo, name }) {
  const queue = getQueue()
  queue.set(playerId, { playerId, socketId, elo, name, joinedAt: Date.now(), searchRange: 200 })
}

export function leaveQueue(playerId) {
  const queue = getQueue()
  queue.delete(playerId)
}

export function getQueueEntry(playerId) {
  const queue = getQueue()
  return queue.get(playerId) || null
}

export function tickSearchRanges() {
  const queue = getQueue()
  const now = Date.now()
  for (const entry of queue.values()) {
    const waitSeconds = (now - entry.joinedAt) / 1000
    if (waitSeconds > 30) {
      entry.searchRange = 200 + Math.floor((waitSeconds - 30) / 30) * 100
    }
  }
}

export function findMatch(playerId, overrideRange) {
  const queue = getQueue()
  const seeker = queue.get(playerId)
  if (!seeker) return null
  const range = overrideRange ?? seeker.searchRange
  for (const [id, entry] of queue.entries()) {
    if (id === playerId) continue
    if (Math.abs(entry.elo - seeker.elo) <= range) return entry
  }
  return null
}
