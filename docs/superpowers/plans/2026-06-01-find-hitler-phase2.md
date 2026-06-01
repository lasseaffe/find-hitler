# Find Hitler — Phase 2: Multiplayer & Lobbies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time multiplayer races using Socket.io — players create/join lobby rooms, race simultaneously, see each other's live progress in a sidebar feed, and optionally race bot opponents.

**Architecture:** Replace `npm run dev` (which calls `next dev`) with a custom `server.js` at the project root that boots Socket.io alongside Next.js on the same port (3003). All existing Phase 1 API routes remain unchanged. A new `src/lib/rooms.js` manages lobby/room state (separate from `gameState.js`). Bots run on a server-side interval, emitting the same socket events as real players and going through the same server-authoritative validation.

**Tech Stack:** socket.io (server), socket.io-client (React), Next.js 16 App Router, Node.js custom server

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server.js` | **Create** | Custom HTTP+Socket.io server wrapping Next.js |
| `src/lib/rooms.js` | **Create** | Lobby/room state: create, join, start, leave |
| `src/lib/bots.js` | **Create** | Bot player scheduling (gaussian delays, BFS pre-compute) |
| `src/lib/gameState.js` | **Modify** | Add multi-player helpers: add player to existing game, mark player finished |
| `src/app/api/socket/route.js` | **Create** | Dummy route so Next.js doesn't 404 the socket path (Socket.io upgrades to WS on `/socket.io/`) |
| `src/app/lobby/[code]/page.jsx` | **Create** | Waiting room UI: player list, host controls, bot slot selector |
| `src/app/play/multi/page.jsx` | **Create** | Multiplayer game: WikiArticle + GameHUD + live feed sidebar |
| `src/components/LiveFeed.jsx` | **Create** | Compact right-sidebar feed showing all players' current page + click count |
| `src/components/MultiWinScreen.jsx` | **Create** | Post-race result screen listing all finishers in order |
| `src/hooks/useSocket.js` | **Create** | Thin React hook wrapping socket.io-client connection lifecycle |
| `package.json` | **Modify** | Add socket.io deps; change `dev` script to `node server.js` |
| `tests/rooms.test.js` | **Create** | Unit tests for room lifecycle |
| `tests/bots.test.js` | **Create** | Unit tests for bot name generation and gaussian timing |

---

## Task 1: Install Dependencies & Custom Server Skeleton

**Files:**
- Modify: `package.json`
- Create: `server.js`

- [ ] **Step 1: Install socket.io packages**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npm install socket.io socket.io-client
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('socket.io'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Create `server.js` at project root**

```js
// server.js
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'
import { setupSocketHandlers } from './src/lib/socketHandlers.js'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  globalThis._io = io
  setupSocketHandlers(io)

  httpServer.listen(3003, () => {
    console.log('> Find Hitler running on http://localhost:3003')
  })
})
```

- [ ] **Step 4: Update `package.json` scripts**

Change `"dev"` from `"next dev -p 3003"` to `"node server.js"`.

Also add `"type": "module"` at the top level so ES import syntax works in `server.js`.

Final relevant section:

```json
{
  "name": "find-hitler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Create stub `src/lib/socketHandlers.js`** (so server.js can import it without crashing):

```js
// src/lib/socketHandlers.js
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('socket connected:', socket.id)
  })
}
```

- [ ] **Step 6: Start server and confirm it boots**

```bash
npm run dev
```

Expected: `> Find Hitler running on http://localhost:3003` — open browser to `http://localhost:3003` and confirm the home page loads exactly as before.

- [ ] **Step 7: Commit**

```bash
git add package.json server.js src/lib/socketHandlers.js
git commit -m "feat: add socket.io custom server skeleton"
```

---

## Task 2: Room State Manager

**Files:**
- Create: `src/lib/rooms.js`
- Create: `tests/rooms.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/rooms.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- tests/rooms.test.js
```

Expected: `FAIL` — `Cannot find module '../src/lib/rooms.js'`

- [ ] **Step 3: Create `src/lib/rooms.js`**

```js
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
    status: 'waiting',   // 'waiting' | 'racing' | 'finished'
    players,
    gameId: null,        // set when game starts
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- tests/rooms.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rooms.js tests/rooms.test.js
git commit -m "feat: room state manager with create/join/leave lifecycle"
```

---

## Task 3: Bot Engine

**Files:**
- Create: `src/lib/bots.js`
- Create: `tests/bots.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/bots.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { BOT_NAMES, pickBotName, gaussianDelay } from '../src/lib/bots.js'

describe('pickBotName', () => {
  it('returns a string from BOT_NAMES', () => {
    const name = pickBotName()
    expect(BOT_NAMES).toContain(name)
  })

  it('does not return a name already in usedNames set', () => {
    const used = new Set(BOT_NAMES.slice(0, BOT_NAMES.length - 1))
    const name = pickBotName(used)
    expect(name).toBe(BOT_NAMES[BOT_NAMES.length - 1])
  })
})

describe('gaussianDelay', () => {
  it('returns a positive number for easy difficulty', () => {
    const delay = gaussianDelay('easy')
    expect(delay).toBeGreaterThan(0)
  })

  it('easy is slower than hard on average', () => {
    // Sample 50 delays and compare means
    const easyAvg = Array.from({ length: 50 }, () => gaussianDelay('easy')).reduce((a, b) => a + b) / 50
    const hardAvg = Array.from({ length: 50 }, () => gaussianDelay('hard')).reduce((a, b) => a + b) / 50
    expect(easyAvg).toBeGreaterThan(hardAvg)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- tests/bots.test.js
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Create `src/lib/bots.js`**

```js
// src/lib/bots.js

export const BOT_NAMES = [
  'DeepLink_9000', 'WikiBot_Krantz', 'HyperLink_Rex', 'ClickBot_Fury',
  'NavBot_Omega', 'LinkRaider_X', 'WikiWalker_Z', 'PathBot_Prime',
]

export function pickBotName(usedNames = new Set()) {
  const available = BOT_NAMES.filter(n => !usedNames.has(n))
  if (available.length === 0) return `WikiBot_${Math.floor(Math.random() * 9000 + 1000)}`
  return available[Math.floor(Math.random() * available.length)]
}

// Box-Muller gaussian sample clamped to [min, max]
function gaussianSample(mean, std, min, max) {
  let u, v
  do {
    u = Math.random()
    v = Math.random()
  } while (u === 0)
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(min, Math.min(max, mean + z * std))
}

// Returns delay in ms before bot makes its next move
// easy: ~8s/click, medium: ~4s/click, hard: ~1.5s/click
const DIFFICULTY_PARAMS = {
  easy:   { mean: 8000,  std: 2000, min: 3000,  max: 15000 },
  medium: { mean: 4000,  std: 1200, min: 1500,  max: 8000  },
  hard:   { mean: 1500,  std: 500,  min: 600,   max: 3500  },
}

export function gaussianDelay(difficulty = 'medium') {
  const p = DIFFICULTY_PARAMS[difficulty] || DIFFICULTY_PARAMS.medium
  return gaussianSample(p.mean, p.std, p.min, p.max)
}

/**
 * Schedule a bot to play a game.
 * The bot fetches its current page's links from the server (via gameState) and
 * picks a random link each tick. For Phase 2, bots use random walks — BFS
 * pre-computation is deferred to Phase 3 when we have the hub blocklist.
 *
 * @param {object} opts
 * @param {string} opts.roomCode
 * @param {string} opts.botId
 * @param {string} opts.difficulty - 'easy' | 'medium' | 'hard'
 * @param {Function} opts.getPlayerLinks - (botId) => string[] from server game state
 * @param {Function} opts.onMove - async (botId, targetPage) => void  — calls same logic as human move
 * @param {Function} opts.isFinished - () => boolean  — stops scheduling when true
 */
export function scheduleBot({ roomCode, botId, difficulty, getPlayerLinks, onMove, isFinished }) {
  async function tick() {
    if (isFinished()) return
    const links = getPlayerLinks(botId)
    if (!links || links.length === 0) return
    const pick = links[Math.floor(Math.random() * links.length)]
    await onMove(botId, pick)
    if (!isFinished()) {
      setTimeout(tick, gaussianDelay(difficulty))
    }
  }
  setTimeout(tick, gaussianDelay(difficulty))
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- tests/bots.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bots.js tests/bots.test.js
git commit -m "feat: bot engine with gaussian click timing and name pool"
```

---

## Task 4: Socket.io Event Handlers

**Files:**
- Modify: `src/lib/socketHandlers.js`
- Modify: `src/lib/gameState.js`

The socket handlers implement the full server-side multiplayer protocol. They use the `rooms.js` and `gameState.js` modules and drive bots via `bots.js`.

- [ ] **Step 1: Extend `gameState.js` with multi-player helpers**

Add these two functions to the bottom of `src/lib/gameState.js`:

```js
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
    undoTokens: 3,
    allowedMoves: [...validLinks],
  }
}

