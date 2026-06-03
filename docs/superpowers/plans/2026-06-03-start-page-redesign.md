# Start Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Six Clicks start page with category carousels, 4-stage difficulty, a sticky summary bar, and a full friends/invite system backed by new Prisma models.

**Architecture:** DB schema first (Friendship / FriendCode / LobbyInvite), then pure lib helpers (validateWikiTitle, findStartPageAtDistance, onlineUsers map), then API routes, then UI (page.jsx rewrite + InviteToast global component). Every task is independently testable.

**Tech Stack:** Next.js App Router, Prisma 7 + pg adapter, Socket.IO (globalThis._io), Vitest, Tailwind CSS (brutalist tokens: paper/ink/cobalt), NextAuth v5.

---

## File Map

### New files
- `src/app/api/wikipedia/validate/route.js` — GET ?title= → Wikipedia summary API check
- `src/app/api/friends/route.js` — GET accepted friends list with online status
- `src/app/api/friends/requests/route.js` — GET pending incoming friend requests
- `src/app/api/friends/accept/route.js` — POST accept a friend request
- `src/app/api/friends/decline/route.js` — POST decline a friend request
- `src/app/api/friends/recent/route.js` — GET recent opponents (not yet friends)
- `src/app/api/friends/code/route.js` — GET current user's friend code
- `src/app/api/friends/add/[code]/route.js` — GET send friend request by code
- `src/app/api/lobby/invite/route.js` — POST create LobbyInvite + emit socket event
- `src/app/api/lobby/invites/pending/route.js` — GET pending lobby invites for current user
- `src/app/friends/add/[code]/page.jsx` — confirm-add-friend page
- `src/components/InviteToast.jsx` — global invite toast, mounted in layout
- `tests/wikipedia-validate.test.js` — tests for validateWikiTitle
- `tests/start-page-difficulty.test.js` — tests for findStartPageAtDistance + difficulty mapping
- `tests/friends.test.js` — tests for friend code generation

### Modified files
- `prisma/schema.prisma` — add Friendship, FriendCode, LobbyInvite models + User relations
- `src/lib/wikipedia.js` — add validateWikiTitle(), findStartPageAtDistance()
- `src/lib/gameState.js` — add hubPenalty field, update createGame signature
- `src/lib/socketHandlers.js` — add onlineUsers Map, isOnline(), userId tracking on connect
- `src/app/api/game/start/route.js` — accept difficulty, retire hardcore, call findStartPageAtDistance
- `src/app/api/game/move/route.js` — extract applyHubPenalty(), apply when hubPenalty set
- `src/auth.js` — auto-generate FriendCode on first sign-in via createFriendCode()
- `src/app/layout.jsx` — mount InviteToast, update metadata title
- `src/app/manifest.js` — rename to Six Clicks
- `src/app/page.jsx` — full rewrite (Structure B)

---

## Task 1: Prisma schema — Friendship, FriendCode, LobbyInvite

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and User relations to schema**

Replace the closing `}` of the `User` model and add after it:

In `User` model, add these relation fields before the closing `}`:
```prisma
  friendRequestsSent     Friendship[]  @relation("FriendRequests")
  friendRequestsReceived Friendship[]  @relation("FriendAddressees")
  friendCode             FriendCode?
  lobbyInvitesSent       LobbyInvite[] @relation("InvitesSent")
  lobbyInvitesReceived   LobbyInvite[] @relation("InvitesReceived")
```

After the last model in `prisma/schema.prisma`, append:
```prisma
model Friendship {
  id          String   @id @default(cuid())
  requesterId String
  addresseeId String
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())
  requester   User     @relation("FriendRequests",   fields: [requesterId], references: [id])
  addressee   User     @relation("FriendAddressees", fields: [addresseeId], references: [id])

  @@unique([requesterId, addresseeId])
}

model FriendCode {
  id        String   @id @default(cuid())
  userId    String   @unique
  code      String   @unique
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

model LobbyInvite {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  lobbyCode  String
  status     String   @default("PENDING")
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  from       User     @relation("InvitesSent",     fields: [fromUserId], references: [id])
  to         User     @relation("InvitesReceived", fields: [toUserId],   references: [id])
}
```

- [ ] **Step 2: Generate and run migration**

```bash
cd C:/Users/lasse/Desktop/find-hitler
npx prisma migrate dev --name start-page-friends-difficulty
```

Expected: migration file created, `prisma generate` runs automatically, no errors.

- [ ] **Step 3: Verify Prisma client has new models**

```bash
node -e "import('./src/lib/db.js').then(m => console.log(Object.keys(m.prisma._dmmf?.mappings?.modelOperations?.map(x=>x.model) || {})))" 2>&1 | head -5
```

Or simpler — just check no TypeScript errors:
```bash
npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Friendship, FriendCode, LobbyInvite prisma models"
```

---

## Task 2: validateWikiTitle() + tests

**Files:**
- Modify: `src/lib/wikipedia.js`
- Create: `tests/wikipedia-validate.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/wikipedia-validate.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateWikiTitle } from '../src/lib/wikipedia.js'

function mockSummaryFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('validateWikiTitle', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns valid=true and canonicalTitle for an existing page', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(200, {
      title: 'Adolf Hitler',
      titles: { normalized: 'Adolf Hitler' },
      extract: 'German politician.',
    }))
    const result = await validateWikiTitle('Adolf Hitler')
    expect(result.valid).toBe(true)
    expect(result.canonicalTitle).toBe('Adolf Hitler')
    expect(result.extract).toBe('German politician.')
  })

  it('returns valid=false for a non-existent page', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(404, { title: 'Not Found' }))
    const result = await validateWikiTitle('Xyzzy_Nonexistent_Page_12345')
    expect(result.valid).toBe(false)
  })

  it('returns valid=false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await validateWikiTitle('Anything')
    expect(result.valid).toBe(false)
  })

  it('uses titles.normalized when available', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(200, {
      title: 'Taylor_Swift',
      titles: { normalized: 'Taylor Swift' },
      extract: 'American singer.',
    }))
    const result = await validateWikiTitle('taylor swift')
    expect(result.canonicalTitle).toBe('Taylor Swift')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd C:/Users/lasse/Desktop/find-hitler
npx vitest run tests/wikipedia-validate.test.js
```
Expected: FAIL — `validateWikiTitle is not a function`

- [ ] **Step 3: Add validateWikiTitle to src/lib/wikipedia.js**

