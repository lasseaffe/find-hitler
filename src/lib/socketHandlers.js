// src/lib/socketHandlers.js
import { createRoom, getRoom, joinRoom, setRoomStatus, removePlayer, roomSnapshot, ALL_ROOMS } from './rooms.js'
import { createGame, getGame, getPlayer, updatePlayerMove, addPlayerToGame, markPlayerFinished } from './gameState.js'
import { fetchAndSanitizeWiki, getRandomWikiPage } from './wikipedia.js'
import { calculateScore } from './scoring.js'
import { pickBotName, scheduleBot } from './bots.js'

function normTitle(t) {
  return decodeURIComponent(t).replace(/_/g, ' ').trim().toLowerCase()
}

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {

    // --- CREATE ROOM ---
    socket.on('room:create', ({ playerName, mode, target, botCount, maxPlayers }) => {
      const { code } = createRoom({
        hostId: socket.id,
        hostName: playerName,
        mode,
        target,
        botCount: botCount || 0,
        maxPlayers: maxPlayers || 6,
      })
      socket.join(code)
      socket.data.roomCode = code
      socket.emit('room:created', { code })
      io.to(code).emit('room:state', roomSnapshot(code))
    })

    // --- JOIN ROOM ---
    socket.on('room:join', ({ roomCode, playerName }) => {
      const result = joinRoom(roomCode, socket.id, playerName)
      if (!result.ok) {
        socket.emit('room:error', { error: result.error })
        return
      }
      socket.join(roomCode)
      socket.data.roomCode = roomCode
      io.to(roomCode).emit('room:state', roomSnapshot(roomCode))
    })

    // --- START GAME (host only) ---
    socket.on('game:start', async ({ roomCode }) => {
      const room = getRoom(roomCode)
      if (!room || room.host !== socket.id) return
      if (room.status !== 'waiting') return

      setRoomStatus(roomCode, 'racing')
      room.startTime = Date.now()

      // Fetch a shared start page for all players
      const startTitle = await getRandomWikiPage()
      const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

      // Create a single shared game for this room using host's id
      const hostPlayer = room.players.get(room.host)
      const gameId = createGame({
        target: room.target,
        mode: room.mode,
        playerId: room.host,
        playerName: hostPlayer.name,
        startPage: title,
        cleanHtml,
        validLinks,
      })
      room.gameId = gameId
      hostPlayer.currentPage = title

      // Add all other human players to the same game
      for (const [pid, player] of room.players.entries()) {
        if (pid === room.host) continue
        if (!player.isBot) {
          addPlayerToGame(gameId, pid, player.name, title, cleanHtml, validLinks)
          player.currentPage = title
        }
      }

      // Add bots to game and schedule them
      const usedNames = new Set(Array.from(room.players.values()).map(p => p.name))
      for (let i = 0; i < room.botCount; i++) {
        const botId = `bot_${Math.random().toString(36).slice(2, 8)}`
        const botName = pickBotName(usedNames)
        usedNames.add(botName)
        room.players.set(botId, { name: botName, isBot: true, clicks: 0, currentPage: title, finished: false })
        addPlayerToGame(gameId, botId, botName, title, cleanHtml, validLinks)

        scheduleBot({
          roomCode,
          botId,
          difficulty: 'medium',
          getPlayerLinks: (id) => {
            const p = getPlayer(gameId, id)
            return p ? p.allowedMoves : []
          },
          onMove: async (id, targetPage) => {
            await processMoveForPlayer({ io, roomCode, gameId, room, playerId: id, targetPage })
          },
          isFinished: () => {
            const p = room.players.get(botId)
            return !p || p.finished || room.status === 'finished'
          },
        })
      }

      // Emit game start to all in room with initial page
      io.to(roomCode).emit('game:started', {
        gameId,
        html: cleanHtml,
        title,
        target: room.target,
        mode: room.mode,
        snapshot: roomSnapshot(roomCode),
      })
    })

    // --- PLAYER NAVIGATE ---
    socket.on('game:navigate', async ({ roomCode, target: moveTarget }) => {
      const room = getRoom(roomCode)
      if (!room || room.status !== 'racing') return
      const gameId = room.gameId
      await processMoveForPlayer({ io, roomCode, gameId, room, playerId: socket.id, targetPage: moveTarget })
    })

    // --- PLAYER DISCONNECT ---
    socket.on('disconnect', () => {
      const roomCode = socket.data.roomCode
      if (!roomCode) return
      const room = getRoom(roomCode)

      // Host transfer logic
      if (room && room.host === socket.id && room.status === 'waiting') {
        const nextHuman = Array.from(room.players.entries()).find(([id, p]) => id !== socket.id && !p.isBot)
        if (nextHuman) {
          room.host = nextHuman[0]
        } else {
          ALL_ROOMS.delete(roomCode)
          return
        }
      }

      removePlayer(roomCode, socket.id)
      const updatedRoom = getRoom(roomCode)
      if (updatedRoom) io.to(roomCode).emit('room:state', roomSnapshot(roomCode))
    })
  })
}

// Shared move processor for both humans and bots
async function processMoveForPlayer({ io, roomCode, gameId, room, playerId, targetPage }) {
  const game = getGame(gameId)
  const player = getPlayer(gameId, playerId)
  if (!player || player.finished) return

  const allowed = player.allowedMoves.map(normTitle)
  if (!allowed.includes(normTitle(targetPage))) return

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(targetPage)
  updatePlayerMove(gameId, playerId, { nextPage: title, cleanHtml, validLinks })

  const updated = getPlayer(gameId, playerId)
  const roomPlayer = room.players.get(playerId)
  if (roomPlayer) {
    roomPlayer.clicks = updated.clicks
    roomPlayer.currentPage = title
  }

  // Broadcast feed update to all room members
  io.to(roomCode).emit('game:state-update', {
    playerId,
    name: roomPlayer?.name || 'Unknown',
    clicks: updated.clicks,
    currentPage: title,
    isBot: roomPlayer?.isBot || false,
  })

  // Win check
  const won = normTitle(title) === normTitle(game.target)
  if (won) {
    const seconds = Math.floor((Date.now() - room.startTime) / 1000)
    const score = calculateScore({ mode: room.mode, clicks: updated.clicks, seconds })
    markPlayerFinished(gameId, playerId)
    if (roomPlayer) roomPlayer.finished = true

    const humansDone = Array.from(room.players.entries())
      .filter(([, p]) => !p.isBot)
      .every(([, p]) => p.finished)

    if (humansDone) setRoomStatus(roomCode, 'finished')

    io.to(roomCode).emit('game:player-finished', {
      playerId,
      name: roomPlayer?.name || 'Unknown',
      clicks: updated.clicks,
      seconds,
      score,
      path: [...updated.history.map(h => h.page), title],
      isBot: roomPlayer?.isBot || false,
    })

    if (!roomPlayer?.isBot) {
      io.to(playerId).emit('game:you-finished', {
        score,
        clicks: updated.clicks,
        seconds,
        target: game.target,
      })
    }
  } else if (!roomPlayer?.isBot) {
    io.to(playerId).emit('game:page', {
      html: cleanHtml,
      title,
      clicks: updated.clicks,
      undoTokens: updated.undoTokens,
    })
  }
}