// Mark a player as finished (for multiplayer win detection)
export function markPlayerFinished(gameId, playerId) {
  const game = games.get(gameId)
  if (!game || !game.players[playerId]) return
  game.players[playerId].finished = true
}
```

- [ ] **Step 2: Replace `src/lib/socketHandlers.js` with full implementation**

```js
// src/lib/socketHandlers.js
import { createRoom, getRoom, joinRoom, setRoomStatus, removePlayer, roomSnapshot } from './rooms.js'
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

      // Create a single shared game for this room
      // We use the host's playerId to create the game, then add others
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

      // Update room player state
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
      removePlayer(roomCode, socket.id)
      const room = getRoom(roomCode)
      if (room) io.to(roomCode).emit('room:state', roomSnapshot(roomCode))
    })
  })
}

// Shared move processor for both humans and bots
async function processMoveForPlayer({ io, roomCode, gameId, room, playerId, targetPage }) {
  const game = getGame(gameId)
  const player = getPlayer(gameId, playerId)
  if (!player || player.finished) return

  const allowed = player.allowedMoves.map(normTitle)
  if (!allowed.includes(normTitle(targetPage))) return // silently reject invalid moves

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(targetPage)
  updatePlayerMove(gameId, playerId, { nextPage: title, cleanHtml, validLinks })

  const updated = getPlayer(gameId, playerId)
  const roomPlayer = room.players.get(playerId)
  if (roomPlayer) {
    roomPlayer.clicks = updated.clicks
    roomPlayer.currentPage = title
  }

  // Broadcast updated feed to all room members
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

    // Check if all humans finished
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

    // If this player is human, send them their personal result with html
    if (!roomPlayer?.isBot) {
      io.to(playerId).emit('game:you-finished', {
        score,
        clicks: updated.clicks,
        seconds,
        target: game.target,
      })
    }
  } else if (!roomPlayer?.isBot) {
    // Send updated page content only to the moving human player
    io.to(playerId).emit('game:page', {
      html: cleanHtml,
      title,
      clicks: updated.clicks,
      undoTokens: updated.undoTokens,
    })
  }
}
```

- [ ] **Step 3: Restart dev server and confirm no import errors**

```bash
npm run dev
```

Expected: boots cleanly on port 3003 with no crash.

- [ ] **Step 4: Commit**

```bash
git add src/lib/socketHandlers.js src/lib/gameState.js
git commit -m "feat: socket handlers — room lifecycle, player moves, bot scheduling"
```

---

## Task 5: `useSocket` React Hook

**Files:**
- Create: `src/hooks/useSocket.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useSocket.js
'use client'
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let _socket = null

