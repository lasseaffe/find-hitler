# Find Hitler — Phase 1: Solo Core Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully playable single-player WikiRace game where a user navigates Wikipedia to reach a target page, with server-authoritative anti-cheat, undo tokens, and a win screen.

**Architecture:** Next.js 14 App Router on port 3003. API routes handle all game logic server-side (no client trust). In-memory `Map()` with `globalThis` persistence survives Next.js hot-reload. No Socket.io yet — that's Phase 2.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS + `@tailwindcss/typography`, cheerio, Vitest

---

## File Map

```
C:\Users\lasse\Desktop\find-hitler\
├── package.json
├── next.config.mjs
├── tailwind.config.js
├── postcss.config.js
├── vitest.config.js
├── .gitignore
├── src/
│   ├── app/
│   │   ├── layout.jsx               # Root layout, Tailwind globals
│   │   ├── globals.css              # Tailwind base + retro shimmer animation
│   │   ├── page.jsx                 # Home screen — target + mode select, starts game
│   │   ├── play/
│   │   │   └── page.jsx             # Game page — article + HUD, wires move/undo
│   │   └── api/
│   │       └── game/
│   │           ├── start/route.js   # POST: pick random start, create game, return html
│   │           ├── move/route.js    # POST: validate link, advance state, check win
│   │           └── undo/route.js    # POST: pop history, return previous page html
│   ├── components/
│   │   ├── WikiArticle.jsx          # dangerouslySetInnerHTML + event delegation + Ctrl+F block
│   │   ├── GameHUD.jsx              # Top pill + right scoreboard + bottom undo tokens
│   │   └── WinScreen.jsx            # Fullscreen overlay: score, clicks, time, play again
│   └── lib/
│       ├── wikipedia.js             # fetchAndSanitizeWiki() — MediaWiki API + cheerio
│       ├── gameState.js             # createGame, getGame, getPlayer, updatePlayerMove, useUndoToken
│       └── scoring.js              # calculateScore(mode, clicks, seconds)
├── tests/
│   ├── wikipedia.test.js
│   ├── gameState.test.js
│   └── scoring.test.js
├── logs/
│   └── .gitkeep
└── find-hitler.bat                  # Copy to Desktop after scaffold
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `C:\Users\lasse\Desktop\find-hitler\` (entire scaffold)

- [ ] **Step 1: Create the Next.js project**

```bash
cd C:\Users\lasse\Desktop
npx create-next-app@latest find-hitler --js --tailwind --app --no-src-dir --no-import-alias
```

When prompted: accept defaults. Then move into `src/` structure manually (create-next-app with `--no-src-dir` puts files at root — we'll fix):

```bash
cd find-hitler
mkdir -p src/app src/components src/lib tests logs
```

Move the generated `app/` folder into `src/`:
```bash
# On Windows PowerShell:
Move-Item app src/app -Force
Move-Item -ErrorAction SilentlyContinue pages src/ 
```

- [ ] **Step 2: Install dependencies**

```bash
npm install cheerio dompurify
npm install -D vitest @vitejs/plugin-react jsdom @types/dompurify
```

- [ ] **Step 3: Write `package.json` scripts**

Open `package.json` and ensure scripts are:
```json
{
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 5: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
export default nextConfig
```

- [ ] **Step 6: Write `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
}
```

Install the typography plugin:
```bash
npm install -D @tailwindcss/typography
```

- [ ] **Step 7: Write `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@keyframes shimmer {
  0%   { background-position: 0% }
  100% { background-position: 200% }
}

.animate-shimmer {
  animation: shimmer 1.2s linear infinite;
}
```

- [ ] **Step 8: Write `src/app/layout.jsx`**

```jsx
import './globals.css'

export const metadata = { title: 'Find Hitler — WikiRace' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa] text-[#202122]">{children}</body>
    </html>
  )
}
```

- [ ] **Step 9: Write `logs/.gitkeep`**

```bash
echo. > logs/.gitkeep
```

- [ ] **Step 10: Write `.gitignore`**

```
node_modules/
.next/
.env*
```

- [ ] **Step 11: Initialize git and commit scaffold**

```bash
git init
git add .
git commit -m "chore: scaffold find-hitler Next.js project"
```

- [ ] **Step 12: Verify dev server starts on port 3003**

```bash
npm run dev
```

Expected: `ready - started server on 0.0.0.0:3003`
Open `http://localhost:3003` — default Next.js page should appear. Stop server (Ctrl+C).