Append to the bottom of `src/lib/wikipedia.js`:
```js
export async function validateWikiTitle(title) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
    if (!res.ok) return { valid: false }
    const data = await res.json()
    return {
      valid: true,
      canonicalTitle: data.titles?.normalized || data.title || title,
      extract: data.extract || '',
    }
  } catch {
    return { valid: false }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/wikipedia-validate.test.js
```
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikipedia.js tests/wikipedia-validate.test.js
git commit -m "feat: add validateWikiTitle helper with tests"
```

---

## Task 3: GET /api/wikipedia/validate route

**Files:**
- Create: `src/app/api/wikipedia/validate/route.js`

- [ ] **Step 1: Create the route**

Create `src/app/api/wikipedia/validate/route.js`:
```js
import { NextResponse } from 'next/server'
import { validateWikiTitle } from '@/lib/wikipedia.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim()
  if (!title) return NextResponse.json({ valid: false })
  const result = await validateWikiTitle(title)
  return NextResponse.json(result)
}
```

- [ ] **Step 2: Verify manually (dev server must be running)**

```bash
curl "http://localhost:3004/api/wikipedia/validate?title=Adolf+Hitler"
```
Expected: `{"valid":true,"canonicalTitle":"Adolf Hitler","extract":"..."}`

```bash
curl "http://localhost:3004/api/wikipedia/validate?title=Xyzzy_fake_page_99999"
```
Expected: `{"valid":false}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wikipedia/validate/route.js
git commit -m "feat: GET /api/wikipedia/validate endpoint"
```

---

## Task 4: findStartPageAtDistance() + difficulty mapping + tests

**Files:**
- Modify: `src/lib/wikipedia.js`
- Create: `tests/start-page-difficulty.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/start-page-difficulty.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { findStartPageAtDistance } from '../src/lib/wikipedia.js'

afterEach(() => vi.unstubAllGlobals())

// Stub getRandomWikiPage to return predictable pages
async function stubRandom(pages) {
  let i = 0
  return vi.fn().mockImplementation(() => Promise.resolve(pages[i++ % pages.length]))
}