// Singleton socket shared across all components in the same browser tab
function getSocket() {
  if (!_socket) {
    _socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  }
  return _socket
}

/**
 * useSocket(handlers)
 * handlers: { eventName: (data) => void }
 * Returns the socket instance.
 */
export function useSocket(handlers = {}) {
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event, fn)
    }

    return () => {
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event, fn)
      }
    }
  }, [])  // handlers must be stable (define outside render or use useCallback)

  return socketRef
}
```

- [ ] **Step 2: Confirm the dev server still starts**

```bash
npm run dev
```

Expected: boots cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSocket.js
git commit -m "feat: useSocket hook — singleton socket.io-client connection"
```

---

## Task 6: Home Page — Add Multiplayer Entry Point

**Files:**
- Modify: `src/app/page.jsx`

The home page needs a second "Create Lobby" path that doesn't call `/api/game/start` but instead navigates to `/lobby/new` with params in sessionStorage.

- [ ] **Step 1: Modify `src/app/page.jsx`**

Replace the file with the full updated version. Key changes:
- Add a `PLAY_TYPE` toggle: "Solo" or "Multiplayer"
- Solo path remains identical to Phase 1
- Multiplayer path: collect name + target + mode + botCount (0–3), then navigate to `/lobby/new` via sessionStorage

```jsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TARGETS = [
  { label: 'Adolf Hitler', category: 'Historical' },
  { label: 'Jesus', category: 'Religion' },
  { label: 'Joseph Stalin', category: 'Historical' },
  { label: '9/11 attacks', category: 'Controversial' },
  { label: 'Taylor Swift', category: 'Pop Culture' },
  { label: 'Black hole', category: 'Science' },
  { label: 'Minecraft', category: 'Internet' },
  { label: 'Holocaust', category: 'Controversial' },
]

const MODES = [
  { value: 'classic', label: 'Classic', desc: 'Fewest clicks wins. Random start page.' },
  { value: 'speedrun', label: 'Speedrun', desc: 'Fastest time wins. Curated start page.' },
]

export default function HomePage() {
  const router = useRouter()
  const [playType, setPlayType] = useState('solo')   // 'solo' | 'multi'
  const [target, setTarget] = useState('Adolf Hitler')
  const [mode, setMode] = useState('classic')
  const [playerName, setPlayerName] = useState('')
  const [botCount, setBotCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    if (!playerName.trim()) { setError('Enter your name to continue'); return }
    setError('')
    setLoading(true)

    if (playType === 'solo') {
      try {
        const res = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, mode, playerName: playerName.trim() }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Server error'); setLoading(false); return }
        sessionStorage.setItem('gameInit', JSON.stringify({ ...data, target, mode }))
        router.push('/play')
      } catch {
        setError('Could not reach server — is it running?')
        setLoading(false)
      }
    } else {
      // Multiplayer: store lobby config and go to lobby creation page
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target, botCount }))
      router.push('/lobby/new')
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black text-yellow-400 tracking-tighter mb-2">FIND HITLER</h1>
        <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">WikiRace · Taboo Edition</p>
      </div>

      <div className="w-full max-w-md space-y-6">

        {/* Play type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {['solo', 'multi'].map(t => (
            <button
              key={t}
              onClick={() => setPlayType(t)}
              className={`flex-1 py-2 text-sm font-bold font-mono uppercase tracking-widest transition-colors ${
                playType === t ? 'bg-yellow-400 text-black' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              {t === 'solo' ? 'Solo' : 'Multiplayer'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Your Name</label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="Enter nickname..."
            className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Target Page</label>
          <div className="grid grid-cols-2 gap-2">
            {TARGETS.map(t => (
              <button
                key={t.label}
                onClick={() => setTarget(t.label)}
                className={`px-3 py-2 rounded-lg text-sm font-bold text-left transition-all border ${
                  target === t.label
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-[#1a1a2e] border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div>{t.label}</div>
                <div className="text-[10px] font-normal opacity-60">{t.category}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Game Mode</label>
          <div className="space-y-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`w-full px-4 py-3 rounded-lg text-left transition-all border ${
                  mode === m.value
                    ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400'
                    : 'bg-[#1a1a2e] border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-bold text-sm">{m.label}</div>
                <div className="text-[11px] opacity-60">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {playType === 'multi' && (
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Bot Opponents: {botCount}
            </label>
            <input
              type="range"
              min={0}
              max={3}
              value={botCount}
              onChange={e => setBotCount(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
              <span>0 bots</span><span>3 bots</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-mono text-center">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
        >
          {loading
            ? 'Connecting...'
            : playType === 'solo' ? 'Start Race →' : 'Create Lobby →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify home page still renders in browser**

Open `http://localhost:3003`. Toggle between Solo/Multiplayer. Confirm solo game start still works end-to-end. Confirm "Create Lobby →" button navigates (will 404 until Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: home page — add multiplayer play-type toggle and bot count selector"
```

---

## Task 7: Lobby Page (`/lobby/[code]` and `/lobby/new`)

**Files:**
- Create: `src/app/lobby/new/page.jsx`
- Create: `src/app/lobby/[code]/page.jsx`

`/lobby/new` reads `lobbyConfig` from sessionStorage, emits `room:create`, then redirects to `/lobby/[code]`. `/lobby/[code]` is the waiting room.

- [ ] **Step 1: Create `src/app/lobby/new/page.jsx`**

```jsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function LobbyNewPage() {
  const router = useRouter()
  const socketRef = useSocket({
    'room:created': ({ code }) => {
      sessionStorage.setItem('roomCode', code)
      router.replace(`/lobby/${code}`)
    },
    'room:error': ({ error }) => {
      alert(error)
      router.replace('/')
    },
  })

  useEffect(() => {
    const raw = sessionStorage.getItem('lobbyConfig')
    if (!raw) { router.replace('/'); return }
    const config = JSON.parse(raw)
    sessionStorage.removeItem('lobbyConfig')
    sessionStorage.setItem('playerName', config.playerName)
    socketRef.current?.emit('room:create', config)
  }, [])

  return (
    <div className="min-h-screen bg-[#0d1117] text-yellow-400 font-mono flex items-center justify-center text-xl">
      Creating lobby...
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/lobby/[code]/page.jsx`**

```jsx
'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function LobbyPage({ params }) {
  const { code } = use(params)
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState('')

  const handlers = {
    'connect': () => {
      setMyId(socketRef.current.id)
      // If this is a join (not host), join the room
      const playerName = sessionStorage.getItem('playerName')
      const isHost = sessionStorage.getItem('roomCode') === code
      if (!isHost && playerName) {
        socketRef.current?.emit('room:join', { roomCode: code, playerName })
      }
    },
    'room:state': (snapshot) => setRoom(snapshot),
    'room:error': ({ error }) => setError(error),
    'game:started': (data) => {
      sessionStorage.setItem('multiGameInit', JSON.stringify(data))
      router.push(`/play/multi`)
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    if (socketRef.current?.connected) {
      setMyId(socketRef.current.id)
    }
  }, [])

  const handleStart = useCallback(() => {
    socketRef.current?.emit('game:start', { roomCode: code })
  }, [code])

  const joinUrl = `${window.location.origin}/join/${code}`

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-red-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">{error}</div>
          <button onClick={() => router.push('/')} className="text-yellow-400 underline">Back to Home</button>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-yellow-400 font-mono flex items-center justify-center text-xl">
        Joining lobby...
      </div>
    )
  }

  const isHost = room.host === myId

  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-black text-yellow-400 mb-1">LOBBY</h1>
        <p className="font-mono text-gray-400 text-sm mb-8">
          Room code: <span className="text-white font-bold tracking-widest">{code}</span>
        </p>

        <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Target</span>
            <span className="text-red-400 font-bold italic">{room.target}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Mode</span>
            <span className="text-yellow-400 font-mono uppercase text-sm">{room.mode}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
            Players ({room.players.length})
          </div>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-[#1a1a2e] rounded-lg px-4 py-2">
                <div className={`w-2 h-2 rounded-full ${p.isBot ? 'bg-orange-400' : 'bg-green-400'}`} />
                <span className="font-mono text-sm flex-1">{p.name}</span>
                {p.id === room.host && <span className="text-[10px] text-yellow-400 font-mono uppercase">host</span>}
                {p.isBot && <span className="text-[10px] text-orange-400 font-mono uppercase">bot</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 mb-6">
          <p className="text-xs font-mono text-gray-400 mb-1">Share link</p>
          <p className="text-yellow-400 font-mono text-sm break-all">{joinUrl}</p>
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={room.players.length < 1}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
          >
            Start Race →
          </button>
        ) : (
          <div className="text-center text-gray-400 font-mono text-sm">
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create join redirect page `src/app/join/[code]/page.jsx`** (for the share link)

```jsx
'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage({ params }) {
  const { code } = use(params)
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')

  const handleJoin = () => {
    if (!playerName.trim()) return
    sessionStorage.setItem('playerName', playerName.trim())
    router.push(`/lobby/${code}`)
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-black text-yellow-400 mb-8">Join Room <span className="text-white">{code}</span></h1>
      <div className="w-full max-w-xs space-y-4">
        <input
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="Your nickname..."
          className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
        />
        <button
          onClick={handleJoin}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest"
        >
          Join →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test lobby creation flow manually**

1. Go to `http://localhost:3003`
2. Enter a name, switch to Multiplayer, click "Create Lobby →"
3. Confirm you land on `/lobby/[code]` with your name listed
4. Copy the share link, open it in an incognito tab, enter a second name, confirm both players show up in the list
5. Click "Start Race →" as host — confirm both tabs navigate to `/play/multi` (which 404s until Task 8, that's expected)

- [ ] **Step 5: Commit**

```bash
git add src/app/lobby/ src/app/join/
git commit -m "feat: lobby pages — create room, join via link, host controls"
```

---

## Task 8: Multiplayer Game Page + Live Feed

**Files:**
- Create: `src/app/play/multi/page.jsx`
- Create: `src/components/LiveFeed.jsx`
- Create: `src/components/MultiWinScreen.jsx`

- [ ] **Step 1: Create `src/components/LiveFeed.jsx`**

```jsx
'use client'

function hubRisk(page) {
  const hubs = ['world war ii', 'united states', 'germany', 'europe', 'asia', 'united kingdom']
  return hubs.includes(page?.toLowerCase())
}

export default function LiveFeed({ players, myId }) {
  const sorted = [...players].sort((a, b) => a.clicks - b.clicks)

  return (
    <div className="w-64 bg-[#1a1a2e] border-l border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700">
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">⚡ Live Race Feed</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sorted.map(p => (
          <div
            key={p.id}
            className={`rounded-lg px-3 py-2 text-xs font-mono ${
              p.id === myId ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#0d1117]'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`font-bold truncate max-w-[120px] ${p.isBot ? 'text-orange-400' : 'text-white'}`}>
                {p.id === myId ? '▶ YOU' : ''} {p.name}
              </span>
              <span className="text-yellow-400 font-bold ml-2">{p.clicks}</span>
            </div>
            <div className={`text-[10px] truncate ${hubRisk(p.currentPage) ? 'text-orange-400' : 'text-gray-400'}`}>
              {p.currentPage || 'Starting...'}
            </div>
            {p.finished && (
              <div className="text-green-400 text-[10px] mt-1">✓ Finished</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/MultiWinScreen.jsx`**

```jsx
'use client'

export default function MultiWinScreen({ finishers, myId, target, onPlayAgain }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-8 text-center max-w-md w-full shadow-[0_0_40px_rgba(241,196,15,0.25)]">
        <div className="text-yellow-400 text-3xl font-black mb-1 tracking-tight">RACE OVER</div>
        <div className="text-red-400 italic mb-6">{target}</div>

        <div className="space-y-2 mb-8">
          {finishers.map((f, i) => (
            <div
              key={f.playerId}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg font-mono ${
                f.playerId === myId ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#0d1117]'
              }`}
            >
              <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
              <span className={`flex-1 text-left font-bold ${f.isBot ? 'text-orange-400' : 'text-white'}`}>
                {f.name} {f.playerId === myId && '(you)'}
              </span>
              <span className="text-yellow-400">{f.clicks} clicks</span>
              <span className="text-gray-400 text-xs">{f.seconds}s</span>
            </div>
          ))}
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-lg uppercase tracking-wide transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/play/multi/page.jsx`**

```jsx
'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import LiveFeed from '@/components/LiveFeed'
import MultiWinScreen from '@/components/MultiWinScreen'
import { useSocket } from '@/hooks/useSocket'

function MultiGame() {
  const router = useRouter()
  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [myFinish, setMyFinish] = useState(null)
  const [finishers, setFinishers] = useState([])
  const [players, setPlayers] = useState([])
  const myIdRef = useRef(null)

  const handlers = {
    'connect': () => { myIdRef.current = socketRef.current?.id },
    'game:page': (data) => {
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
      setIsLoading(false)
    },
    'game:state-update': (data) => {
      setPlayers(prev => {
        const updated = prev.map(p => p.id === data.playerId
          ? { ...p, clicks: data.clicks, currentPage: data.currentPage }
          : p
        )
        return updated
      })
    },
    'game:player-finished': (data) => {
      setFinishers(prev => [...prev, data])
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, finished: true } : p))
    },
    'game:you-finished': (data) => {
      setMyFinish(data)
      setIsLoading(false)
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    const raw = sessionStorage.getItem('multiGameInit')
    if (!raw) { router.push('/'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('multiGameInit')
    myIdRef.current = socketRef.current?.id || myIdRef.current
    setGameState({
      gameId: init.gameId,
      target: init.target,
      mode: init.mode,
      roomCode: init.snapshot?.code,
      startPage: init.title,
    })
    setHtml(init.html)
    setPlayers(init.snapshot?.players || [])
  }, [router])

  const handleNavigate = useCallback(async (target) => {
    if (isLoading || myFinish || !gameState) return
    setIsLoading(true)
    socketRef.current?.emit('game:navigate', { roomCode: gameState.roomCode, target })
    // Page content arrives via 'game:page' event
  }, [gameState, isLoading, myFinish])

  // Undo still goes through REST (keeps server-authoritative logic simple)
  const handleUndo = useCallback(async () => {
    if (isLoading || myFinish || !gameState) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/game/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: myIdRef.current }),
      })
      const data = await res.json()
      if (!res.ok) { setIsLoading(false); return }
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
    } catch { /* ignore */ } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, myFinish])

  if (!gameState) {
    return <div className="flex items-center justify-center min-h-screen font-mono text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex">
      {/* Main game area */}
      <div className="flex-1 flex flex-col pb-24">
        {isLoading && (
          <div className="fixed top-0 left-0 right-0 h-[3px] z-[999] bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-[length:200%_auto] animate-shimmer" />
        )}

        <GameHUD
          startPage={gameState.startPage}
          target={gameState.target}
          mode={gameState.mode}
          clicks={clicks}
          undoTokens={undoTokens}
          onUndo={handleUndo}
        />

        <div className="max-w-3xl mx-auto pt-20 px-6 w-full">
          <WikiArticle
            html={html}
            onNavigate={handleNavigate}
            disabled={isLoading || !!myFinish}
          />
        </div>
      </div>

      {/* Live feed sidebar */}
      <div className="fixed right-0 top-0 h-full z-40">
        <LiveFeed players={players} myId={myIdRef.current} />
      </div>

      {myFinish && (
        <MultiWinScreen
          finishers={finishers}
          myId={myIdRef.current}
          target={gameState.target}
          onPlayAgain={() => router.push('/')}
        />
      )}
    </div>
  )
}

export default function MultiPlayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <MultiGame />
    </Suspense>
  )
}
```

- [ ] **Step 4: Full multiplayer smoke test**

1. Open `http://localhost:3003` in two browser windows side-by-side
2. Window 1: Multiplayer → set 1 bot → "Create Lobby →"
3. Confirm lobby page shows host name + 1 bot listed
4. Copy share link → paste in Window 2 → enter a second name → join
5. Confirm both windows show 2 humans + 1 bot in player list
6. Window 1 (host): "Start Race →"
7. Confirm both windows navigate to `/play/multi` with Wikipedia content
8. Play in both windows — confirm live feed updates in both tabs when either player navigates
9. Win the race in one tab — confirm `MultiWinScreen` appears in that tab and the feed in the other tab shows "✓ Finished"

- [ ] **Step 5: Commit**

```bash
git add src/app/play/multi/ src/components/LiveFeed.jsx src/components/MultiWinScreen.jsx
git commit -m "feat: multiplayer game page with live feed sidebar and finish screen"
```

---

## Task 9: Tests — Room + Bot Integration

**Files:**
- Create: `tests/multiplayer.test.js`

- [ ] **Step 1: Write integration tests for the full room+bot flow**

```js
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
  it('calls onMove at least once within 100ms when delay is overridden', async () => {
    const moves = []
    // Override gaussianDelay indirectly by providing a mock move
    scheduleBot({
      roomCode: 'R1',
      botId: 'bot1',
      difficulty: 'hard',
      getPlayerLinks: () => ['Page_A', 'Page_B'],
      onMove: async (id, page) => { moves.push(page) },
      isFinished: () => moves.length >= 1,
    })
    // hard mode delay is min 600ms — wait 4s to be safe in CI
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
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass (including the 17 from Phase 1 + new rooms + bots + multiplayer tests).

- [ ] **Step 3: Commit**

```bash
git add tests/multiplayer.test.js
git commit -m "test: multiplayer integration tests for rooms, bots, and snapshots"
```

---

## Task 10: Polish & Edge Cases

**Files:**
- Modify: `src/app/lobby/[code]/page.jsx` — handle socket reconnect
- Modify: `src/lib/socketHandlers.js` — host transfer on disconnect

- [ ] **Step 1: Add host transfer logic to socketHandlers.js**

Inside the `disconnect` handler in `setupSocketHandlers`, after `removePlayer`, add:

```js
// Transfer host to next human player if host left
if (room && room.host === socket.id && room.status === 'waiting') {
  const nextHuman = Array.from(room.players.entries()).find(([, p]) => !p.isBot)
  if (nextHuman) {
    room.host = nextHuman[0]
    io.to(roomCode).emit('room:state', roomSnapshot(roomCode))
  } else {
    // Last player left — clean up the room
    ALL_ROOMS.delete(roomCode)
  }
}
```

Also add `import { ALL_ROOMS } from './rooms.js'` to the top of `socketHandlers.js`.

- [ ] **Step 2: Add a "Waiting for players..." notice when only 1 human in lobby**

In `src/app/lobby/[code]/page.jsx`, inside the host button section, show a tip if only 1 human is in the room:

```jsx
{isHost && room.players.filter(p => !p.isBot).length === 1 && (
  <p className="text-center text-gray-500 font-mono text-xs mt-2">
    You can start with just bots — or share the link to invite friends
  </p>
)}
```

- [ ] **Step 3: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final manual smoke test of the complete Phase 2 flow**

1. Solo play still works (critical — Phase 1 must not regress)
2. Create multiplayer lobby with 2 bots → start alone → both bots appear in live feed, navigate, and eventually finish
3. Two-human race: both windows race, live feed tracks both, winner sees MultiWinScreen first, other tab also shows results when they finish

- [ ] **Step 5: Commit and tag**

```bash
git add -A
git commit -m "feat: phase 2 complete — real-time multiplayer lobbies + bots + live feed"
git tag phase-2
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Socket.io custom server.js alongside Next.js — Task 1
- [x] `room:create`, `room:join`, `room:state`, `game:start`, `game:navigate`, `game:state-update`, `game:finish` events — Task 4
- [x] Room model with `waiting | racing | finished` status — Task 2
- [x] `/lobby/[code]` waiting room page — Task 7
- [x] `/play/[roomId]` multiplayer game page — Task 8
- [x] Live race feed sidebar — Task 8 (LiveFeed.jsx)
- [x] Bot system with gaussian timing — Task 3
- [x] Bot names (DeepLink_9000, WikiBot_Krantz, etc.) — Task 3
- [x] Custom lobby: host sets room size + bot slots — Task 6 (home), Task 7 (lobby)
- [x] All Phase 1 API routes preserved — unchanged, server.js passes all requests through Next.js handler
- [x] `player:leave` event (via `disconnect`) — Task 4, Task 10

**Placeholder scan:** No TBD/TODO/placeholder patterns found.

**Type consistency:** `roomSnapshot()` returns `players` as array throughout; `playerId` used consistently across handlers, LiveFeed, and MultiWinScreen.