- [ ] **Step 13: Create Desktop launcher**

Create `find-hitler.bat` in the project root:

```bat
@echo off
title Find Hitler - WikiRace
cd /d "C:\Users\lasse\Desktop\find-hitler"
echo Starting Find Hitler on http://localhost:3003 ...
start "" cmd /c "npm run dev"
timeout /t 3 /noisy > nul
start "" "http://localhost:3003"
```

Then copy to Desktop:
```powershell
Copy-Item "find-hitler.bat" "$env:USERPROFILE\Desktop\find-hitler.bat"
```

- [ ] **Step 14: Commit**

```bash
git add find-hitler.bat logs/
git commit -m "chore: add desktop launcher and logs dir"
```

---

## Task 2: Scoring library

**Files:**
- Create: `src/lib/scoring.js`
- Create: `tests/scoring.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/scoring.test.js
import { describe, it, expect } from 'vitest'
import { calculateScore } from '../src/lib/scoring.js'

describe('calculateScore', () => {
  it('classic: penalizes clicks at 500 each, seconds at 10 each', () => {
    expect(calculateScore({ mode: 'classic', clicks: 4, seconds: 30 })).toBe(7700)
    // 10000 - (4 * 500) - (30 * 10) = 10000 - 2000 - 300 = 7700
  })

  it('speedrun: penalizes seconds at 100 each, clicks at 50 each', () => {
    expect(calculateScore({ mode: 'speedrun', clicks: 4, seconds: 30 })).toBe(6800)
    // 10000 - (30 * 100) - (4 * 50) = 10000 - 3000 - 200 = 6800
  })

  it('never returns a negative score', () => {
    expect(calculateScore({ mode: 'classic', clicks: 100, seconds: 1000 })).toBe(0)
  })

  it('perfect game: 1 click, 1 second', () => {
    expect(calculateScore({ mode: 'classic', clicks: 1, seconds: 1 })).toBe(9490)
    // 10000 - 500 - 10 = 9490
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 4 failing tests — `calculateScore is not a function`

- [ ] **Step 3: Implement `src/lib/scoring.js`**

```js
export function calculateScore({ mode, clicks, seconds }) {
  if (mode === 'speedrun') {
    return Math.max(0, 10000 - seconds * 100 - clicks * 50)
  }
  return Math.max(0, 10000 - clicks * 500 - seconds * 10)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: 4 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.js tests/scoring.test.js
git commit -m "feat: add scoring library with classic and speedrun formulas"
```

---

## Task 3: Wikipedia engine

**Files:**
- Create: `src/lib/wikipedia.js`
- Create: `tests/wikipedia.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/wikipedia.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAndSanitizeWiki } from '../src/lib/wikipedia.js'

const FIXTURE_HTML = `
<div id="mw-content-text">
  <p>Brazil is a country in <a href="/wiki/South_America">South America</a>.</p>
  <p>It borders <a href="/wiki/Argentina">Argentina</a>.</p>
  <p>See also <a href="/wiki/Special:Search">search</a> and <a href="https://external.com">external</a>.</p>
  <div class="navbox">Nav content — should be stripped</div>
  <table class="infobox">Infobox — should be stripped</table>
  <div class="reflist">References — should be stripped</div>
</div>
`

function makeMockFetch(html, title = 'Brazil') {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      parse: { title, text: { '*': html } }
    })
  })
}

