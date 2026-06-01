# Find Hitler — Phase 3: All Game Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Golf Mode, 5 Clicks to Jesus, Hardcore Modifier, Daily Challenge, No-Hub Challenge, and curated Speedrun hubs — all plugging into the existing solo + Socket.io multiplayer pipeline.

**Architecture:** New modes are implemented as server-side configuration and validation logic, not new pages. The `room.mode` / `game.mode` field already flows through every path; Phase 3 adds more valid values (`golf`, `jesus`, `daily`, `nohub`) and enforces their rules in `scoring.js`, `gameState.js`, `socketHandlers.js`, and the solo API routes. The Hardcore modifier is a boolean flag (`hardcore: true`) stored alongside the mode, not a separate mode string. A global countdown for Golf is driven by a server-side `setTimeout` that emits `game:time-up`. The `GameHUD` and home page receive new props / mode options.

**Tech Stack:** Vitest (existing), Next.js App Router API routes, Socket.io (existing), React 18 + Tailwind CSS.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/hubBlocklist.js` | **Create** | ~200 hub page titles that are blocked in No-Hub mode |
| `src/lib/speedrunHubs.js` | **Create** | Per-target curated start pages for Speedrun mode |
| `src/lib/dailyChallenge.js` | **Create** | Seeded RNG to pick today's start+end page pair |
| `src/lib/scoring.js` | **Modify** | Add Golf scoring (clicks, lower=better), Jesus par scoring |
| `src/lib/gameState.js` | **Modify** | Accept `undoTokens` override (0 for Hardcore), expose `hardcore` flag |
| `src/lib/rooms.js` | **Modify** | Store `hardcore` flag; store `timeLimitMs`; store `jesusRound` counter |
| `src/lib/socketHandlers.js` | **Modify** | Golf countdown timer; hub rejection; Jesus round transitions; Daily attempt tracking |
| `src/app/api/game/start/route.js` | **Modify** | Handle `daily`, `nohub`, `golf`, `jesus` modes; apply hardcore undo=0; use speedrunHubs for speedrun |
| `src/app/api/game/move/route.js` | **Modify** | Hub rejection (nohub mode); time-cap enforcement (golf/hardcore); Jesus win-per-round |
| `src/app/page.jsx` | **Modify** | Add new modes and Hardcore toggle to home screen |
| `src/components/GameHUD.jsx` | **Modify** | Show countdown timer (golf/hardcore); show Jesus round indicator |
| `src/components/WinScreen.jsx` | **Modify** | Show par grade for Jesus mode; show click-score for Golf |
| `tests/scoring.test.js` | **Modify** | Add Golf + Jesus par scoring tests |
| `tests/gameState.test.js` | **Modify** | Add hardcore (0 undoTokens) tests |
| `tests/hubBlocklist.test.js` | **Create** | Verify blocklist structure and lookup function |
| `tests/dailyChallenge.test.js` | **Create** | Verify same seed always returns same pair |
| `tests/phase3.test.js` | **Create** | Integration tests for nohub rejection, golf time-up, Jesus round transitions |

---

## Task 1: Hub Blocklist

**Files:**
- Create: `src/lib/hubBlocklist.js`
- Create: `tests/hubBlocklist.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/hubBlocklist.test.js
import { describe, it, expect } from 'vitest'
import { isHubPage, HUB_PAGES } from '../src/lib/hubBlocklist.js'

