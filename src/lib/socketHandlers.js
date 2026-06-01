// src/lib/socketHandlers.js
import { createRoom, getRoom, joinRoom, setRoomStatus, removePlayer, roomSnapshot, ALL_ROOMS } from './rooms.js'
import { createGame, getGame, getPlayer, updatePlayerMove, addPlayerToGame, markPlayerFinished } from './gameState.js'
import { fetchAndSanitizeWiki, getRandomWikiPage } from './wikipedia.js'
import { calculateScore } from './scoring.js'
import { pickBotName, scheduleBot } from './bots.js'
import { joinQueue, leaveQueue, findMatch } from './rankedQueue.js'
import { createDuel, getDuel, applyDamage, isDuelOver, advanceRound } from './hpDuel.js'
import { calculateHpDamage } from './bfsDistance.js'

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
          target: room.target,
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

      const disconnectingPlayer = room?.players?.get(socket.id)
      const disconnectName = disconnectingPlayer?.name || 'A player'

      removePlayer(roomCode, socket.id)
      const updatedRoom = getRoom(roomCode)
      if (updatedRoom) {
        io.to(roomCode).emit('room:state', roomSnapshot(roomCode))
        io.to(roomCode).emit('chat:event', { text: `${disconnectName} disconnected`, isWin: false })
      }
    })

    // --- RANKED: JOIN QUEUE ---
    socket.on('ranked:join', ({ userId, elo, name }) => {
      joinQueue({ playerId: socket.id, socketId: socket.id, elo: elo || 1000, name: name || 'Anonymous' })
      socket.data.userId = userId
      socket.emit('ranked:queued', { message: 'Searching for opponent...' })

      const opponent = findMatch(socket.id)
      if (opponent) {
        leaveQueue(socket.id)
        leaveQueue(opponent.playerId)
        startRankedDuel(io, socket.id, { elo: elo || 1000, name: name || 'Anonymous', userId }, opponent)
      }
    })

    // --- RANKED: LEAVE QUEUE ---
    socket.on('ranked:leave', () => {
      leaveQueue(socket.id)
      socket.emit('ranked:left', {})
    })

    // --- CHAT: TEXT MESSAGE ---
    socket.on('chat:message', ({ roomCode, text }) => {
      const room = getRoom(roomCode)
      if (!room) return
      const player = room.players.get(socket.id)
      if (!player) return
      const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 120)
      if (!safe.trim()) return
      io.to(roomCode).emit('chat:message', { name: player.name, text: safe })
    })

    // --- CHAT: EMOTE ---
    socket.on('chat:emote', ({ roomCode, emote }) => {
      const room = getRoom(roomCode)
      if (!room) return
      const player = room.players.get(socket.id)
      if (!player) return
      const ALLOWED = new Set(['💀','🔥','😭','👏','⚡','🤡'])
      if (!ALLOWED.has(emote)) return
      io.to(roomCode).emit('chat:emote', { name: player.name, emote })
    })

    // --- CHAT: LAST UNDO EVENT ---
    socket.on('chat:last-undo', ({ roomCode }) => {
      const room = getRoom(roomCode)
      if (!room) return
      const player = room.players.get(socket.id)
      if (!player) return
      io.to(roomCode).emit('chat:event', {
        text: `${player.name} used their last undo`,
        isWin: false,
      })
    })

    // --- RANKED: DUEL MOVE ---
    socket.on('duel:navigate', async ({ duelId, target: moveTarget }) => {
      const duel = getDuel(duelId)
      if (!duel || duel.status !== 'active') return
      const gameId = duel.gameId
      if (!gameId) return
      const room = getRoom(duel.roomCode)
      if (!room) return
      await processMoveForPlayer({ io, roomCode: duel.roomCode, gameId, room, playerId: socket.id, targetPage: moveTarget })
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

    io.to(roomCode).emit('chat:event', {
      text: `${roomPlayer?.name || 'Someone'} found ${game.target} — ${updated.clicks} clicks · ${Math.floor((Date.now() - room.startTime) / 1000)}s 🏆`,
      isWin: true,
    })

    if (!roomPlayer?.isBot) {
      io.to(playerId).emit('game:you-finished', {
        score,
        clicks: updated.clicks,
        seconds,
        target: game.target,
      })
    }

    // HP Duel round end: loser takes BFS damage
    if (room.mode === 'ranked' && room.duelId) {
      const duel = getDuel(room.duelId)
      if (duel && duel.status === 'active') {
        const loserId = Array.from(room.players.keys()).find(id => id !== playerId && !room.players.get(id)?.isBot)
        if (loserId) {
          const loserPlayer = getPlayer(gameId, loserId)
          const damage = await calculateHpDamage(loserPlayer?.currentPage || title, game.target)
          applyDamage(room.duelId, loserId, damage)

          const winner = isDuelOver(room.duelId)
          if (winner) {
            duel.status = 'finished'
            io.to(roomCode).emit('duel:finished', {
              winnerId: winner,
              players: Object.fromEntries(
                Object.entries(duel.players).map(([id, p]) => [id, { name: p.name, hp: p.hp, elo: p.elo }])
              ),
            })
          } else {
            advanceRound(room.duelId)
            const newStart = await getRandomWikiPage()
            const { cleanHtml: newHtml, validLinks: newLinks, title: newTitle } = await fetchAndSanitizeWiki(newStart)
            // Reset game state for next round
            for (const [pid] of room.players.entries()) {
              if (!room.players.get(pid)?.isBot) {
                addPlayerToGame(gameId, pid, room.players.get(pid).name, newTitle, newHtml, newLinks)
              }
            }
            io.to(roomCode).emit('duel:round-end', {
              damage,
              loserId,
              duelPlayers: duel.players,
              nextPage: newTitle,
              nextHtml: newHtml,
            })
          }
        }
      }
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

async function startRankedDuel(io, p1SocketId, p1Data, p2Entry) {
  const p2SocketId = p2Entry.socketId
  const target = 'Adolf Hitler'

  const startTitle = await getRandomWikiPage()
  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const { code } = createRoom({
    hostId: p1SocketId,
    hostName: p1Data.name,
    mode: 'ranked',
    target,
    botCount: 0,
    maxPlayers: 2,
  })
  const room = getRoom(code)
  room.players.set(p2SocketId, { name: p2Entry.name, isBot: false, clicks: 0, currentPage: null, finished: false })
  setRoomStatus(code, 'racing')
  room.startTime = Date.now()

  const gameId = createGame({
    target,
    mode: 'ranked',
    playerId: p1SocketId,
    playerName: p1Data.name,
    startPage: title,
    cleanHtml,
    validLinks,
  })
  addPlayerToGame(gameId, p2SocketId, p2Entry.name, title, cleanHtml, validLinks)
  room.gameId = gameId

  const duelId = createDuel({
    p1Id: p1SocketId, p1Name: p1Data.name, p1Elo: p1Data.elo,
    p2Id: p2SocketId, p2Name: p2Entry.name, p2Elo: p2Entry.elo,
    roomCode: code,
  })
  const duel = getDuel(duelId)
  duel.gameId = gameId
  room.duelId = duelId

  const io_ = globalThis._io
  io_.to(p1SocketId).socketsJoin(code)
  io_.to(p2SocketId).socketsJoin(code)

  const payload = { duelId, gameId, html: cleanHtml, title, target, mode: 'ranked', roomCode: code }
  io_.to(p1SocketId).emit('ranked:matched', { ...payload, opponent: { name: p2Entry.name, elo: p2Entry.elo } })
  io_.to(p2SocketId).emit('ranked:matched', { ...payload, opponent: { name: p1Data.name, elo: p1Data.elo } })
}