describe('fetchAndSanitizeWiki', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeMockFetch(FIXTURE_HTML))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the page title', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.title).toBe('Brazil')
  })

  it('includes valid internal wiki links in validLinks', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.validLinks).toContain('South_America')
    expect(result.validLinks).toContain('Argentina')
  })

  it('excludes Special: pages and external links from validLinks', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.validLinks).not.toContain('Special:Search')
    expect(result.validLinks).not.toContain('https://external.com')
  })

  it('rewrites internal links to data-wiki-target="#"', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).toContain('data-wiki-target="South_America"')
    expect(result.cleanHtml).toContain('href="#"')
  })

  it('strips navbox, infobox, and reflist elements', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).not.toContain('navbox')
    expect(result.cleanHtml).not.toContain('infobox')
    expect(result.cleanHtml).not.toContain('reflist')
  })

  it('strips external links but keeps their text', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).not.toContain('href="https://external.com"')
    expect(result.cleanHtml).toContain('external')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 6 failing — `fetchAndSanitizeWiki is not a function`

- [ ] **Step 3: Implement `src/lib/wikipedia.js`**

```js
import * as cheerio from 'cheerio'

export async function fetchAndSanitizeWiki(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`
  const response = await fetch(url)
  const data = await response.json()

  if (data.error) throw new Error(`Wikipedia page not found: ${pageTitle}`)

  const html = data.parse.text['*']
  const $ = cheerio.load(html)
  const body = $('#mw-content-text')

  // Strip Wikipedia UI elements that could be used for navigation or cheating
  body.find('.navbox, .infobox, .reflist, .reference, #mw-navigation, .sistersitebox, .ambox, .hatnote').remove()
  body.find('sup.reference').remove()

  const validLinks = new Set()

  body.find('a').each((_, el) => {
    const href = $(el).attr('href') || ''

    if (href.startsWith('/wiki/') && !href.includes(':')) {
      const title = decodeURIComponent(href.replace('/wiki/', ''))
      validLinks.add(title)
      $(el).attr('data-wiki-target', title).attr('href', '#')
    } else {
      // Strip non-game links but preserve their visible text
      $(el).replaceWith($(el).text())
    }
  })

  return {
    cleanHtml: body.html(),
    validLinks: Array.from(validLinks),
    title: data.parse.title,
  }
}

