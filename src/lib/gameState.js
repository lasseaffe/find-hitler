// globalThis persists across Next.js hot reloads in dev
const games = globalThis._gamesStore || (globalThis._gamesStore = new Map())

export function createGame({ target, mode, hardcore = false, playerId, playerName, startPage, cleanHtml, validLinks }) {
  const gameId = Math.random().toString(36).slice(2, 10)
  games.set(gameId, {
    target,
    mode,
    hardcore,
    startTime: Date.now(),
    players: {
      [playerId]: {
        name: playerName,
        currentPage: startPage,
        _currentHtml: cleanHtml,
        history: [],
        clicks: 0,
        undoTokens: hardcore ? 0 : 3,
        allowedMoves: [...validLinks],
      },
    },
  })
  return gameId
}

export function getGame(gameId) {
  return games.get(gameId) || null
}

export function getPlayer(gameId, playerId) {
  const game = games.get(gameId)
  return game?.players[playerId] || null
}

export function updatePlayerMove(gameId, playerId, { nextPage, cleanHtml, validLinks }) {
  const game = games.get(gameId)
  const player = game.players[playerId]

  // Push current state to history before advancing; record timestamp for per-node timing
  player.history.push({
    page: player.currentPage,
    html: player._currentHtml,
    allowedMoves: [...player.allowedMoves],
    timestamp: Date.now(),
  })

  player.currentPage = nextPage
  player._currentHtml = cleanHtml
  player.allowedMoves = [...validLinks]
  player.clicks++
}

export function useUndoToken(gameId, playerId) {
  const game = games.get(gameId)
  const player = game.players[playerId]

  if (player.undoTokens <= 0 || player.history.length === 0) return null

  const previous = player.history.pop()
  player.currentPage = previous.page
  player._currentHtml = previous.html
  player.allowedMoves = previous.allowedMoves
  player.undoTokens--

  return {
    page: previous.page,
    html: previous.html,
    clicks: player.clicks,
    undoTokens: player.undoTokens,
  }
}

// Add a new player to an existing game (used for multiplayer joins)
export function addPlayerToGame(gameId, playerId, playerName, startPage, cleanHtml, validLinks) {
  const game = games.get(gameId)
  if (!game) return
  game.players[playerId] = {
    name: playerName,
    currentPage: startPage,
    _currentHtml: cleanHtml,
    history: [],
    clicks: 0,
    undoTokens: game.hardcore ? 0 : 3,
    allowedMoves: [...validLinks],
  }
}

// Mark a player as finished (for multiplayer win detection)
export function markPlayerFinished(gameId, playerId) {
  const game = games.get(gameId)
  if (!game || !game.players[playerId]) return
  game.players[playerId].finished = true
}