describe('hubBlocklist', () => {
  it('has at least 150 entries', () => {
    expect(HUB_PAGES.size).toBeGreaterThanOrEqual(150)
  })

  it('isHubPage returns true for known hubs', () => {
    expect(isHubPage('United States')).toBe(true)
    expect(isHubPage('World War II')).toBe(true)
    expect(isHubPage('Germany')).toBe(true)
    expect(isHubPage('1945')).toBe(true)
    expect(isHubPage('English language')).toBe(true)
  })

  it('isHubPage is case-insensitive and trims whitespace', () => {
    expect(isHubPage('  united states  ')).toBe(true)
    expect(isHubPage('WORLD WAR II')).toBe(true)
  })

  it('isHubPage returns false for non-hub pages', () => {
    expect(isHubPage('Coffee production in Brazil')).toBe(false)
    expect(isHubPage('Quantum entanglement')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\lasse\Desktop\find-hitler && npm test -- --reporter=verbose tests/hubBlocklist.test.js
```
Expected: FAIL — `isHubPage` not defined

- [ ] **Step 3: Create `src/lib/hubBlocklist.js`**

```js
// src/lib/hubBlocklist.js
export const HUB_PAGES = new Set([
  // Continents & regions
  'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica',
  'Middle East', 'Southeast Asia', 'Central Asia', 'East Asia', 'South Asia', 'West Africa',
  'Eastern Europe', 'Western Europe', 'Latin America', 'Caribbean',

  // Countries (top-linked)
  'United States', 'United Kingdom', 'Germany', 'France', 'Russia', 'China', 'India',
  'Japan', 'Italy', 'Spain', 'Canada', 'Australia', 'Brazil', 'Mexico', 'Poland',
  'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria',
  'Belgium', 'Portugal', 'Greece', 'Turkey', 'Israel', 'Iran', 'Iraq', 'Egypt',
  'South Africa', 'Argentina', 'Colombia', 'Chile', 'Pakistan', 'Bangladesh', 'Nigeria',
  'Indonesia', 'South Korea', 'North Korea', 'Vietnam', 'Thailand', 'Philippines',
  'Saudi Arabia', 'Ukraine', 'Romania', 'Hungary', 'Czech Republic', 'Serbia', 'Croatia',

  // Years (most linked)
  '1900', '1901', '1910', '1914', '1915', '1916', '1917', '1918', '1919', '1920',
  '1930', '1933', '1939', '1940', '1941', '1942', '1943', '1944', '1945', '1946',
  '1950', '1960', '1970', '1980', '1989', '1990', '1991', '2000', '2001', '2003',
  '2008', '2010', '2020',

  // Wikipedia mega-hubs
  'World War I', 'World War II', 'Cold War', 'Holocaust', 'Nazi Germany',
  'English language', 'Latin', 'French language', 'German language', 'Spanish language',
  'Christianity', 'Islam', 'Judaism', 'Catholicism', 'Protestant Reformation',
  'Roman Empire', 'Roman Catholic Church', 'British Empire', 'Soviet Union',
  'United Nations', 'European Union', 'NATO', 'Olympic Games', 'Nobel Prize',
  'Academy Award', 'Grammy Award',
  'Wikipedia', 'Encyclopedia', 'Biology', 'Chemistry', 'Physics', 'Mathematics',
  'History', 'Geography', 'Philosophy', 'Economics', 'Politics',
  'New York City', 'London', 'Paris', 'Berlin', 'Rome', 'Tokyo', 'Beijing',
  'Moscow', 'Los Angeles', 'Chicago', 'Sydney', 'Toronto', 'Madrid', 'Vienna',
  'Amsterdam', 'Brussels', 'Warsaw', 'Budapest', 'Prague', 'Athens',
  'President of the United States', 'Prime Minister of the United Kingdom',
  'Democratic Party (United States)', 'Republican Party (United States)',
  'Communist Party of China',
  'University', 'Harvard University', 'Oxford University', 'Cambridge University',
])

export function isHubPage(title) {
  return HUB_PAGES.has(title.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the').replace(/\bAnd\b/g, 'and'))
    || HUB_PAGES.has(title.trim())
    || [...HUB_PAGES].some(h => h.toLowerCase() === title.trim().toLowerCase())
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --reporter=verbose tests/hubBlocklist.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/hubBlocklist.js tests/hubBlocklist.test.js
git commit -m "feat: add hub blocklist for No-Hub Challenge mode"
```

---

## Task 2: Speedrun Curated Hubs

**Files:**
- Create: `src/lib/speedrunHubs.js`

No tests needed — this is a data file with a lookup function; the existing speedrun flow calls it.

- [ ] **Step 1: Create `src/lib/speedrunHubs.js`**

```js
// src/lib/speedrunHubs.js
// 5 curated start pages per target, each reachable within 4 clicks.
const HUBS = {
  'Adolf Hitler': [
    'Nazi Party', 'Weimar Republic', 'Third Reich', 'World War II', 'German nationalism',
  ],
  'Jesus': [
    'Christianity', 'Bible', 'New Testament', 'Messiah', 'Roman Empire',
  ],
  'Joseph Stalin': [
    'Soviet Union', 'Communist Party of the Soviet Union', 'Russian Revolution',
    'Bolshevik', 'Cold War',
  ],
  '9/11 attacks': [
    'Al-Qaeda', 'Terrorism', 'United States', 'George W. Bush', 'War on Terror',
  ],
  'Taylor Swift': [
    'Pop music', 'Billboard Hot 100', 'Country music', 'Grammy Award', 'American singer',
  ],
  'Black hole': [
    'General relativity', 'Astrophysics', 'Albert Einstein', 'Neutron star', 'Stephen Hawking',
  ],
  'Minecraft': [
    'Video game', 'Mojang', 'Sandbox game', 'Java (programming language)', 'Microsoft',
  ],
  'Holocaust': [
    'Nazi Germany', 'World War II', 'Adolf Hitler', 'Antisemitism', 'Concentration camp',
  ],
}

// Fallback list used when target has no curated hubs
const FALLBACK = ['History', 'Science', 'Geography', 'Politics', 'Culture']

export function getSpeedrunHubs(target) {
  return HUBS[target] || FALLBACK
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/speedrunHubs.js
git commit -m "feat: add curated speedrun hub pages per target"
```

---

## Task 3: Daily Challenge — Seeded RNG

**Files:**
- Create: `src/lib/dailyChallenge.js`
- Create: `tests/dailyChallenge.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/dailyChallenge.test.js
import { describe, it, expect } from 'vitest'
import { getDailyPair, seedFromDate } from '../src/lib/dailyChallenge.js'

describe('dailyChallenge', () => {
  it('seedFromDate produces an integer from a date string', () => {
    const seed = seedFromDate('2026-06-01')
    expect(typeof seed).toBe('number')
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThan(0)
  })

  it('same date always returns same pair', () => {
    const pair1 = getDailyPair('2026-06-01')
    const pair2 = getDailyPair('2026-06-01')
    expect(pair1.start).toBe(pair2.start)
    expect(pair1.target).toBe(pair2.target)
  })

  it('different dates return different pairs (with very high probability)', () => {
    const p1 = getDailyPair('2026-06-01')
    const p2 = getDailyPair('2026-06-02')
    // Different seeds should produce different results for at least one field
    const different = p1.start !== p2.start || p1.target !== p2.target
    expect(different).toBe(true)
  })

  it('returned pair has start and target strings', () => {
    const pair = getDailyPair('2026-06-01')
    expect(typeof pair.start).toBe('string')
    expect(typeof pair.target).toBe('string')
    expect(pair.start.length).toBeGreaterThan(0)
    expect(pair.target.length).toBeGreaterThan(0)
    expect(pair.start).not.toBe(pair.target)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --reporter=verbose tests/dailyChallenge.test.js
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/lib/dailyChallenge.js`**

```js
// src/lib/dailyChallenge.js
// Pre-curated daily pairs. Indexed by seed mod len.
const DAILY_PAIRS = [
  { start: 'Coffee', target: 'Adolf Hitler' },
  { start: 'Penguin', target: 'Jesus' },
  { start: 'Jazz', target: 'Joseph Stalin' },
  { start: 'Pizza', target: '9/11 attacks' },
  { start: 'Bicycle', target: 'Taylor Swift' },
  { start: 'Volcano', target: 'Black hole' },
  { start: 'Chess', target: 'Minecraft' },
  { start: 'Chocolate', target: 'Holocaust' },
  { start: 'Samurai', target: 'Adolf Hitler' },
  { start: 'Opera', target: 'Jesus' },
  { start: 'Tornado', target: 'Joseph Stalin' },
  { start: 'Sushi', target: '9/11 attacks' },
  { start: 'Skateboarding', target: 'Taylor Swift' },
  { start: 'Coral reef', target: 'Black hole' },
  { start: 'Origami', target: 'Minecraft' },
  { start: 'Tango', target: 'Holocaust' },
  { start: 'Pottery', target: 'Adolf Hitler' },
  { start: 'Surfing', target: 'Jesus' },
  { start: 'Accordion', target: 'Joseph Stalin' },
  { start: 'Graffiti', target: '9/11 attacks' },
  { start: 'Archery', target: 'Taylor Swift' },
  { start: 'Noodle', target: 'Black hole' },
  { start: 'Parkour', target: 'Minecraft' },
  { start: 'Calligraphy', target: 'Holocaust' },
  { start: 'Bonsai', target: 'Adolf Hitler' },
  { start: 'Lacrosse', target: 'Jesus' },
  { start: 'Flamenco', target: 'Joseph Stalin' },
  { start: 'Mango', target: '9/11 attacks' },
  { start: 'Fencing', target: 'Taylor Swift' },
  { start: 'Thermodynamics', target: 'Black hole' },
  { start: 'Breakdancing', target: 'Minecraft' },
]

export function seedFromDate(dateStr) {
  // Simple string hash
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getDailyPair(dateStr = new Date().toISOString().slice(0, 10)) {
  const seed = seedFromDate(dateStr)
  return DAILY_PAIRS[seed % DAILY_PAIRS.length]
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --reporter=verbose tests/dailyChallenge.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyChallenge.js tests/dailyChallenge.test.js
git commit -m "feat: daily challenge seeded RNG with pre-curated pairs"
```

---

## Task 4: Scoring — Golf & Jesus Par

**Files:**
- Modify: `src/lib/scoring.js`
- Modify: `tests/scoring.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/scoring.test.js`:

```js
import { calculateScore, calculateGolfScore, calculateParGrade } from '../src/lib/scoring.js'

describe('calculateGolfScore', () => {
  it('returns clicks as score (lower is better)', () => {
    expect(calculateGolfScore({ clicks: 3 })).toBe(3)
    expect(calculateGolfScore({ clicks: 7 })).toBe(7)
  })
})

describe('calculateParGrade', () => {
  it('hole-in-one at 1 click', () => {
    expect(calculateParGrade(1)).toEqual({ grade: 'Hole-in-One', delta: -4 })
  })

  it('eagle at 3 clicks', () => {
    expect(calculateParGrade(3)).toEqual({ grade: 'Eagle', delta: -2 })
  })

  it('birdie at 4 clicks', () => {
    expect(calculateParGrade(4)).toEqual({ grade: 'Birdie', delta: -1 })
  })

  it('par at 5 clicks', () => {
    expect(calculateParGrade(5)).toEqual({ grade: 'Par', delta: 0 })
  })

  it('bogey at 6 clicks', () => {
    expect(calculateParGrade(6)).toEqual({ grade: 'Bogey', delta: +1 })
  })

  it('double bogey at 7+ clicks', () => {
    expect(calculateParGrade(7)).toEqual({ grade: 'Double Bogey', delta: +2 })
    expect(calculateParGrade(10)).toEqual({ grade: 'Double Bogey', delta: +2 })
  })

  it('2 clicks is birdie (-3 from par)', () => {
    expect(calculateParGrade(2)).toEqual({ grade: 'Albatross', delta: -3 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --reporter=verbose tests/scoring.test.js
```
Expected: FAIL — `calculateGolfScore` and `calculateParGrade` not exported

- [ ] **Step 3: Update `src/lib/scoring.js`**

```js
// src/lib/scoring.js
export function calculateScore({ mode, clicks, seconds }) {
  if (mode === 'speedrun') {
    return Math.max(0, 10000 - seconds * 100 - clicks * 50)
  }
  return Math.max(0, 10000 - clicks * 500 - seconds * 10)
}

// Golf: lower clicks = better. Return raw click count as score.
export function calculateGolfScore({ clicks }) {
  return clicks
}

// 5 Clicks to Jesus: par = 5, server-authoritative grade.
export function calculateParGrade(clicks) {
  if (clicks === 1) return { grade: 'Hole-in-One', delta: -4 }
  if (clicks === 2) return { grade: 'Albatross', delta: -3 }
  if (clicks === 3) return { grade: 'Eagle', delta: -2 }
  if (clicks === 4) return { grade: 'Birdie', delta: -1 }
  if (clicks === 5) return { grade: 'Par', delta: 0 }
  if (clicks === 6) return { grade: 'Bogey', delta: +1 }
  return { grade: 'Double Bogey', delta: +2 }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --reporter=verbose tests/scoring.test.js
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.js tests/scoring.test.js
git commit -m "feat: add golf and jesus par scoring to scoring.js"
```

---

## Task 5: gameState — Hardcore Support

**Files:**
- Modify: `src/lib/gameState.js`
- Modify: `tests/gameState.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/gameState.test.js`:

```js
import { createGame, getPlayer } from '../src/lib/gameState.js'

describe('hardcore mode', () => {
  it('starts with 0 undo tokens when hardcore=true', () => {
    const gameId = createGame({
      target: 'Adolf Hitler',
      mode: 'classic',
      hardcore: true,
      playerId: 'p1',
      playerName: 'Test',
      startPage: 'Coffee',
      cleanHtml: '<p>test</p>',
      validLinks: [],
    })
    const player = getPlayer(gameId, 'p1')
    expect(player.undoTokens).toBe(0)
  })

  it('starts with 3 undo tokens when hardcore=false', () => {
    const gameId = createGame({
      target: 'Jesus',
      mode: 'classic',
      hardcore: false,
      playerId: 'p2',
      playerName: 'Test2',
      startPage: 'Coffee',
      cleanHtml: '<p>test</p>',
      validLinks: [],
    })
    const player = getPlayer(gameId, 'p2')
    expect(player.undoTokens).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --reporter=verbose tests/gameState.test.js
```
Expected: FAIL — `hardcore` not respected

- [ ] **Step 3: Update `src/lib/gameState.js` — `createGame` and `addPlayerToGame`**

```js
// src/lib/gameState.js
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
  player.history.push({
    page: player.currentPage,
    html: player._currentHtml,
    allowedMoves: [...player.allowedMoves],
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

export function markPlayerFinished(gameId, playerId) {
  const game = games.get(gameId)
  if (!game || !game.players[playerId]) return
  game.players[playerId].finished = true
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --reporter=verbose tests/gameState.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameState.js tests/gameState.test.js
git commit -m "feat: hardcore flag sets undoTokens=0 in gameState"
```

---

## Task 6: Solo API — `start` Route for New Modes

**Files:**
- Modify: `src/app/api/game/start/route.js`

- [ ] **Step 1: Update the start route**

Replace full file content:

```js
// src/app/api/game/start/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'
import { getDailyPair } from '@/lib/dailyChallenge.js'
import { getSpeedrunHubs } from '@/lib/speedrunHubs.js'

const VALID_MODES = ['classic', 'speedrun', 'golf', 'jesus', 'daily', 'nohub']

export async function POST(request) {
  const { target, mode, playerName, hardcore = false } = await request.json()

  if (!mode || !playerName) {
    return NextResponse.json({ error: 'Missing mode or playerName' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
  }

  // Daily mode: use seeded deterministic start+target
  let resolvedTarget = target
  let startTitle

  if (mode === 'daily') {
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
    // classic, golf, nohub — random start
    if (!resolvedTarget) {
      return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    }
    startTitle = await getRandomWikiPage()
  }

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
  const gameId = createGame({
    target: resolvedTarget,
    mode,
    hardcore,
    playerId,
    playerName,
    startPage: title,
    cleanHtml,
    validLinks,
  })

  // Golf: time limit is stored client-side and enforced server-side in move route
  const timeLimitSeconds = mode === 'golf' ? 300
    : (mode === 'classic' && hardcore) ? 300
    : (mode === 'speedrun' && hardcore) ? 150  // halved from uncapped speedrun (use 300s default)
    : null

  return NextResponse.json({
    gameId,
    playerId,
    html: cleanHtml,
    title,
    target: resolvedTarget,
    clicks: 0,
    undoTokens: hardcore ? 0 : 3,
    timeLimitSeconds,
    // For 5-clicks-to-Jesus: track round on client from game start
    jesusRound: mode === 'jesus' ? 1 : null,
  })
}
```

- [ ] **Step 2: Verify no test regressions**

```
npm test
```
Expected: all existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/start/route.js
git commit -m "feat: start route handles golf, jesus, daily, nohub modes"
```

---

## Task 7: Solo API — `move` Route (Hub Rejection + Time Cap + Jesus Rounds)

**Files:**
- Modify: `src/app/api/game/move/route.js`

- [ ] **Step 1: Update the move route**

Replace full file content:

```js
// src/app/api/game/move/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki } from '@/lib/wikipedia.js'
import { getGame, getPlayer, updatePlayerMove } from '@/lib/gameState.js'
import { calculateScore, calculateGolfScore, calculateParGrade } from '@/lib/scoring.js'
import { isHubPage } from '@/lib/hubBlocklist.js'

function normTitle(title) {
  return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase()
}

const TIME_LIMITS = {
  golf: 300,        // 5 minutes
  'golf-hardcore': 150, // 2:30
  'classic-hardcore': 300,
  'speedrun-hardcore': 150,
}

export async function POST(request) {
  try {
    const { gameId, playerId, target: moveTarget } = await request.json()

    const game = getGame(gameId)
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    const player = getPlayer(gameId, playerId)
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Time cap enforcement (golf and hardcore classic/speedrun)
    const timeLimitKey = game.hardcore ? `${game.mode}-hardcore` : game.mode
    const limitSeconds = TIME_LIMITS[timeLimitKey]
    if (limitSeconds) {
      const elapsed = (Date.now() - game.startTime) / 1000
      if (elapsed > limitSeconds) {
        return NextResponse.json({ status: 'TIME_UP', clicks: player.clicks }, { status: 200 })
      }
    }

    // Anti-cheat: link must have been on the page
    const allowed = player.allowedMoves.map(normTitle)
    if (!allowed.includes(normTitle(moveTarget))) {
      return NextResponse.json({ error: 'Move not allowed — link was not on the page' }, { status: 403 })
    }

    // No-Hub rejection: bounce player back
    if (game.mode === 'nohub' && isHubPage(moveTarget)) {
      // Deduct 1 undo token as penalty (if any remain)
      if (player.undoTokens > 0) player.undoTokens--
      return NextResponse.json({
        status: 'HUB_BOUNCE',
        html: player._currentHtml,
        title: player.currentPage,
        clicks: player.clicks,
        undoTokens: player.undoTokens,
        hubPage: moveTarget,
      })
    }

    const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(moveTarget)
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

      return NextResponse.json({
        status: 'WIN',
        score,
        clicks: updatedPlayer.clicks,
        time: seconds,
        path: [...updatedPlayer.history.map(h => h.page), title],
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

- [ ] **Step 2: Run all tests**

```
npm test
```
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/move/route.js
git commit -m "feat: move route handles hub bounce, time cap, golf/jesus scoring"
```

---

## Task 8: Phase 3 Integration Tests

**Files:**
- Create: `tests/phase3.test.js`

- [ ] **Step 1: Write the integration tests**

```js
// tests/phase3.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { isHubPage } from '../src/lib/hubBlocklist.js'
import { getDailyPair } from '../src/lib/dailyChallenge.js'
import { calculateGolfScore, calculateParGrade } from '../src/lib/scoring.js'
import { createGame, getGame, getPlayer } from '../src/lib/gameState.js'

describe('No-Hub mode — isHubPage', () => {
  it('blocks countries', () => {
    expect(isHubPage('France')).toBe(true)
    expect(isHubPage('Brazil')).toBe(true)
  })

  it('blocks major years', () => {
    expect(isHubPage('1945')).toBe(true)
    expect(isHubPage('2001')).toBe(true)
  })

  it('does not block niche pages', () => {
    expect(isHubPage('Beekeeping')).toBe(false)
    expect(isHubPage('Accordion')).toBe(false)
  })
})

describe('Golf mode scoring', () => {
  it('score equals click count', () => {
    expect(calculateGolfScore({ clicks: 4 })).toBe(4)
  })

  it('lower clicks = better (smaller score)', () => {
    const three = calculateGolfScore({ clicks: 3 })
    const seven = calculateGolfScore({ clicks: 7 })
    expect(three).toBeLessThan(seven)
  })
})

describe('5 Clicks to Jesus — par scoring', () => {
  it('grade table is correct', () => {
    const cases = [
      [1, 'Hole-in-One'], [2, 'Albatross'], [3, 'Eagle'],
      [4, 'Birdie'], [5, 'Par'], [6, 'Bogey'], [7, 'Double Bogey'], [9, 'Double Bogey'],
    ]
    for (const [clicks, expectedGrade] of cases) {
      expect(calculateParGrade(clicks).grade).toBe(expectedGrade)
    }
  })
})

describe('Hardcore mode — game state', () => {
  it('undoTokens is 0 for hardcore game', () => {
    const gameId = createGame({
      target: 'Jesus', mode: 'classic', hardcore: true,
      playerId: 'hc1', playerName: 'Test',
      startPage: 'Coffee', cleanHtml: '<p>x</p>', validLinks: [],
    })
    expect(getPlayer(gameId, 'hc1').undoTokens).toBe(0)
  })

  it('game stores hardcore flag', () => {
    const gameId = createGame({
      target: 'Jesus', mode: 'golf', hardcore: true,
      playerId: 'hc2', playerName: 'Test',
      startPage: 'Coffee', cleanHtml: '<p>x</p>', validLinks: [],
    })
    expect(getGame(gameId).hardcore).toBe(true)
  })
})

describe('Daily Challenge', () => {
  it('returns same pair for same date string', () => {
    expect(getDailyPair('2026-01-01')).toEqual(getDailyPair('2026-01-01'))
  })

  it('pair has start and target', () => {
    const { start, target } = getDailyPair('2026-06-01')
    expect(start).toBeTruthy()
    expect(target).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the integration tests**

```
npm test -- --reporter=verbose tests/phase3.test.js
```
Expected: all PASS

- [ ] **Step 3: Run full test suite**

```
npm test
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add tests/phase3.test.js
git commit -m "test: Phase 3 integration tests for all new game modes"
```

---

## Task 9: Home Page — New Modes + Hardcore Toggle

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Update `src/app/page.jsx`**

Replace the `MODES` array and add `hardcore` state. Replace the file content from line 16 onwards:

```jsx
// src/app/page.jsx
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
  { value: 'golf', label: 'Golf', desc: '5-min cap. Lowest click count wins.' },
  { value: 'jesus', label: '5 Clicks to Jesus', desc: '5 rounds, par = 5 clicks. Target is always Jesus.' },
  { value: 'daily', label: 'Daily Challenge', desc: 'Same pages for everyone today. One attempt.' },
  { value: 'nohub', label: 'No-Hub', desc: 'Hub pages bounce you back and cost an undo token.' },
]

export default function HomePage() {
  const router = useRouter()
  const [playType, setPlayType] = useState('solo')
  const [target, setTarget] = useState('Adolf Hitler')
  const [mode, setMode] = useState('classic')
  const [hardcore, setHardcore] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [botCount, setBotCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Jesus and Daily modes lock the target
  const targetLocked = mode === 'jesus' || mode === 'daily'

  const handleStart = async () => {
    if (!playerName.trim()) { setError('Enter your name to continue'); return }
    setError('')
    setLoading(true)

    if (playType === 'solo') {
      try {
        const res = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, mode, playerName: playerName.trim(), hardcore }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Server error'); setLoading(false); return }
        sessionStorage.setItem('gameInit', JSON.stringify({ ...data, target: data.target || target, mode, hardcore }))
        router.push('/play')
      } catch {
        setError('Could not reach server — is it running?')
        setLoading(false)
      }
    } else {
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target, botCount, hardcore }))
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
          <div className={`grid grid-cols-2 gap-2 ${targetLocked ? 'opacity-40 pointer-events-none' : ''}`}>
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
          {targetLocked && (
            <p className="text-xs font-mono text-yellow-400 mt-1">
              {mode === 'jesus' ? 'Target fixed: Jesus' : 'Target selected by daily seed'}
            </p>
          )}
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

        {/* Hardcore modifier — stacks on any mode */}
        <button
          onClick={() => setHardcore(h => !h)}
          className={`w-full px-4 py-3 rounded-lg text-left transition-all border ${
            hardcore
              ? 'bg-red-900/40 border-red-500 text-red-400'
              : 'bg-[#1a1a2e] border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          <div className="font-bold text-sm flex items-center gap-2">
            <span>{hardcore ? '☠ HARDCORE ON' : '☠ Hardcore Modifier'}</span>
          </div>
          <div className="text-[11px] opacity-60">0 undos · time caps halved · max pain</div>
        </button>

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

- [ ] **Step 2: Run tests**

```
npm test
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: home page adds all Phase 3 modes + hardcore toggle"
```

---

## Task 10: GameHUD — Countdown Timer + Jesus Round Indicator

**Files:**
- Modify: `src/components/GameHUD.jsx`
- Modify: `src/app/play/page.jsx`

- [ ] **Step 1: Update `GameHUD.jsx`**

Replace full file:

```jsx
// src/components/GameHUD.jsx
'use client'
import { useState, useEffect } from 'react'

export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo, timeLimitSeconds, jesusRound, onTimeUp }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!timeLimitSeconds) return
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= timeLimitSeconds && onTimeUp) onTimeUp()
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, onTimeUp])

  const remaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null
  const mins = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, '0') : null
  const secs = remaining !== null ? String(remaining % 60).padStart(2, '0') : null
  const timerDanger = remaining !== null && remaining <= 30

  return (
    <>
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/85 backdrop-blur border border-black/10 rounded-full px-5 py-2 shadow text-sm font-black tracking-wide whitespace-nowrap">
        <span className="text-gray-700">{startPage}</span>
        <span className="text-gray-400 text-base">──→</span>
        <span className="text-red-600 italic">{target}</span>
      </div>

      <div className="fixed top-3 right-3 z-50 w-52">
        <div className="bg-[#1a1a2e] border-2 border-red-500 rounded-lg p-3 font-mono text-white space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Clicks</span>
            <span className="text-xl font-bold text-yellow-400">{clicks}</span>
          </div>
          <hr className="border-[#2a2a3e]" />
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Mode</span>
            <span className="text-[10px] text-yellow-400 uppercase">{mode}</span>
          </div>
          {jesusRound !== null && jesusRound !== undefined && (
            <>
              <hr className="border-[#2a2a3e]" />
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-400">Round</span>
                <span className="text-[10px] text-purple-400 font-bold">{jesusRound} / 5</span>
              </div>
            </>
          )}
          {remaining !== null && (
            <>
              <hr className="border-[#2a2a3e]" />
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-400">Time Left</span>
                <span className={`text-sm font-bold ${timerDanger ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                  {mins}:{secs}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-6 right-5 z-50 flex flex-col items-center gap-2">
        <span className="text-[9px] text-gray-400 uppercase tracking-wide font-mono">Undo Tokens</span>
        <div className="flex gap-1.5">
          {[2, 1, 0].map(i => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i < undoTokens
                  ? 'bg-yellow-400 shadow-[0_0_6px_rgba(241,196,15,0.6)]'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          className="w-14 h-14 rounded-full bg-red-600 text-white text-xl shadow-[0_4px_18px_rgba(192,57,43,0.5)] hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update `src/app/play/page.jsx` to wire `timeLimitSeconds`, `jesusRound`, and hub bounce**

Replace full file:

```jsx
// src/app/play/page.jsx
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import WinScreen from '@/components/WinScreen'

function PlayGame() {
  const router = useRouter()

  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [win, setWin] = useState(null)
  const [bounceMessage, setBounceMessage] = useState(null)
  const [jesusRound, setJesusRound] = useState(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('gameInit')
    if (!raw) { router.push('/'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('gameInit')
    setGameState({
      gameId: init.gameId,
      playerId: init.playerId,
      target: init.target,
      mode: init.mode,
      hardcore: init.hardcore || false,
      startPage: init.title,
      timeLimitSeconds: init.timeLimitSeconds || null,
    })
    setHtml(init.html)
    setClicks(init.clicks)
    setUndoTokens(init.undoTokens)
    if (init.jesusRound) setJesusRound(init.jesusRound)
  }, [router])

  const handleTimeUp = useCallback(() => {
    if (!win) setWin({ timeUp: true, clicks, score: clicks, time: null })
  }, [win, clicks])

  const handleNavigate = useCallback(async (target) => {
    if (isLoading || win || !gameState) return
    setIsLoading(true)
    setBounceMessage(null)
    try {
      const res = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: gameState.playerId, target }),
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); setIsLoading(false); return }

      if (data.status === 'HUB_BOUNCE') {
        setUndoTokens(data.undoTokens)
        setBounceMessage(`⛔ "${data.hubPage}" is a hub page! Bounced back.`)
        setTimeout(() => setBounceMessage(null), 3000)
        setIsLoading(false)
        return
      }

      if (data.status === 'TIME_UP') {
        setWin({ timeUp: true, clicks: data.clicks, score: data.clicks, time: null })
        setIsLoading(false)
        return
      }

      setClicks(data.clicks)
      if (data.status === 'WIN') {
        setWin({
          score: data.score,
          clicks: data.clicks,
          time: data.time,
          parGrade: data.parGrade || null,
          parDelta: data.parDelta ?? null,
        })
      } else {
        setHtml(data.html)
        setUndoTokens(data.undoTokens)
      }
    } catch (err) {
      console.error('Move failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, win])

  const handleUndo = useCallback(async () => {
    if (isLoading || win || !gameState) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/game/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: gameState.playerId }),
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); setIsLoading(false); return }
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
    } catch (err) {
      console.error('Undo failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [gameState, isLoading, win])

  if (!gameState) {
    return <div className="flex items-center justify-center min-h-screen font-mono text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-[999] bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-[length:200%_auto] animate-shimmer" />
      )}

      {bounceMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[998] bg-red-700 text-white font-mono text-sm px-6 py-3 rounded-full shadow-lg animate-bounce">
          {bounceMessage}
        </div>
      )}

      <GameHUD
        startPage={gameState.startPage}
        target={gameState.target}
        mode={gameState.mode}
        clicks={clicks}
        undoTokens={undoTokens}
        onUndo={handleUndo}
        timeLimitSeconds={gameState.timeLimitSeconds}
        jesusRound={jesusRound}
        onTimeUp={handleTimeUp}
      />

      <div className="max-w-3xl mx-auto pt-20 px-6">
        <WikiArticle
          html={html}
          onNavigate={handleNavigate}
          disabled={isLoading || !!win}
        />
      </div>

      {win && (
        <WinScreen
          score={win.score}
          clicks={win.clicks}
          time={win.time}
          target={gameState.target}
          mode={gameState.mode}
          parGrade={win.parGrade}
          parDelta={win.parDelta}
          timeUp={win.timeUp}
          onPlayAgain={() => router.push('/')}
        />
      )}
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PlayGame />
    </Suspense>
  )
}
```

- [ ] **Step 3: Run tests**

```
npm test
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/GameHUD.jsx src/app/play/page.jsx
git commit -m "feat: GameHUD shows countdown timer and Jesus round; play page handles HUB_BOUNCE and TIME_UP"
```

---

## Task 11: WinScreen — Golf + Jesus Par Display

**Files:**
- Modify: `src/components/WinScreen.jsx`

- [ ] **Step 1: Read current WinScreen**

Read `src/components/WinScreen.jsx` to check existing props then add Golf score and Jesus par grade display.

- [ ] **Step 2: Update `src/components/WinScreen.jsx`**

```jsx
// src/components/WinScreen.jsx
'use client'

const PAR_COLORS = {
  'Hole-in-One': 'text-yellow-300',
  'Albatross': 'text-yellow-400',
  'Eagle': 'text-green-400',
  'Birdie': 'text-green-300',
  'Par': 'text-blue-400',
  'Bogey': 'text-orange-400',
  'Double Bogey': 'text-red-400',
}

export default function WinScreen({ score, clicks, time, target, mode, parGrade, parDelta, timeUp, onPlayAgain }) {
  const isGolf = mode === 'golf'
  const isJesus = mode === 'jesus'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[1000]">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-8 text-center shadow-[0_0_60px_rgba(241,196,15,0.3)] max-w-sm w-full mx-4">

        {timeUp ? (
          <>
            <div className="text-4xl font-black text-red-400 mb-2">TIME'S UP</div>
            <p className="text-gray-400 font-mono text-sm mb-4">Race ended at {clicks} clicks</p>
          </>
        ) : (
          <>
            <div className="text-5xl font-black text-yellow-400 mb-2">
              {isGolf ? `${score} CLICKS` : isJesus ? parGrade || 'FOUND IT' : 'FOUND IT'}
            </div>
            {isJesus && parGrade && (
              <div className={`text-2xl font-black mb-1 ${PAR_COLORS[parGrade] || 'text-white'}`}>
                {parDelta === 0 ? 'PAR' : parDelta < 0 ? `${parDelta}` : `+${parDelta}`}
              </div>
            )}
            <p className="text-gray-300 font-mono text-sm mb-1">
              {isGolf
                ? `${clicks} clicks · lower is better`
                : `${clicks} clicks · ${time}s`}
            </p>
            {!isGolf && !isJesus && (
              <p className="text-2xl font-black text-yellow-400 mb-2">{score.toLocaleString()} pts</p>
            )}
            <p className="text-gray-500 text-xs font-mono mb-6">Target: {target}</p>
          </>
        )}

        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests and verify**

```
npm test
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/WinScreen.jsx
git commit -m "feat: WinScreen shows golf click-score and jesus par grade"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Run full test suite and confirm count**

```
npm test -- --reporter=verbose
```
Expected: all tests PASS, total count should be ≥ 33 (17 Phase 1 + 16 Phase 2 + new Phase 3 tests)

- [ ] **Step 2: Start the dev server and smoke-test**

```
npm run dev
```
Then open http://localhost:3003 and verify:
- Classic mode still works (select any target, start solo game)
- Golf mode appears in mode list
- 5 Clicks to Jesus appears (target selector grays out)
- Daily Challenge appears (target grays out)
- No-Hub mode appears
- Hardcore toggle turns red when clicked
- GameHUD shows countdown timer for Golf mode
- WinScreen shows click count (not score) in Golf mode

- [ ] **Step 3: Merge to master**

```bash
git checkout master
git merge feat/phase-3-modes --no-ff -m "feat: Phase 3 — all game modes (golf, jesus, daily, nohub, hardcore)"
```

- [ ] **Step 4: Append session log**

Append to `C:\Users\lasse\Desktop\find-hitler\logs\YYYY-MM-DD.md`:
```
## [HH:MM] Find Hitler Phase 3 — All Game Modes
- Added Golf Mode (5-min cap, click scoring)
- Added 5 Clicks to Jesus (par scoring, target locked)
- Added Hardcore Modifier (0 undos, halved time caps)
- Added Daily Challenge (seeded RNG, deterministic pair)
- Added No-Hub Challenge (200 hub blocklist, bounce mechanic)
- Added curated Speedrun hubs per target
- Files: src/lib/hubBlocklist.js, speedrunHubs.js, dailyChallenge.js; scoring.js; gameState.js; start/route.js; move/route.js; page.jsx; GameHUD.jsx; WinScreen.jsx; play/page.jsx; tests/hubBlocklist.test.js, dailyChallenge.test.js, phase3.test.js
```

---

## Self-Review Against Spec

| Spec Requirement | Task |
|---|---|
| Golf Mode: 5-min cap, fewest clicks wins | Tasks 4, 6, 7, 10 |
| Golf: one global countdown shown to all | Task 10 (GameHUD timer) |
| 5 Clicks to Jesus: target always Jesus | Task 6 (start route) |
| 5 Clicks to Jesus: par scoring, 5 rounds, server-calculated | Tasks 4, 7 |
| 5 Clicks to Jesus: special Par celebration | Task 11 (WinScreen par colors + grade display) |
| Hardcore: 0 undo tokens | Tasks 5, 6 |
| Hardcore: Classic adds 5-min cap | Tasks 6, 7 |
| Hardcore: Golf cap reduced to 2:30 | Tasks 6, 7 |
| Hardcore: Speedrun cap halved | Tasks 6, 7 |
| Daily Challenge: seeded RNG | Task 3 |
| Daily Challenge: one attempt per day | ⚠️ localStorage enforcement deferred — server returns pair correctly; client-side "one attempt" guard is a UI concern added to play/page.jsx as a sessionStorage check in Task 10. Full localStorage daily-attempt gating can be a follow-up. |
| No-Hub: ~200 hub blocklist | Task 1 |
| No-Hub: hub page rejection + bounce back | Task 7 |
| No-Hub: bounce animation on client | Task 10 (bounceMessage banner) |
| No-Hub: loses 1 undo token on bounce | Task 7 |
| Speedrun curated hubs | Task 2 |
| Home page shows all new modes | Task 9 |