export async function getRandomWikiPage() {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*'
  const res = await fetch(url)
  const data = await res.json()
  return data.query.random[0].title
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikipedia.js tests/wikipedia.test.js
git commit -m "feat: add Wikipedia fetch and sanitize engine"
```

---

## Task 4: In-memory game state

**Files:**
- Create: `src/lib/gameState.js`
- Create: `tests/gameState.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/gameState.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { createGame, getGame, getPlayer, updatePlayerMove, useUndoToken } from '../src/lib/gameState.js'

// Reset store between test runs by using a fresh module-level key
const TEST_STORE_KEY = `_gamesStore_${Math.random()}`

describe('game state', () => {
  let gameId, playerId

  beforeEach(() => {
    playerId = 'player-test-1'
    gameId = createGame({
      target: 'Adolf Hitler',
      mode: 'classic',
      playerId,
      playerName: 'Tester',
      startPage: 'Brazil',
      cleanHtml: '<p>Brazil</p>',
      validLinks: ['South_America', 'Argentina'],
    })
  })

  it('creates a game with correct initial player state', () => {
    const game = getGame(gameId)
    expect(game.target).toBe('Adolf Hitler')
    expect(game.mode).toBe('classic')

    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('Brazil')
    expect(player.clicks).toBe(0)
    expect(player.undoTokens).toBe(3)
    expect(player.history).toHaveLength(0)
    expect(player.allowedMoves).toContain('South_America')
  })

  it('getGame returns null for unknown id', () => {
    expect(getGame('nonexistent')).toBeNull()
  })

  it('getPlayer returns null for unknown player', () => {
    expect(getPlayer(gameId, 'nobody')).toBeNull()
  })

  it('updatePlayerMove increments clicks and stores history', () => {
    updatePlayerMove(gameId, playerId, {
      nextPage: 'South_America',
      cleanHtml: '<p>SA</p>',
      validLinks: ['Germany', 'France'],
    })
    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('South_America')
    expect(player.clicks).toBe(1)
    expect(player.allowedMoves).toContain('Germany')
    expect(player.history).toHaveLength(1)
    expect(player.history[0].page).toBe('Brazil')
    expect(player.history[0].html).toBe('<p>Brazil</p>')
  })

  it('useUndoToken restores previous page and decrements token', () => {
    updatePlayerMove(gameId, playerId, {
      nextPage: 'South_America',
      cleanHtml: '<p>SA</p>',
      validLinks: ['Germany'],
    })
    const result = useUndoToken(gameId, playerId)
    expect(result).not.toBeNull()
    expect(result.page).toBe('Brazil')
    expect(result.html).toBe('<p>Brazil</p>')

    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('Brazil')
    expect(player.undoTokens).toBe(2)
    expect(player.history).toHaveLength(0)
  })

  it('useUndoToken returns null when no tokens remain', () => {
    // Use all 3 undo tokens
    for (let i = 0; i < 3; i++) {
      updatePlayerMove(gameId, playerId, { nextPage: `Page${i}`, cleanHtml: `<p>${i}</p>`, validLinks: [`Next${i}`] })
      useUndoToken(gameId, playerId)
    }
    const player = getPlayer(gameId, playerId)
    expect(player.undoTokens).toBe(0)
    // Now push one more page without undoing
    updatePlayerMove(gameId, playerId, { nextPage: 'FinalPage', cleanHtml: '<p>f</p>', validLinks: [] })
    expect(useUndoToken(gameId, playerId)).toBeNull()
  })

  it('useUndoToken returns null with empty history', () => {
    // No moves made — nothing to undo
    const result = useUndoToken(gameId, playerId)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 7 failing — `createGame is not a function`

- [ ] **Step 3: Implement `src/lib/gameState.js`**

```js
// globalThis persists across Next.js hot reloads in dev
const games = globalThis._gamesStore || (globalThis._gamesStore = new Map())

export function createGame({ target, mode, playerId, playerName, startPage, cleanHtml, validLinks }) {
  const gameId = Math.random().toString(36).slice(2, 10)
  games.set(gameId, {
    target,
    mode,
    startTime: Date.now(),
    players: {
      [playerId]: {
        name: playerName,
        currentPage: startPage,
        _currentHtml: cleanHtml,
        history: [],
        clicks: 0,
        undoTokens: 3,
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

  // Push current state to history before advancing
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 7 passing (plus scoring + wikipedia = 17 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameState.js tests/gameState.test.js
git commit -m "feat: add in-memory game state with undo token support"
```

---

## Task 5: API — /api/game/start

**Files:**
- Create: `src/app/api/game/start/route.js`

- [ ] **Step 1: Create the route**

```js
// src/app/api/game/start/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage } from '@/lib/wikipedia'
import { createGame } from '@/lib/gameState'

export async function POST(request) {
  const { target, mode, playerName } = await request.json()

  if (!target || !mode || !playerName) {
    return NextResponse.json({ error: 'Missing target, mode, or playerName' }, { status: 400 })
  }

  const startTitle = await getRandomWikiPage()
  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
  const gameId = createGame({
    target,
    mode,
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
    clicks: 0,
    undoTokens: 3,
  })
}
```

- [ ] **Step 2: Start dev server and test with curl**

```bash
npm run dev
```

In a second terminal:
```bash
curl -s -X POST http://localhost:3003/api/game/start \
  -H "Content-Type: application/json" \
  -d "{\"target\":\"Adolf Hitler\",\"mode\":\"classic\",\"playerName\":\"lasse\"}" \
  | python -m json.tool
```

Expected: JSON with `gameId`, `playerId`, `html` (long Wikipedia HTML), `title`, `clicks: 0`, `undoTokens: 3`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/start/route.js
git commit -m "feat: add /api/game/start — random page, creates game session"
```

---

## Task 6: API — /api/game/move

**Files:**
- Create: `src/app/api/game/move/route.js`

- [ ] **Step 1: Create the route**

```js
// src/app/api/game/move/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki } from '@/lib/wikipedia'
import { getGame, getPlayer, updatePlayerMove } from '@/lib/gameState'
import { calculateScore } from '@/lib/scoring'

function normTitle(t) {
  return t.replace(/_/g, ' ').toLowerCase().trim()
}

export async function POST(request) {
  const { gameId, playerId, target: nextPage } = await request.json()

  const game = getGame(gameId)
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  const player = getPlayer(gameId, playerId)
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  // Anti-cheat: verify the clicked link exists on the player's current page
  if (!player.allowedMoves.includes(nextPage)) {
    return NextResponse.json({ error: 'Invalid move: link not present on current page' }, { status: 400 })
  }

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(nextPage)
  updatePlayerMove(gameId, playerId, { nextPage: title, cleanHtml, validLinks })

  const updated = getPlayer(gameId, playerId)

  // Win condition check (normalize underscores and case)
  if (normTitle(title) === normTitle(game.target)) {
    const seconds = Math.round((Date.now() - game.startTime) / 1000)
    const score = calculateScore({ mode: game.mode, clicks: updated.clicks, seconds })
    return NextResponse.json({
      status: 'WIN',
      score,
      clicks: updated.clicks,
      time: seconds,
      path: [...updated.history.map(h => h.page), title],
    })
  }

  return NextResponse.json({
    status: 'CONTINUE',
    html: cleanHtml,
    title,
    clicks: updated.clicks,
    undoTokens: updated.undoTokens,
  })
}
```

- [ ] **Step 2: Test valid move with curl**

First get a `gameId` and `playerId` from `/start`, then find a link title from the returned HTML (look for `data-wiki-target="Some_Page"`). Then:

```bash
curl -s -X POST http://localhost:3003/api/game/move \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"YOUR_GAME_ID\",\"playerId\":\"YOUR_PLAYER_ID\",\"target\":\"VALID_LINK_TITLE\"}" \
  | python -m json.tool
```

Expected: `status: "CONTINUE"` with new HTML and `clicks: 1`.

- [ ] **Step 3: Test anti-cheat rejection**

```bash
curl -s -X POST http://localhost:3003/api/game/move \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"YOUR_GAME_ID\",\"playerId\":\"YOUR_PLAYER_ID\",\"target\":\"Adolf_Hitler\"}" \
  | python -m json.tool
```

Expected: `400` with `"Invalid move: link not present on current page"`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/game/move/route.js
git commit -m "feat: add /api/game/move — anti-cheat validation and win condition"
```

---

## Task 7: API — /api/game/undo

**Files:**
- Create: `src/app/api/game/undo/route.js`

- [ ] **Step 1: Create the route**

```js
// src/app/api/game/undo/route.js
import { NextResponse } from 'next/server'
import { getGame, getPlayer, useUndoToken } from '@/lib/gameState'

export async function POST(request) {
  const { gameId, playerId } = await request.json()

  const game = getGame(gameId)
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  const player = getPlayer(gameId, playerId)
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const result = useUndoToken(gameId, playerId)
  if (!result) {
    return NextResponse.json({ error: 'No undo tokens remaining or no history to revert' }, { status: 400 })
  }

  return NextResponse.json({
    status: 'CONTINUE',
    html: result.html,
    title: result.page,
    clicks: result.clicks,
    undoTokens: result.undoTokens,
  })
}
```

- [ ] **Step 2: Test undo with curl**

After making at least one move (clicks: 1), call undo:

```bash
curl -s -X POST http://localhost:3003/api/game/undo \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"YOUR_GAME_ID\",\"playerId\":\"YOUR_PLAYER_ID\"}" \
  | python -m json.tool
```

Expected: `status: "CONTINUE"`, previous page HTML returned, `undoTokens: 2`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/undo/route.js
git commit -m "feat: add /api/game/undo — server-authoritative history revert"
```

---

## Task 8: WikiArticle component

**Files:**
- Create: `src/components/WikiArticle.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/WikiArticle.jsx
'use client'
import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

// Allow data-wiki-target through DOMPurify — it's our game mechanic attribute
// Strip everything else that cheerio may have missed (defense-in-depth)
const PURIFY_CONFIG = {
  ALLOWED_ATTR: ['href', 'data-wiki-target', 'class', 'id', 'src', 'alt'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
}

export default function WikiArticle({ html, onNavigate, disabled }) {
  const containerRef = useRef(null)

  // Block Ctrl+F / Cmd+F during the game
  useEffect(() => {
    const block = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', block)
    return () => window.removeEventListener('keydown', block)
  }, [])

  // Scroll to top whenever a new page loads
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [html])

  // Event delegation: one listener on the container, not per-link
  const handleClick = (e) => {
    e.preventDefault()
    if (disabled) return
    const anchor = e.target.closest('a[data-wiki-target]')
    if (!anchor) return
    onNavigate(anchor.getAttribute('data-wiki-target'))
  }

  // Double sanitization: cheerio strips server-side, DOMPurify catches anything missed client-side
  const safeHtml = DOMPurify.sanitize(html, PURIFY_CONFIG)

  return (
    <div ref={containerRef}>
      <div
        className="prose prose-blue max-w-none text-lg leading-relaxed"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WikiArticle.jsx
git commit -m "feat: add WikiArticle component with event delegation and Ctrl+F blocking"
```

---

## Task 9: GameHUD component

**Files:**
- Create: `src/components/GameHUD.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/GameHUD.jsx
'use client'

export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo }) {
  return (
    <>
      {/* Top center: start → target pill */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/85 backdrop-blur border border-black/10 rounded-full px-5 py-2 shadow text-sm font-black tracking-wide whitespace-nowrap">
        <span className="text-gray-700">{startPage}</span>
        <span className="text-gray-400 text-base">──→</span>
        <span className="text-red-600 italic">{target}</span>
      </div>

      {/* Top right: scoreboard */}
      <div className="fixed top-3 right-3 z-50 w-48">
        <div className="bg-[#1a1a2e] border-2 border-red-500 rounded-lg p-3 font-mono text-white">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Clicks</span>
            <span className="text-xl font-bold text-yellow-400">{clicks}</span>
          </div>
          <hr className="border-[#2a2a3e] my-1" />
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-widest text-gray-400">Mode</span>
            <span className="text-[10px] text-yellow-400 uppercase">{mode}</span>
          </div>
        </div>
      </div>

      {/* Bottom right: undo button + token dots */}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/GameHUD.jsx
git commit -m "feat: add GameHUD — pill, scoreboard, undo tokens"
```

---

## Task 10: WinScreen component

**Files:**
- Create: `src/components/WinScreen.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/WinScreen.jsx
'use client'

export default function WinScreen({ score, clicks, time, target, onPlayAgain }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
      <div className="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-10 text-center max-w-sm w-full shadow-[0_0_40px_rgba(241,196,15,0.25)]">
        <div className="text-yellow-400 text-4xl font-black mb-1 tracking-tight">
          TARGET REACHED
        </div>
        <div className="text-red-400 text-lg italic mb-6">{target}</div>
        <div className="space-y-2 font-mono text-white mb-8 text-left">
          <div className="flex justify-between border-b border-[#2a2a3e] pb-2">
            <span className="text-gray-400 text-sm">Clicks</span>
            <span className="text-yellow-400 text-lg font-bold">{clicks}</span>
          </div>
          <div className="flex justify-between border-b border-[#2a2a3e] pb-2">
            <span className="text-gray-400 text-sm">Time</span>
            <span className="text-yellow-400 text-lg font-bold">{time}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Score</span>
            <span className="text-yellow-400 text-xl font-bold">{score.toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-red-600 text-white font-black rounded-lg text-base hover:bg-red-500 transition-colors uppercase tracking-wide"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WinScreen.jsx
git commit -m "feat: add WinScreen overlay with score display"
```

---

## Task 11: Game page

**Files:**
- Create: `src/app/play/page.jsx`

- [ ] **Step 1: Create the page**

```jsx
// src/app/play/page.jsx
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import WinScreen from '@/components/WinScreen'

function PlayGame() {
  const params = useSearchParams()
  const router = useRouter()

  const [gameState, setGameState] = useState(null) // { gameId, playerId, target, mode, startPage }
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [win, setWin] = useState(null) // { score, clicks, time }

  // Load game init from sessionStorage (set by home page after /api/game/start)
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
      startPage: init.title,
    })
    setHtml(init.html)
    setClicks(init.clicks)
    setUndoTokens(init.undoTokens)
  }, [router])

  const handleNavigate = useCallback(async (target) => {
    if (isLoading || win || !gameState) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId, playerId: gameState.playerId, target }),
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); setIsLoading(false); return }

      setClicks(data.clicks)
      if (data.status === 'WIN') {
        setWin({ score: data.score, clicks: data.clicks, time: data.time })
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
      {/* Loading progress bar */}
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

- [ ] **Step 2: Commit**

```bash
git add src/app/play/page.jsx
git commit -m "feat: add game page — wires article, HUD, move/undo, win screen"
```

---

## Task 12: Home page

**Files:**
- Create: `src/app/page.jsx`

- [ ] **Step 1: Create the home page**

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
]

export default function HomePage() {
  const router = useRouter()
  const [target, setTarget] = useState('Adolf Hitler')
  const [mode, setMode] = useState('classic')
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    if (!playerName.trim()) { setError('Enter your name to continue'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, mode, playerName: playerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Server error'); setLoading(false); return }

      // Pass init data via sessionStorage — avoids URL length limit for large HTML
      sessionStorage.setItem('gameInit', JSON.stringify({ ...data, target, mode }))
      router.push('/play')
    } catch {
      setError('Could not reach server — is it running?')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black text-yellow-400 tracking-tighter mb-2">FIND HITLER</h1>
        <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">WikiRace · Taboo Edition</p>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Player name */}
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

        {/* Target select */}
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

        {/* Mode select */}
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

        {/* Error */}
        {error && <p className="text-red-400 text-sm font-mono text-center">{error}</p>}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
        >
          {loading ? 'Finding start page...' : 'Start Race →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: add home page — target/mode select, starts game session"
```

---

## Task 13: End-to-end smoke test

- [ ] **Step 1: Run all unit tests one final time**

```bash
npm test
```

Expected: 17 tests passing, 0 failing.

- [ ] **Step 2: Start dev server via the .bat launcher**

Double-click `find-hitler.bat` on the Desktop (or run `npm run dev` manually).

- [ ] **Step 3: Verify the full golden path**

1. Open `http://localhost:3003`
2. Enter a nickname, select a target and mode, click **Start Race →**
3. Confirm a Wikipedia article loads (different from the target)
4. Click a blue hyperlink — confirm the article changes and click counter increments to 1
5. Try Ctrl+F — confirm the browser find bar does NOT open
6. Click ↩ Undo — confirm you return to the previous page, token dot goes dark
7. Navigate through articles until you reach the target page — confirm "TARGET REACHED" win screen appears with score, clicks, time
8. Click **Play Again** — confirm you return to home

- [ ] **Step 4: Verify anti-cheat**

In browser DevTools console:
```js
fetch('/api/game/move', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gameId: 'fake', playerId: 'fake', target: 'Adolf_Hitler' })
}).then(r => r.json()).then(console.log)
```

Expected: `{ error: "Game not found" }` with 404.

- [ ] **Step 5: Create session log**

Create `logs/2026-06-01.md`:
```markdown
## [TIME] Phase 1: Solo Core Loop — SHIPPED

- Scaffolded Next.js project on port 3003
- Wikipedia engine: MediaWiki API fetch, cheerio sanitization, link rewriting
- In-memory game state with undo token support
- Anti-cheat: server validates every link click against cached allowedMoves
- API routes: /start, /move, /undo
- Components: WikiArticle, GameHUD, WinScreen
- Home page: 8 targets, 2 modes, game session start flow
- Full golden path tested manually

Files: src/app/, src/components/, src/lib/, tests/, logs/
```

- [ ] **Step 6: Final commit**

```bash
git add logs/
git commit -m "chore: log Phase 1 session"
```

---

## What's Next (Phase 2+)

| Phase | Scope |
|---|---|
| Phase 2 | Socket.io custom server, multiplayer lobbies, live race feed, bot opponents |
| Phase 3 | All game modes: Golf, 5 Clicks to Jesus, Daily Challenge, No-Hub, Hardcore |
| Phase 4 | Post-game D3 node graph visualizer, leaderboard page |
| Phase 5 | NextAuth.js accounts, ELO/ranked duels, PostgreSQL persistence |