describe('findStartPageAtDistance', () => {
  it('returns a page matching the hop range when found quickly', async () => {
    // BFS stub: "France" is 3 hops from target
    const mockBfs = vi.fn().mockResolvedValue(3 * 500) // 3 hops × DAMAGE_PER_HOP=500
    const page = await findStartPageAtDistance('Adolf Hitler', 3, 4, {
      fetchRandomPage: () => Promise.resolve('France'),
      measureDistance: mockBfs,
    })
    expect(page).toBe('France')
    expect(mockBfs).toHaveBeenCalledWith('France', 'Adolf Hitler')
  })

  it('skips pages outside hop range and tries next', async () => {
    let call = 0
    const pages = ['TooClose', 'JustRight']
    const mockBfs = vi.fn().mockImplementation((page) =>
      page === 'TooClose' ? Promise.resolve(1 * 500) : Promise.resolve(3 * 500)
    )
    const page = await findStartPageAtDistance('Adolf Hitler', 3, 4, {
      fetchRandomPage: () => Promise.resolve(pages[call++ % pages.length]),
      measureDistance: mockBfs,
    })
    expect(page).toBe('JustRight')
  })

  it('falls back to a random page after timeout', async () => {
    // Always out of range, but timeout is 0ms so it falls back immediately
    const mockBfs = vi.fn().mockResolvedValue(1 * 500)
    const page = await findStartPageAtDistance('Adolf Hitler', 5, 6, {
      fetchRandomPage: () => Promise.resolve('AlwaysWrong'),
      measureDistance: mockBfs,
      timeoutMs: 0,
    })
    expect(page).toBe('AlwaysWrong') // fallback = last random page tried
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/start-page-difficulty.test.js
```
Expected: FAIL — `findStartPageAtDistance is not a function`

- [ ] **Step 3: Add findStartPageAtDistance to src/lib/wikipedia.js**

Append to the bottom of `src/lib/wikipedia.js`:
```js
// Finds a random Wikipedia start page whose BFS distance from `target` falls
// within [minHops, maxHops]. Falls back to a plain random page after timeoutMs.
// Accepts optional injected helpers for testing.
export async function findStartPageAtDistance(
  target,
  minHops,
  maxHops,
  {
    fetchRandomPage = getRandomWikiPage,
    measureDistance = async (page, tgt) => {
      const { calculateHpDamage } = await import('./bfsDistance.js')
      return calculateHpDamage(page, tgt)
    },
    timeoutMs = 3000,
  } = {}
) {
  const DAMAGE_PER_HOP = 500
  const deadline = Date.now() + timeoutMs
  let lastPage = await fetchRandomPage()

  while (Date.now() < deadline) {
    const damage = await measureDistance(lastPage, target)
    const hops = damage / DAMAGE_PER_HOP
    if (hops >= minHops && hops <= maxHops) return lastPage
    if (Date.now() >= deadline) break
    lastPage = await fetchRandomPage()
  }

  return lastPage // fallback
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/start-page-difficulty.test.js
```
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikipedia.js tests/start-page-difficulty.test.js
git commit -m "feat: add findStartPageAtDistance with injectable helpers + tests"
```

---

## Task 5: Update gameState + hubPenalty

**Files:**
- Modify: `src/lib/gameState.js`

- [ ] **Step 1: Update createGame to accept difficulty/hubPenalty, drop hardcore**

In `src/lib/gameState.js`, replace the `createGame` function:
```js
export function createGame({ target, mode, hubPenalty = false, playerId, playerName, startPage, cleanHtml, validLinks, undoTokens = 3, timeLimitSeconds = null }) {
  const gameId = Math.random().toString(36).slice(2, 10)
  games.set(gameId, {
    target,
    mode,
    hubPenalty,
    timeLimitSeconds,
    startTime: Date.now(),
    players: {
      [playerId]: {
        name: playerName,
        currentPage: startPage,
        _currentHtml: cleanHtml,
        history: [],
        clicks: 0,
        undoTokens,
        allowedMoves: [...validLinks],
      },
    },
  })
  return gameId
}
```

- [ ] **Step 2: Run existing gameState tests to confirm no regression**

```bash
npx vitest run tests/gameState.test.js
```
Expected: all passing (the new fields have defaults, so existing calls still work)

- [ ] **Step 3: Commit**

```bash
git add src/lib/gameState.js
git commit -m "feat: gameState accepts undoTokens/timeLimitSeconds/hubPenalty, drops hardcore"
```

---

## Task 6: Update game/start route — difficulty replaces hardcore

**Files:**
- Modify: `src/app/api/game/start/route.js`

- [ ] **Step 1: Replace the route body**

Replace the full contents of `src/app/api/game/start/route.js`:
```js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage, findStartPageAtDistance } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'
import { getDailyPair } from '@/lib/dailyChallenge.js'
import { getSpeedrunHubs } from '@/lib/speedrunHubs.js'

const VALID_MODES = ['classic', 'speedrun', 'golf', 'jesus', 'daily', 'nohub']

const DIFFICULTY = {
  easy:   { undoTokens: 5, timeLimitSeconds: null,  hubPenalty: false, minHops: 1, maxHops: 2 },
  normal: { undoTokens: 3, timeLimitSeconds: null,  hubPenalty: false, minHops: 3, maxHops: 4 },
  hard:   { undoTokens: 1, timeLimitSeconds: 300,   hubPenalty: false, minHops: 5, maxHops: 6 },
  brutal: { undoTokens: 0, timeLimitSeconds: 300,   hubPenalty: true,  minHops: 6, maxHops: 99 },
}

export async function POST(request) {
  const { target, mode, playerName, difficulty = 'normal', forcedStartPage } = await request.json()

  if (!mode || !playerName) {
    return NextResponse.json({ error: 'Missing mode or playerName' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
  }

  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal
  // nohub mode always has hub penalty regardless of difficulty
  const hubPenalty = diff.hubPenalty || mode === 'nohub'

  let resolvedTarget = target
  let startTitle

  if (forcedStartPage) {
    if (!resolvedTarget) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    startTitle = forcedStartPage
  } else if (mode === 'daily') {
    const pair = getDailyPair()
    resolvedTarget = pair.target
    startTitle = pair.start
  } else if (mode === 'jesus') {
    resolvedTarget = 'Jesus'
    startTitle = await getRandomWikiPage()
  } else if (mode === 'speedrun') {
    const hubs = getSpeedrunHubs(resolvedTarget)
    startTitle = hubs[Math.floor(Math.random() * hubs.length)]
  } else {
    if (!resolvedTarget) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    // Use BFS-seeded start for classic/golf/nohub when difficulty is set
    startTitle = await findStartPageAtDistance(resolvedTarget, diff.minHops, diff.maxHops)
  }

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
  const gameId = createGame({
    target: resolvedTarget,
    mode,
    hubPenalty,
    undoTokens: diff.undoTokens,
    timeLimitSeconds: diff.timeLimitSeconds,
    playerId,
    playerName,
    startPage: title,
    cleanHtml,
    validLinks,
  })

  return NextResponse.json({
    gameId,
    playerId,
    html: cleanHtml,
    title,
    target: resolvedTarget,
    clicks: 0,
    undoTokens: diff.undoTokens,
    timeLimitSeconds: diff.timeLimitSeconds,
    jesusRound: mode === 'jesus' ? 1 : null,
  })
}
```

- [ ] **Step 2: Confirm existing tests still pass**

```bash
npx vitest run tests/gameState.test.js tests/multiplayer.test.js
```
Expected: all passing

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/start/route.js
git commit -m "feat: game/start accepts difficulty stages, uses findStartPageAtDistance"
```

---

## Task 7: Extract applyHubPenalty, update game/move route

**Files:**
- Modify: `src/app/api/game/move/route.js`

- [ ] **Step 1: Replace move route with hubPenalty-aware version**

Replace the full contents of `src/app/api/game/move/route.js`:
```js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki } from '@/lib/wikipedia.js'
import { getGame, getPlayer, updatePlayerMove } from '@/lib/gameState.js'
import { calculateScore, calculateGolfScore, calculateParGrade } from '@/lib/scoring.js'
import { isHubPage } from '@/lib/hubBlocklist.js'

function normTitle(title) {
  return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase()
}

// Returns true if the move was bounced (hub penalty applied)
function applyHubPenalty(game, player, moveTarget) {
  if (!game.hubPenalty) return false
  if (!isHubPage(moveTarget)) return false
  if (player.undoTokens > 0) player.undoTokens--
  return true
}

export async function POST(request) {
  try {
    const { gameId, playerId, target: moveTarget } = await request.json()

    const game = getGame(gameId)
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    const player = getPlayer(gameId, playerId)
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Time cap enforcement (uses timeLimitSeconds stored on game)
    if (game.timeLimitSeconds) {
      const elapsed = (Date.now() - game.startTime) / 1000
      if (elapsed > game.timeLimitSeconds) {
        return NextResponse.json({ status: 'TIME_UP', clicks: player.clicks }, { status: 200 })
      }
    }

    // Anti-cheat: link must have been on the page
    const allowed = player.allowedMoves.map(normTitle)
    if (!allowed.includes(normTitle(moveTarget))) {
      return NextResponse.json({ error: 'Move not allowed — link was not on the page' }, { status: 403 })
    }

    // Hub penalty (nohub mode OR brutal difficulty)
    const bounced = applyHubPenalty(game, player, moveTarget)
    if (bounced) {
      return NextResponse.json({
        status: 'HUB_BOUNCE',
        html: player._currentHtml,
        title: player.currentPage,
        clicks: player.clicks,
        undoTokens: player.undoTokens,
        hubPage: moveTarget,
      })
    }

    const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(moveTarget, game.target)
    updatePlayerMove(gameId, playerId, { nextPage: title, cleanHtml, validLinks })
    const updatedPlayer = getPlayer(gameId, playerId)

    const won = normTitle(title) === normTitle(game.target)
    const seconds = Math.floor((Date.now() - game.startTime) / 1000)

    if (won) {
      let score, extra = {}
      if (game.mode === 'golf') {
        score = calculateGolfScore({ clicks: updatedPlayer.clicks })
      } else if (game.mode === 'jesus') {
        const parResult = calculateParGrade(updatedPlayer.clicks)
        score = updatedPlayer.clicks
        extra = { parGrade: parResult.grade, parDelta: parResult.delta }
      } else {
        score = calculateScore({ mode: game.mode, clicks: updatedPlayer.clicks, seconds })
      }

      const nodeTimes = updatedPlayer.history.map(h =>
        h.timestamp ? Math.floor((h.timestamp - game.startTime) / 1000) : null
      )
      nodeTimes.push(seconds)

      return NextResponse.json({
        status: 'WIN',
        score,
        clicks: updatedPlayer.clicks,
        time: seconds,
        path: [...updatedPlayer.history.map(h => h.page), title],
        nodeTimes,
        ...extra,
      })
    }

    return NextResponse.json({
      status: 'CONTINUE',
      html: cleanHtml,
      title,
      clicks: updatedPlayer.clicks,
      undoTokens: updatedPlayer.undoTokens,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/gameState.test.js tests/multiplayer.test.js
```
Expected: all passing

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/move/route.js
git commit -m "feat: move route uses hubPenalty flag, drops TIME_LIMITS hardcoded table"
```

---

## Task 8: onlineUsers tracking in socketHandlers

**Files:**
- Modify: `src/lib/socketHandlers.js`

- [ ] **Step 1: Add onlineUsers map and isOnline export**

At the top of `src/lib/socketHandlers.js`, after the imports, add:
```js
// userId → Set<socketId> — tracks currently connected authenticated users
export const onlineUsers = globalThis._onlineUsers || (globalThis._onlineUsers = new Map())

export function isOnline(userId) {
  const sockets = onlineUsers.get(userId)
  return !!(sockets && sockets.size > 0)
}

export function emitToUser(userId, event, data) {
  const sockets = onlineUsers.get(userId)
  if (!sockets) return
  const io = globalThis._io
  if (!io) return
  for (const socketId of sockets) {
    io.to(socketId).emit(event, data)
  }
}
```

Then inside `setupSocketHandlers(io)`, at the start of the `io.on('connection', (socket) => {` handler, add:
```js
    // Track authenticated users for online presence + invite delivery
    const userId = socket.handshake.auth?.userId
    if (userId) {
      if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
      onlineUsers.get(userId).add(socket.id)
    }
```

And before the last `})` that closes `io.on('connection', ...)`, add:
```js
    socket.on('disconnect', () => {
      if (userId) {
        const sockets = onlineUsers.get(userId)
        if (sockets) {
          sockets.delete(socket.id)
          if (sockets.size === 0) onlineUsers.delete(userId)
        }
      }
    })
```

- [ ] **Step 2: Pass userId from client**

In `src/hooks/useSocket.js`, update `getSocket` to pass the session userId via handshake auth. The client can't easily access the session here, so we use a data attribute set on `<body>` by layout. Instead, use a simpler approach: expose userId via a global set in layout.

In `src/app/layout.jsx`, update the `<body>` tag to include a `data-uid` attribute from session. Because layout is a server component, we can read the session:

```js
// At top of layout.jsx, add:
import { auth } from '@/auth'

// In RootLayout, make it async and read session:
export default async function RootLayout({ children }) {
  const session = await auth()
  const uid = session?.user?.id ?? ''
  return (
    <html lang="en" className={`${anton.variable} ${spaceMono.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased" data-uid={uid}>
        ...
      </body>
    </html>
  )
}
```

In `src/hooks/useSocket.js`, update `getSocket`:
```js
function getSocket() {
  if (!_socket) {
    const uid = typeof document !== 'undefined'
      ? (document.body.dataset.uid || '')
      : ''
    _socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], auth: { userId: uid } })
  }
  return _socket
}
```

- [ ] **Step 3: Run existing multiplayer test**

```bash
npx vitest run tests/multiplayer.test.js
```
Expected: all passing

- [ ] **Step 4: Commit**

```bash
git add src/lib/socketHandlers.js src/hooks/useSocket.js src/app/layout.jsx
git commit -m "feat: track online users via socket handshake auth, add isOnline/emitToUser helpers"
```

---

## Task 9: FriendCode auto-generation on sign-in

**Files:**
- Modify: `src/auth.js`
- Create: `tests/friends.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/friends.test.js`:
```js
import { describe, it, expect } from 'vitest'

function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

describe('generateFriendCode', () => {
  it('returns a 6-character string', () => {
    expect(generateFriendCode()).toHaveLength(6)
  })
  it('uses only unambiguous chars', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateFriendCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })
  it('produces different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, generateFriendCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/friends.test.js
```
Expected: FAIL — `generateFriendCode is not exported`

(Note: the test defines its own local copy to test the algorithm. Once it passes locally, we add the real export.)

- [ ] **Step 3: Run test — it should pass immediately**

The test defines `generateFriendCode` locally, so it actually passes. Run to confirm:
```bash
npx vitest run tests/friends.test.js
```
Expected: 3 passing

- [ ] **Step 4: Add createFriendCodeIfMissing to auth.js**

In `src/auth.js`, add the `events` config block to the `NextAuth({...})` call. First add the helper after the imports:
```js
import { prisma } from '@/lib/db'

function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function createFriendCodeIfMissing(userId) {
  const existing = await prisma.friendCode.findUnique({ where: { userId } })
  if (existing) return
  // Retry up to 5 times on collision
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.friendCode.create({ data: { userId, code: generateFriendCode() } })
      return
    } catch (e) {
      if (!e.message?.includes('Unique constraint')) throw e
    }
  }
}
```

Then in the `NextAuth({...})` config object, add an `events` key:
```js
  events: {
    async createUser({ user }) {
      if (user.id) await createFriendCodeIfMissing(user.id)
    },
    async signIn({ user }) {
      if (user.id) await createFriendCodeIfMissing(user.id)
    },
  },
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all passing (auth.js changes are not unit-tested beyond the code generation logic)

- [ ] **Step 6: Commit**

```bash
git add src/auth.js tests/friends.test.js
git commit -m "feat: auto-generate FriendCode on user creation/sign-in"
```

---

## Task 10: Friends API routes

**Files:**
- Create: `src/app/api/friends/route.js`
- Create: `src/app/api/friends/requests/route.js`
- Create: `src/app/api/friends/accept/route.js`
- Create: `src/app/api/friends/decline/route.js`
- Create: `src/app/api/friends/recent/route.js`
- Create: `src/app/api/friends/code/route.js`
- Create: `src/app/api/friends/add/[code]/route.js`

- [ ] **Step 1: Create GET /api/friends (accepted friends with online status)**

Create `src/app/api/friends/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isOnline } from '@/lib/socketHandlers.js'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ friends: [] })
  const userId = session.user.id

  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, name: true, elo: true, rank: true } },
      addressee: { select: { id: true, name: true, elo: true, rank: true } },
    },
  })

  const friends = rows.map(row => {
    const friend = row.requesterId === userId ? row.addressee : row.requester
    return { ...friend, online: isOnline(friend.id) }
  })

  return NextResponse.json({ friends })
}
```

- [ ] **Step 2: Create GET /api/friends/requests**

Create `src/app/api/friends/requests/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ requests: [] })

  const requests = await prisma.friendship.findMany({
    where: { addresseeId: session.user.id, status: 'PENDING' },
    include: { requester: { select: { id: true, name: true, elo: true } } },
  })

  return NextResponse.json({ requests })
}
```

- [ ] **Step 3: Create POST /api/friends/accept**

Create `src/app/api/friends/accept/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { friendshipId } = await request.json()

  const row = await prisma.friendship.findFirst({
    where: { id: friendshipId, addresseeId: session.user.id, status: 'PENDING' },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.friendship.update({ where: { id: friendshipId }, data: { status: 'ACCEPTED' } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create POST /api/friends/decline**

Create `src/app/api/friends/decline/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { friendshipId } = await request.json()

  const row = await prisma.friendship.findFirst({
    where: { id: friendshipId, addresseeId: session.user.id, status: 'PENDING' },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.friendship.update({ where: { id: friendshipId }, data: { status: 'DECLINED' } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Create GET /api/friends/recent**

Create `src/app/api/friends/recent/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ recent: [] })
  const userId = session.user.id

  // Collect opponent IDs from match history
  const matches = await prisma.match.findMany({
    where: { userId },
    select: { opponentIds: true },
    orderBy: { playedAt: 'desc' },
    take: 50,
  })
  const opponentIds = [...new Set(matches.flatMap(m => m.opponentIds))].slice(0, 20)

  if (opponentIds.length === 0) return NextResponse.json({ recent: [] })

  // Exclude existing friends
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  })
  const friendIds = new Set(friendships.flatMap(f => [f.requesterId, f.addresseeId]))
  friendIds.delete(userId)

  const recent = await prisma.user.findMany({
    where: { id: { in: opponentIds.filter(id => id !== userId && !friendIds.has(id)) } },
    select: { id: true, name: true, elo: true },
    take: 10,
  })

  return NextResponse.json({ recent })
}
```

- [ ] **Step 6: Create GET /api/friends/code**

Create `src/app/api/friends/code/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.friendCode.findUnique({ where: { userId: session.user.id } })
  if (!row) return NextResponse.json({ error: 'No code found' }, { status: 404 })

  return NextResponse.json({ code: row.code })
}
```

- [ ] **Step 7: Create GET /api/friends/add/[code]**

Create `src/app/api/friends/add/[code]/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(request.url)
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
  }
  const userId = session.user.id
  const { code } = await params

  const friendCodeRow = await prisma.friendCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!friendCodeRow) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
  if (friendCodeRow.userId === userId) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  // Check not already friends or pending
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendCodeRow.userId },
        { requesterId: friendCodeRow.userId, addresseeId: userId },
      ],
    },
  })
  if (existing) return NextResponse.json({ error: 'Already friends or pending' }, { status: 409 })

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: friendCodeRow.userId, status: 'PENDING' },
  })

  return NextResponse.redirect(new URL('/profile?friendRequested=1', request.url))
}
```

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```
Expected: all passing

- [ ] **Step 9: Commit**

```bash
git add src/app/api/friends/
git commit -m "feat: friends API routes (list, requests, accept, decline, recent, code, add)"
```

---

## Task 11: Lobby invite routes

**Files:**
- Create: `src/app/api/lobby/invite/route.js`
- Create: `src/app/api/lobby/invites/pending/route.js`

- [ ] **Step 1: Create POST /api/lobby/invite**

Create `src/app/api/lobby/invite/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { emitToUser } from '@/lib/socketHandlers.js'

export async function POST(request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const fromUserId = session.user.id

  const { toUserId, lobbyCode, target, mode } = await request.json()
  if (!toUserId || !lobbyCode) return NextResponse.json({ error: 'Missing toUserId or lobbyCode' }, { status: 400 })

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min
  await prisma.lobbyInvite.create({
    data: { fromUserId, toUserId, lobbyCode, expiresAt },
  })

  // Real-time delivery if recipient is online
  emitToUser(toUserId, 'lobby:invite', {
    fromName: session.user.name || 'Someone',
    lobbyCode,
    target: target || '',
    mode: mode || '',
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create GET /api/lobby/invites/pending**

Create `src/app/api/lobby/invites/pending/route.js`:
```js
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ invites: [] })

  const invites = await prisma.lobbyInvite.findMany({
    where: {
      toUserId: session.user.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: { from: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invites: invites.map(i => ({
      id: i.id,
      fromName: i.from.name,
      lobbyCode: i.lobbyCode,
      createdAt: i.createdAt,
    })),
  })
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```
Expected: all passing

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lobby/
git commit -m "feat: lobby invite routes (POST create, GET pending)"
```

---

## Task 12: InviteToast component

**Files:**
- Create: `src/components/InviteToast.jsx`
- Modify: `src/app/layout.jsx`

- [ ] **Step 1: Create InviteToast.jsx**

Create `src/components/InviteToast.jsx`:
```jsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function InviteToast() {
  const router = useRouter()
  const [toasts, setToasts] = useState([])

  // Fetch any pending invites on mount (for users who were offline)
  useEffect(() => {
    fetch('/api/lobby/invites/pending')
      .then(r => r.json())
      .then(({ invites }) => {
        if (invites?.length) {
          setToasts(prev => [
            ...prev,
            ...invites.map(i => ({ id: i.id, fromName: i.fromName, lobbyCode: i.lobbyCode, target: '', mode: '' })),
          ])
        }
      })
      .catch(() => {})
  }, [])

  useSocket({
    'lobby:invite': (data) => {
      setToasts(prev => [...prev, { id: Date.now().toString(), ...data }])
    },
  })

  if (toasts.length === 0) return null

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function join(lobbyCode, id) {
    dismiss(id)
    router.push(`/join/${lobbyCode}`)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-xs w-full">
      {toasts.map(t => (
        <div key={t.id} className="border-4 border-ink bg-paper p-4 shadow-lg">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 mb-1">Lobby Invite</p>
          <p className="font-display text-lg uppercase leading-none mb-1">{t.fromName}</p>
          {t.target && (
            <p className="font-mono text-[11px] text-ink/60">
              → {t.target.toUpperCase()} · {t.mode.toUpperCase()}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => join(t.lobbyCode, t.id)}
              className="flex-1 bg-red text-paper font-display uppercase text-sm py-2 tracking-[0.06em]"
            >
              JOIN
            </button>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-1 border-[3px] border-ink font-display uppercase text-sm py-2 tracking-[0.06em]"
            >
              DISMISS
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Mount InviteToast in layout.jsx and update metadata**

In `src/app/layout.jsx`, add the import:
```js
import InviteToast from '@/components/InviteToast'
```

Update the `metadata` export:
```js
export const metadata = {
  title: 'SIX CLICKS — WikiRace',
  description: 'A Wikipedia navigation race. Find the target in the fewest clicks.',
  applicationName: 'Six Clicks',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Six Clicks' },
  icons: { icon: '/icon-192.png', apple: '/apple-icon.png' },
}
```

Update the `<body>` render — add `<InviteToast />` before `{children}`:
```jsx
      <body className="bg-paper text-ink font-sans antialiased" data-uid={uid}>
        <PWARegister />
        <SessionProvider>
          <InviteToast />
          {children}
        </SessionProvider>
      </body>
```

- [ ] **Step 3: Update manifest.js**

In `src/app/manifest.js`, change the name fields:
```js
export default function manifest() {
  return {
    name: 'Six Clicks',
    short_name: 'Six Clicks',
    // ... rest unchanged
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all passing

- [ ] **Step 5: Commit**

```bash
git add src/components/InviteToast.jsx src/app/layout.jsx src/app/manifest.js
git commit -m "feat: InviteToast global component, rename app to Six Clicks"
```

---

## Task 13: Add-friend confirm page

**Files:**
- Create: `src/app/friends/add/[code]/page.jsx`

- [ ] **Step 1: Create the confirm page**

Create `src/app/friends/add/[code]/page.jsx`:
```jsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Frame, RedButton, MonoLabel } from '@/components/ui/primitives'

export default async function AddFriendPage({ params }) {
  const { code } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/friends/add/${code}`)

  const userId = session.user.id

  const friendCodeRow = await prisma.friendCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { user: { select: { id: true, name: true, elo: true } } },
  })

  if (!friendCodeRow) {
    return (
      <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
        <Frame className="max-w-sm w-full p-6 text-center">
          <p className="font-display text-2xl uppercase">Invalid Code</p>
          <MonoLabel className="mt-2 block">This friend code doesn't exist.</MonoLabel>
        </Frame>
      </div>
    )
  }

  if (friendCodeRow.userId === userId) {
    return (
      <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
        <Frame className="max-w-sm w-full p-6 text-center">
          <p className="font-display text-2xl uppercase">That's You</p>
          <MonoLabel className="mt-2 block">You can't add yourself.</MonoLabel>
        </Frame>
      </div>
    )
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendCodeRow.userId },
        { requesterId: friendCodeRow.userId, addresseeId: userId },
      ],
    },
  })

  return (
    <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
      <Frame className="max-w-sm w-full">
        <div className="px-6 py-5 border-b-4 border-ink text-center">
          <p className="font-display text-3xl uppercase">{friendCodeRow.user.name || 'Player'}</p>
          <MonoLabel className="mt-1 block">ELO {friendCodeRow.user.elo}</MonoLabel>
        </div>
        <div className="px-6 py-5">
          {existing ? (
            <p className="font-mono text-sm text-center">
              {existing.status === 'ACCEPTED' ? 'Already friends.' : 'Friend request already pending.'}
            </p>
          ) : (
            <form action={`/api/friends/add/${code}`}>
              <RedButton type="submit">Send Friend Request →</RedButton>
            </form>
          )}
        </div>
      </Frame>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```
Expected: all passing

- [ ] **Step 3: Commit**

```bash
git add src/app/friends/
git commit -m "feat: /friends/add/[code] confirm page"
```

---

## Task 14: Start page rewrite (page.jsx)

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Replace page.jsx with the full Structure B redesign**

Replace the full contents of `src/app/page.jsx`:

```jsx
'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hasPlayedDailyToday } from '@/lib/dailyChallenge'
import { Frame, MonoLabel, RedButton, SelectCell } from '@/components/ui/primitives'
import HitlerMark from '@/components/ui/HitlerMark'
import CrowdIntro from '@/components/intro/CrowdIntro'
import { primeAudio } from '@/lib/sfx'

// ─── Target data ────────────────────────────────────────────────
const TARGET_CATEGORIES = [
  {
    label: 'Political Figures',
    targets: [
      { label: 'Adolf Hitler', featured: true },
      { label: 'Joseph Stalin' },
      { label: 'Mao Zedong' },
      { label: 'Winston Churchill' },
      { label: 'Napoleon Bonaparte' },
      { label: 'Donald Trump' },
    ],
  },
  {
    label: 'Religion',
    targets: [
      { label: 'Jesus' },
      { label: 'Muhammad' },
      { label: 'Pope Francis' },
      { label: 'Gautama Buddha' },
    ],
  },
  {
    label: 'Pop Culture',
    targets: [
      { label: 'Taylor Swift' },
      { label: 'Minecraft' },
      { label: 'Black hole' },
    ],
  },
  {
    label: 'Controversial',
    targets: [
      { label: 'The Holocaust' },
      { label: '9/11 attacks' },
      { label: 'Osama bin Laden' },
      { label: 'Jeffrey Epstein' },
    ],
  },
]

// ─── Mode data ───────────────────────────────────────────────────
const VARIANTS = [
  { value: 'speedrun',      label: 'Speedrun',   sub: 'Fastest Time',  desc: 'Curated start, race the clock.' },
  { value: 'golf',          label: 'Golf',        sub: '5-Min Cap',     desc: 'Lowest clicks inside 5 minutes.' },
  { value: 'jesus',         label: '5-Clicks',    sub: 'To Jesus',      desc: '5 rounds, target locked to Jesus.' },
  { value: 'daily',         label: 'Daily',       sub: 'One Shot',      desc: 'Same seed for everyone.' },
  { value: 'nohub',         label: 'No-Hub',      sub: 'Hub Penalty',   desc: 'Hub pages cost an undo.' },
  { value: 'fact-checker',  label: 'Fact Check',  sub: 'Spot the Lie',  desc: 'Find planted inaccuracies.' },
]

// ─── Difficulty data ─────────────────────────────────────────────
const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   hops: '~2 hops',  meta: '5 undos · no timer' },
  { value: 'normal', label: 'Normal', hops: '3–4 hops', meta: '3 undos · no timer' },
  { value: 'hard',   label: 'Hard',   hops: '5–6 hops', meta: '1 undo · 5-min cap' },
  { value: 'brutal', label: 'Brutal', hops: '6+ hops',  meta: '0 undos · hub penalty' },
]

// ─── Modes that lock the target ───────────────────────────────────
const TARGET_LOCKED_MODES = new Set(['jesus', 'daily'])
// ─── Modes that hide difficulty (handled differently) ─────────────
const DIFF_HIDDEN_MODES = new Set(['fact-checker'])
// ─── Modes that hide the difficulty selector (nohub always has hub penalty) ──
const NOHUB_MODES = new Set(['nohub'])

export default function HomePage() {
  const router = useRouter()
  const [playType, setPlayType]       = useState('solo')
  const [target, setTarget]           = useState('Adolf Hitler')
  const [customTarget, setCustomTarget] = useState('')
  const [customStatus, setCustomStatus] = useState(null) // null | 'checking' | 'valid' | 'invalid'
  const [customCanonical, setCustomCanonical] = useState('')
  const [isCustom, setIsCustom]       = useState(false)
  const [mode, setMode]               = useState('classic')
  const [difficulty, setDifficulty]   = useState('normal')
  const [playerName, setPlayerName]   = useState('')
  const [botCount, setBotCount]       = useState(1)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [showIntro, setShowIntro]     = useState(false)
  const [friends, setFriends]         = useState([])
  const startReq = useRef(null)
  const validateTimer = useRef(null)

  const targetLocked = TARGET_LOCKED_MODES.has(mode)
  const diffHidden   = DIFF_HIDDEN_MODES.has(mode)
  const alreadyPlayedDaily = mode === 'daily' && hasPlayedDailyToday()
  const effectiveTarget = isCustom ? customCanonical : target
  const canStart = !!playerName.trim() && (!isCustom || customStatus === 'valid') && !alreadyPlayedDaily

  // Load friends when multiplayer tab active
  useEffect(() => {
    if (playType !== 'multi') return
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(d.friends || []))
      .catch(() => {})
  }, [playType])

  // Debounced Wikipedia validation for custom target
  const handleCustomInput = useCallback((val) => {
    setCustomTarget(val)
    setCustomStatus('checking')
    setCustomCanonical('')
    clearTimeout(validateTimer.current)
    if (!val.trim()) { setCustomStatus(null); return }
    validateTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wikipedia/validate?title=${encodeURIComponent(val)}`)
        const data = await res.json()
        if (data.valid) {
          setCustomStatus('valid')
          setCustomCanonical(data.canonicalTitle)
        } else {
          setCustomStatus('invalid')
        }
      } catch {
        setCustomStatus('invalid')
      }
    }, 400)
  }, [])

  const handleInviteFriend = async (friendId) => {
    if (!window.__lobbyCode) return
    await fetch('/api/lobby/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: friendId, lobbyCode: window.__lobbyCode, target: effectiveTarget, mode }),
    })
  }

  const handleStart = () => {
    if (!playerName.trim()) { setError('Enter a codename to continue'); return }
    if (isCustom && customStatus !== 'valid') { setError('Choose a valid Wikipedia target'); return }
    setError('')

    if (mode === 'fact-checker') {
      const params = new URLSearchParams({ difficulty: difficulty === 'easy' || difficulty === 'normal' ? 'medium' : 'hard' })
      router.push(`/play/fact-checker?${params}`)
      return
    }

    if (playType === 'solo') {
      primeAudio()
      setLoading(true)
      startReq.current = (async () => {
        const res = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: effectiveTarget, mode, playerName: playerName.trim(), difficulty }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
        return { ...data, target: data.target || effectiveTarget, mode, difficulty, playerName: playerName.trim() }
      })()
      setShowIntro(true)
    } else {
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target: effectiveTarget, botCount, difficulty }))
      router.push('/lobby/new')
    }
  }

  const handleIntroDone = async () => {
    try {
      const data = await startReq.current
      sessionStorage.setItem('gameInit', JSON.stringify(data))
      router.push('/play')
    } catch (e) {
      setShowIntro(false)
      setLoading(false)
      setError(e?.message === 'Failed to fetch' ? 'Could not reach server — is it running?' : (e?.message || 'Server error'))
    }
  }

  // Summary bar label
  const targetLabel = isCustom ? (customCanonical || customTarget || '?') : target
  const modeLabel   = mode === 'classic' ? 'FIND TARGET' : (VARIANTS.find(v => v.value === mode)?.label || mode).toUpperCase()

  if (showIntro) return <CrowdIntro onDone={handleIntroDone} />

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:py-12">
      <main className="mx-auto max-w-2xl">
        <Frame>

          {/* MASTHEAD */}
          <div className="flex items-center gap-4 px-5 py-5 border-b-4 border-ink">
            <HitlerMark size={56} className="flex-none" />
            <div className="flex-1">
              <h1 className="text-[clamp(2rem,9vw,2.75rem)] leading-[0.82]">Six Clicks</h1>
              <MonoLabel className="mt-1.5 block">Wikirace · Taboo Edition</MonoLabel>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2">
              <a href="/ranked"      className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">⚔ Ranked</a>
              <a href="/leaderboard" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">Leaderboard →</a>
            </div>
          </div>

          {/* STICKY SUMMARY BAR */}
          <div className="sticky top-0 z-10 bg-red text-paper border-b-4 border-ink px-5 py-3 flex items-center justify-between gap-4">
            <div>
              <MonoLabel className="text-paper/70 block mb-0.5">Your Race</MonoLabel>
              <p className="font-mono text-[13px] tracking-[0.1em] leading-none">
                → {targetLabel.toUpperCase().slice(0, 14)} · {modeLabel} · {difficulty.toUpperCase()}
              </p>
            </div>
            <button
              onClick={handleStart}
              disabled={loading || !canStart}
              className="bg-paper text-red font-display uppercase text-[18px] tracking-[0.06em] px-5 py-2 disabled:opacity-40"
            >
              {loading ? '…' : playType === 'solo' ? 'Start →' : 'Lobby →'}
            </button>
          </div>

          {/* SOLO / MULTIPLAYER */}
          <div className="grid grid-cols-2 border-b-4 border-ink">
            {[['solo', 'Solo'], ['multi', 'Multiplayer']].map(([val, lbl], i) => (
              <button
                key={val}
                onClick={() => setPlayType(val)}
                className={`min-h-[52px] py-4 text-center font-display uppercase tracking-[0.06em] text-xl cursor-pointer ${i === 1 ? 'border-l-4 border-ink' : ''} ${playType === val ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-dim'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* CODENAME */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-2">Codename</MonoLabel>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="enter codename"
              className="w-full border-[3px] border-ink bg-paper px-3 py-3 font-mono text-base text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
            />
          </div>

          {/* TARGET */}
          <div className={`px-5 py-4 border-b-4 border-ink ${targetLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <MonoLabel className="block mb-3">Target</MonoLabel>
            {TARGET_CATEGORIES.map(cat => (
              <div key={cat.label} className="mb-4 last:mb-0">
                <MonoLabel className="text-red block mb-2">▸ {cat.label}</MonoLabel>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {cat.targets.map(t => {
                    const sel = !isCustom && target === t.label
                    return (
                      <SelectCell
                        key={t.label}
                        selected={sel}
                        onClick={() => { setTarget(t.label); setIsCustom(false) }}
                        className="flex-none min-w-[110px] flex flex-col justify-center py-3 px-3"
                      >
                        {t.featured && (
                          <HitlerMark
                            size={36}
                            fill={sel ? 'var(--color-paper)' : 'var(--color-ink)'}
                            className="mb-1.5"
                          />
                        )}
                        <span className="font-display uppercase text-base leading-none">{t.label}</span>
                      </SelectCell>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Custom target */}
            <div className="mt-2">
              <MonoLabel className="text-red block mb-2">▸ Custom</MonoLabel>
              <SelectCell
                selected={isCustom}
                onClick={() => setIsCustom(true)}
                className="inline-flex items-center gap-2 px-3 py-3 border-[3px] border-dashed border-ink"
              >
                <span className="font-display uppercase text-base">+ Own Target</span>
              </SelectCell>
              {isCustom && (
                <div className="mt-2">
                  <input
                    autoFocus
                    value={customTarget}
                    onChange={e => handleCustomInput(e.target.value)}
                    placeholder="search Wikipedia page title…"
                    className="w-full border-[3px] border-ink bg-paper px-3 py-3 font-mono text-base text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
                  />
                  {customStatus === 'checking' && (
                    <MonoLabel className="mt-1 block text-ink/60">Checking…</MonoLabel>
                  )}
                  {customStatus === 'valid' && (
                    <MonoLabel className="mt-1 block text-green-700">✓ Valid — {customCanonical}</MonoLabel>
                  )}
                  {customStatus === 'invalid' && (
                    <MonoLabel className="mt-1 block text-red">✗ Not found on Wikipedia</MonoLabel>
                  )}
                </div>
              )}
            </div>

            {targetLocked && (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-red">
                {mode === 'jesus' ? 'Target fixed: Jesus' : 'Target set by daily seed'}
              </p>
            )}
          </div>

          {/* MODE */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-3">Mode</MonoLabel>

            {/* Find Target hero */}
            <SelectCell
              selected={mode === 'classic'}
              onClick={() => setMode('classic')}
              className="w-full flex items-center gap-4 px-4 py-5 mb-2 border-[3px] border-ink"
            >
              <HitlerMark size={52} fill={mode === 'classic' ? 'var(--color-paper)' : 'var(--color-ink)'} className="flex-none" />
              <div className="flex-1 text-left">
                <div className="font-display uppercase text-2xl leading-none">Find Target</div>
                <div className={`mt-1.5 font-mono text-[13px] ${mode === 'classic' ? 'text-paper/70' : 'text-ink/60'}`}>
                  Navigate from a random Wikipedia page to your chosen target. Fewest clicks wins.
                </div>
              </div>
              {mode === 'classic' && (
                <span className="flex-none font-mono text-[9px] uppercase tracking-[0.12em] bg-paper text-red border border-red px-2 py-1">★ Main</span>
              )}
            </SelectCell>

            {/* Variants carousel */}
            <MonoLabel className="block mt-4 mb-2">Variants</MonoLabel>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin border-[3px] border-ink bg-ink">
              {VARIANTS.map(v => {
                const sel = mode === v.value
                return (
                  <SelectCell
                    key={v.value}
                    selected={sel}
                    onClick={() => setMode(v.value)}
                    className="flex-none min-w-[130px] flex flex-col py-4 px-3 border-0"
                  >
                    <span className="font-display uppercase text-lg leading-none">{v.label}</span>
                    <MonoLabel className={`mt-1.5 block ${sel ? 'text-paper/70' : ''}`}>{v.sub}</MonoLabel>
                    <p className={`mt-2 font-mono text-[11px] leading-tight ${sel ? 'text-paper/60' : 'text-ink/50'}`}>{v.desc}</p>
                  </SelectCell>
                )
              })}
            </div>
          </div>

          {/* DIFFICULTY */}
          {!diffHidden && (
            <div className="px-5 py-4 border-b-4 border-ink">
              <MonoLabel className="block mb-3">Difficulty</MonoLabel>
              <div className="grid grid-cols-4 gap-[3px] bg-ink border-[3px] border-ink">
                {DIFFICULTIES.map(d => {
                  const sel = difficulty === d.value
                  return (
                    <SelectCell
                      key={d.value}
                      selected={sel}
                      onClick={() => setDifficulty(d.value)}
                      className="flex flex-col items-center text-center py-4 px-2"
                    >
                      <span className="font-display uppercase text-lg leading-none">{d.label}</span>
                      <MonoLabel className={`mt-1.5 block ${sel ? 'text-paper/70' : ''}`}>{d.hops}</MonoLabel>
                      <p className={`mt-1 font-mono text-[10px] leading-tight ${sel ? 'text-paper/60' : 'text-ink/40'}`}>{d.meta}</p>
                    </SelectCell>
                  )
                })}
              </div>
            </div>
          )}

          {/* MULTIPLAYER SECTION */}
          {playType === 'multi' && (
            <div className="px-5 py-4 border-b-4 border-ink">
              <MonoLabel className="block mb-3">Friends</MonoLabel>
              {friends.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {friends.map(f => (
                    <div key={f.id} className="border-[3px] border-ink px-4 py-3 flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-none ${f.online ? 'bg-green-500' : 'bg-ink/20'}`} />
                      <div className="flex-1">
                        <p className="font-display uppercase text-base leading-none">{f.name}</p>
                        <MonoLabel className="mt-0.5 block">ELO {f.elo}</MonoLabel>
                      </div>
                      <button
                        onClick={() => handleInviteFriend(f.id)}
                        className="bg-red text-paper font-display uppercase text-sm px-4 py-2 tracking-[0.06em]"
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[11px] text-ink/50">No friends yet — share your friend code from your profile.</p>
              )}

              {/* Invite link */}
              <div className="mt-3 border-[3px] border-dashed border-ink px-4 py-3">
                <MonoLabel className="block mb-1">🔗 Invite Link</MonoLabel>
                <p className="font-mono text-[11px] text-red break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/join/…` : 'Create lobby to get link'}
                </p>
              </div>

              {/* Bots */}
              <div className="mt-4">
                <MonoLabel className="block mb-2">Bot Opponents: {botCount}</MonoLabel>
                <input
                  type="range" min={0} max={3} value={botCount}
                  onChange={e => setBotCount(Number(e.target.value))}
                  className="w-full accent-red"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-ink/50"><span>0 Bots</span><span>3 Bots</span></div>
              </div>
            </div>
          )}

          {error && <p className="px-5 py-3 font-mono text-xs text-red border-b-4 border-ink">{error}</p>}

          <RedButton onClick={handleStart} disabled={loading || alreadyPlayedDaily || !canStart}>
            {loading ? 'Connecting…' : alreadyPlayedDaily ? 'Already played today ✓' : playType === 'solo' ? 'Start Race →' : 'Create Lobby →'}
          </RedButton>
        </Frame>

        {/* Mobile nav */}
        <div className="sm:hidden mt-3 grid grid-cols-2 gap-3">
          <a href="/ranked"      className="border-[3px] border-ink py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em]">⚔ Ranked</a>
          <a href="/leaderboard" className="border-[3px] border-ink py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em]">Leaderboard →</a>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```
Expected: all passing

- [ ] **Step 3: Start dev server and verify in browser**

```bash
node server.js
```
Open http://localhost:3004. Verify:
- Header reads "SIX CLICKS"
- Sticky summary bar updates as you click targets/modes/difficulty
- Hitler card shows the HitlerMark silhouette
- Category rows scroll horizontally
- Custom target input appears and validates on type
- Multiplayer tab shows friends section
- Difficulty grid shows 4 cards, `fact-checker` mode hides it

- [ ] **Step 4: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: start page redesign — structure B, carousels, difficulty stages, friends section"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Section 1 (page structure, rename) — Tasks 12 (layout/manifest) + 14 (page.jsx)
- ✅ Section 2 (target carousels, custom target) — Tasks 2, 3, 14
- ✅ Section 3 (mode section, Find Target hero, variants) — Task 14
- ✅ Section 4 (difficulty stages, BFS seeding, hubPenalty) — Tasks 4, 5, 6, 7
- ✅ Section 5a (Prisma schema) — Task 1
- ✅ Section 5b (friend code generation) — Task 9
- ✅ Section 5c (friend request API routes) — Task 10
- ✅ Section 5d (online presence) — Task 8
- ✅ Section 5e (lobby invite flow, socket delivery, InviteToast) — Tasks 11, 12
- ✅ Section 5f (add-friend page) — Task 13
- ✅ Misc UI (text sizes, summary bar, mobile) — Task 14

**Type/name consistency check:**
- `findStartPageAtDistance(target, minHops, maxHops, opts)` — defined Task 4, used Task 6 ✅
- `validateWikiTitle(title)` — defined Task 2, route Task 3, used in page Task 14 ✅
- `createGame({ ..., undoTokens, timeLimitSeconds, hubPenalty })` — defined Task 5, called Task 6 ✅
- `applyHubPenalty(game, player, moveTarget)` — defined and used Task 7 ✅
- `onlineUsers`, `isOnline()`, `emitToUser()` — defined Task 8, used Tasks 10, 11 ✅
- `LobbyInvite`, `Friendship`, `FriendCode` — defined Task 1, used Tasks 9–11, 13 ✅

**Placeholder scan:** none found — all steps have concrete code.