# Find Hitler — WikiRace Game Roadmap

> **Single source of truth** for all development phases.
> Each phase has a spec and a copy-paste handoff prompt to start a fresh session.

---

## Project Overview

**What it is:** A web-based WikiRace game where players navigate Wikipedia hyperlinks to reach a target page. The identity is *taboo destination tourism* — the shock of navigating to Hitler, 9/11, serial killers, etc. is the hook.

**Location:** `C:\Users\lasse\Desktop\find-hitler`
**Port:** 3003
**Start:** Double-click `find-hitler.bat` on Desktop

**Tech Stack:**
- Next.js 14+ App Router, React 18, Tailwind CSS + `@tailwindcss/typography`
- Vitest for unit tests (`npm test`)
- cheerio (server-side HTML sanitization) + DOMPurify (client-side)
- `@/` alias resolves to `src/`

**Target Categories:**
| Category | Examples |
|---|---|
| Historical villains | Adolf Hitler, Stalin, Mao, Pol Pot |
| Religion & mythology | Jesus, Muhammad, Satan, Zeus |
| Pop culture | Taylor Swift, Star Wars, Beatles |
| Science & concepts | Black Hole, DNA, Atomic Bomb |
| Internet / meme | Minecraft, Reddit, 4chan |
| Shock / Controversial | 9/11, Holocaust, Serial killer, War crimes |

---

## Phase Status

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | ✅ SHIPPED | Solo core loop |
| **Phase 2** | ⬜ NEXT | Multiplayer lobbies + bots |
| **Phase 3** | ⬜ | All game modes |
| **Phase 4** | ⬜ | Post-game node graph + leaderboard |
| **Phase 5** | ⬜ | Accounts + ELO/ranked duels |

---

## Phase 1 — Solo Core Loop ✅ SHIPPED

**What was built:**
- Wikipedia engine: MediaWiki parse API → cheerio → DOMPurify double-sanitization
- In-memory game state (`globalThis._gamesStore`, survives hot-reload)
- Server-authoritative anti-cheat: every link validated against `allowedMoves[]`
- API routes: `POST /api/game/start`, `POST /api/game/move`, `POST /api/game/undo`
- Components: WikiArticle (event delegation + Ctrl+F block), GameHUD (pill + scoreboard + undo tokens), WinScreen
- Home page: 8 targets × 2 modes × nickname entry → `sessionStorage` handoff → game page
- 17 unit tests (scoring, wikipedia engine, game state)
- Desktop `.bat` launcher

**Key files:**
```
src/lib/wikipedia.js      — fetchAndSanitizeWiki(), getRandomWikiPage()
src/lib/gameState.js      — createGame, getGame, getPlayer, updatePlayerMove, useUndoToken
src/lib/scoring.js        — calculateScore({ mode, clicks, seconds })
src/app/api/game/start/   — POST: random page, create session
src/app/api/game/move/    — POST: validate + advance + win check
src/app/api/game/undo/    — POST: pop history, restore page
src/components/WikiArticle.jsx
src/components/GameHUD.jsx
src/components/WinScreen.jsx
src/app/page.jsx          — home screen
src/app/play/page.jsx     — game screen
```

**Scoring formulas:**
- Classic: `max(0, 10000 - clicks×500 - seconds×10)`
- Speedrun: `max(0, 10000 - seconds×100 - clicks×50)`

---

## Phase 2 — Multiplayer & Lobbies ⬜

### Spec

**Goal:** Real-time multiplayer races using Socket.io. Players join lobby rooms, race simultaneously, and see each other's live position in the sidebar feed.

**Architecture change:** Replace Next.js-only API routes with a **custom `server.js`** that runs Socket.io alongside Next.js. All Phase 1 API routes remain but game state is now broadcast in real-time.

**Custom server setup (`server.js` at project root):**
```js
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'

const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })
  const io = new Server(httpServer)
  // attach io to globalThis so API routes can emit events
  globalThis._io = io
  setupSocketHandlers(io)
  httpServer.listen(3003)
})
```

**Room model (extends existing gameState.js):**
```
rooms: Map<roomCode, {
  host: playerId,
  mode, target,
  status: 'waiting' | 'racing' | 'finished',
  players: Map<playerId, { name, clicks, currentPage, isBot, hp? }>
}>
```

**Socket.io events:**
| Event | Direction | Payload |
|---|---|---|
| `room:create` | client→server | `{ playerName, mode, target }` → returns `{ roomCode }` |
| `room:join` | client→server | `{ roomCode, playerName }` |
| `room:state` | server→room | `{ players[], status, mode, target }` |
| `game:start` | client→server | host only |
| `game:navigate` | client→server | `{ target: wikiTitle }` — server validates, updates, broadcasts |
| `game:state-update` | server→room | `{ playerId, clicks, currentPage }` — feeds live feed |
| `game:finish` | server→room | `{ winnerId, scores[], paths[] }` |
| `player:leave` | client→server | — |

**New pages:**
- `/lobby/[code]` — waiting room, shows player list, host has Start button
- `/play/[roomId]` — multiplayer game (reuses WikiArticle, GameHUD, adds live feed sidebar)

**Live race feed (right sidebar, compact):**
```
⚡ LIVE RACE FEED
● YOU (lasse)      4 clicks → Coffee production in Brazil
● DeepLink_9000    3 clicks → World War II  ← orange if hub page
● WikiBot_Krantz   7 clicks → Brazilian tree frog
```

**Bot system:**
- BFS pathfinding at game start: pre-compute bot's route through Wikipedia graph (depth-limited, max 8 hops)
- Click timing: gaussian distribution — Easy ~8s/click, Medium ~4s/click, Hard ~1.5s/click
- Bot emits same `game:navigate` events as real players — server validates identically
- Bot names: absurd game-show style (`DeepLink_9000`, `WikiBot_Krantz`, `HyperLink_Rex`)

**Custom lobby (mix friends + bots):**
- When creating a room, host sets room size (2–6) and how many bot slots to fill
- Empty real-player slots auto-fill with bots when host starts

**New dependencies:**
```bash
npm install socket.io socket.io-client
```

**Update `package.json` dev script:**
```json
"dev": "node server.js"
```

---

### Phase 2 Handoff Prompt

```
You are continuing development of "Find Hitler" — a WikiRace game at C:\Users\lasse\Desktop\find-hitler (port 3003).

PHASE 1 IS COMPLETE. The following already works:
- Solo gameplay: home page → random Wikipedia start → navigate links → win screen
- API routes: /api/game/start, /api/game/move, /api/game/undo (all server-authoritative)
- 17 unit tests passing (npm test)
- lib/wikipedia.js, lib/gameState.js, lib/scoring.js are all complete and tested
- Components: WikiArticle, GameHUD, WinScreen

YOUR TASK IS PHASE 2: Real-time multiplayer using Socket.io.

Read the full roadmap at C:\Users\lasse\Desktop\find-hitler\docs\ROADMAP.md — it has the complete Phase 2 spec including architecture, Socket.io events, bot system, and room model.

Start by invoking the superpowers:writing-plans skill to create a detailed implementation plan for Phase 2 before writing any code. The plan should go to docs/superpowers/plans/YYYY-MM-DD-find-hitler-phase2.md.

Key constraints:
- Port stays 3003
- Phase 1 API routes must still work (just add Socket.io alongside)
- All game logic stays server-authoritative
- Bots use the same validation path as real players
- @/ alias resolves to src/
```

---

## Phase 3 — All Game Modes ⬜

### Spec

**Goal:** Implement the full suite of game modes beyond Classic and Speedrun.

**Golf Mode:**
- 5-minute hard cap for all players
- Everyone plays simultaneously (same start page, same target)
- Winner = fewest clicks when timer expires (or first to finish)
- Score = clicks (lower = better, like golf)
- No per-player timers — one global countdown shown to all

**5 Clicks to Jesus (Golf variant):**
- Target is always "Jesus" regardless of home screen selection
- 5 rounds per match
- Par = 5 clicks. Birdie = 4, Eagle = 3, Bogey = 6, Double Bogey = 7+, Hole-in-One = 1
- Cumulative score across 5 rounds (lowest wins)
- Between rounds: show current leaderboard, same starting page regenerated
- Special "Par" celebration animation on exact 5 clicks

**Hardcore Modifier (stacks on any mode):**
- 0 undo tokens (undo button disabled)
- Classic: adds hard 5-minute cap (normally uncapped)
- Golf: cap reduced to 2:30
- Speedrun: cap halved
- Damage multiplier ×2 in HP Duels

**Daily Challenge:**
- Fixed start + end page for the entire UTC day (same for all players globally)
- One attempt per day per player (stored in localStorage for guests, DB for accounts)
- After completing: show global leaderboard for today's challenge
- Seeded RNG using date string: `seed = YYYY-MM-DD`
- Use pre-curated list of start/end pairs indexed by seed

**No-Hub Challenge:**
- Server maintains a blocklist of ~200 hub pages: countries, continents, major years, and top-50 most-linked Wikipedia articles
- If player clicks a hub page: move is rejected, they bounce back to previous page, lose 1 undo token
- Bounce animation on client when hub is detected
- Blocklist stored in `src/lib/hubBlocklist.js`
- Sample blocklist entries: "United States", "United Kingdom", "Europe", "Asia", "1945", "World War II", "Germany", "France", "English language", etc.

**Speedrun (improvement):**
- Add curated hub pages per target — 5 starting pages that guarantee a path to the target within 4 clicks
- Curated hubs stored in `src/lib/speedrunHubs.js`

**New dependencies:** None (all server-side logic)

---

### Phase 3 Handoff Prompt

```
You are continuing development of "Find Hitler" — a WikiRace game at C:\Users\lasse\Desktop\find-hitler (port 3003).

PHASES 1 AND 2 ARE COMPLETE:
- Phase 1: Solo core loop (Wikipedia engine, anti-cheat, API routes, game/home pages)
- Phase 2: Socket.io multiplayer (lobbies, live race feed, bot opponents)

YOUR TASK IS PHASE 3: Implementing all game modes.

Read the full roadmap at C:\Users\lasse\Desktop\find-hitler\docs\ROADMAP.md — it has the complete Phase 3 spec including:
- Golf Mode (5-min cap, fewest clicks)
- 5 Clicks to Jesus (5 rounds, par scoring, special celebrations)
- Hardcore Modifier (no undo, time caps)
- Daily Challenge (seeded daily start/end, one attempt, leaderboard)
- No-Hub Challenge (hub page blocklist, bounce-back mechanic)
- Speedrun hub pages (curated starts per target)

Start by invoking the superpowers:writing-plans skill to create a detailed implementation plan for Phase 3. Plan goes to docs/superpowers/plans/YYYY-MM-DD-find-hitler-phase3.md.

Key constraints:
- All new modes plug into existing Socket.io event system from Phase 2
- Hub blocklist lives in src/lib/hubBlocklist.js
- Daily challenge seed = YYYY-MM-DD string → deterministic page pair
- Par scoring in 5-Clicks-to-Jesus must be server-calculated
```

---

## Phase 4 — Post-Game Visualization + Leaderboard ⬜

### Spec

**Goal:** Build the shareable post-game moment and global leaderboards. This is the viral mechanic.

**Node Graph Visualizer (D3.js):**
- Displayed on `/results/[roomId]` after every game
- Each player's path = a line of connected circular nodes
- Node = Wikipedia article title (shortened to 20 chars if long)
- Winner's path = green line (#2ecc71)
- Loser paths = red (#e74c3c), orange (#e67e22), blue (#3498db) by finish order
- Dead-end branches (if player went down a wrong path then undid) = faded grey stubs
- Force-directed layout using D3 `forceSimulation` — nodes repel, links attract
- Clicking a node shows the full Wikipedia title tooltip
- "Copy Path" button: exports path as text `Brazil → Coffee → Europe → Germany → Adolf Hitler`
- "Share" button: copies a shareable URL or generates a screenshot-friendly summary card

**Results page layout:**
```
┌─────────────────────────────────────┐
│  RACE COMPLETE                       │
│  Target: Adolf Hitler                │
├─────────────────────────────────────┤
│         [D3 Node Graph]              │
│                                      │
│  🟢 lasse: 4 clicks · 47s · 7,530pt │
│  🔴 DeepLink: 7 clicks · DNF         │
├─────────────────────────────────────┤
│  [Copy Path]  [Share]  [Play Again] │
└─────────────────────────────────────┘
```

**Leaderboard page (`/leaderboard`):**
- Tabs: Today (Daily Challenge) | All-Time (Classic) | Speedrun
- Columns: Rank, Player, Target, Clicks, Time, Score, Date
- Guest scores stored in localStorage (up to 50 entries, LRU eviction)
- Account scores stored in DB (Phase 5)
- Filter by target page
- Paginated (25 per page)

**New dependencies:**
```bash
npm install d3
```

---

### Phase 4 Handoff Prompt

```
You are continuing development of "Find Hitler" — a WikiRace game at C:\Users\lasse\Desktop\find-hitler (port 3003).

PHASES 1-3 ARE COMPLETE:
- Phase 1: Solo core loop
- Phase 2: Socket.io multiplayer + bots
- Phase 3: All game modes (Golf, 5-Clicks-to-Jesus, Daily Challenge, No-Hub, Hardcore)

YOUR TASK IS PHASE 4: Post-game node graph visualizer and leaderboard.

Read the full roadmap at C:\Users\lasse\Desktop\find-hitler\docs\ROADMAP.md — it has the complete Phase 4 spec including:
- D3.js force-directed node graph (player paths as colored lines)
- Dead-end branch visualization
- Share/copy path functionality
- Leaderboard page with tabs (Today, All-Time, Speedrun)
- localStorage persistence for guest scores

Start by invoking the superpowers:writing-plans skill. Plan goes to docs/superpowers/plans/YYYY-MM-DD-find-hitler-phase4.md.

Key constraints:
- D3 is client-only ('use client') — use dynamic import if SSR issues arise
- Path data comes from the 'game:finish' Socket.io event (array of page titles per player)
- Guest leaderboard uses localStorage, max 50 entries
- npm install d3 before starting
```

---

## Phase 5 — Accounts + ELO/Ranked Duels ⬜

### Spec

**Goal:** Persistent identity, ranked play, and the HP duel system.

**Authentication (NextAuth.js):**
- Email magic link (no passwords, no OAuth complexity)
- Guest play still works without account
- Creating account migrates localStorage scores to DB
- Session stored in HTTP-only cookie

**Database (PostgreSQL + Prisma):**
- Hosted: Supabase free tier or Railway.app hobby
- Schema:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  elo       Int      @default(1000)
  rank      Rank     @default(BRONZE)
  matches   Match[]
  createdAt DateTime @default(now())
}

model Match {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  target    String
  mode      String
  clicks    Int
  seconds   Int
  score     Int
  path      String[] // array of page titles
  won       Boolean
  eloChange Int
  playedAt  DateTime @default(now())
}
```

**ELO System:**
- Starting ELO: 1000
- Rank tiers: Bronze (0–1199) | Silver (1200–1499) | Gold (1500–1799) | Master (1800+)
- K-factor: 32 (standard)
- Formula: `new_elo = old_elo + K * (result - expected)` where `expected = 1 / (1 + 10^((opponent_elo - player_elo)/400))`
- ELO only changes in Ranked Duel mode (not casual multiplayer)

**HP Duel (1v1 ranked):**
- Both start at 5,000 HP
- When round timer expires, server runs BFS from loser's current page to target (depth-limited to 6)
- Damage = `distance × 500` HP. Dead end = 2,500 HP flat
- Win a round: stay at HP. Lose a round: take damage
- Rounds continue until someone reaches 0 HP
- ELO transferred from loser to winner after match

**BFS distance calculation:**
- Wikipedia's API can return linked pages (`action=query&prop=links`) — use this for BFS
- Cache BFS results in-memory for the same target (common in ranked play)
- Depth limit: 6 hops max. If not reachable within 6 = max damage (2,500 HP)

**Ranked matchmaking:**
- Queue: player clicks "Find Match" → added to ranked queue
- Match players within 200 ELO points of each other
- If no match in 30s → expand range by 100 ELO
- WebSocket `ranked:queued`, `ranked:matched`, `ranked:start` events

**New pages:**
- `/ranked` — ELO display, matchmaking queue, rank badge
- `/profile` — match history, win rate, ELO history graph

**New dependencies:**
```bash
npm install next-auth @prisma/client prisma
npx prisma init
```

---

### Phase 5 Handoff Prompt

```
You are continuing development of "Find Hitler" — a WikiRace game at C:\Users\lasse\Desktop\find-hitler (port 3003).

PHASES 1-4 ARE COMPLETE:
- Phase 1: Solo core loop
- Phase 2: Socket.io multiplayer + bots
- Phase 3: All game modes
- Phase 4: D3 node graph post-game + leaderboard

YOUR TASK IS PHASE 5: User accounts, ELO ranking system, and HP Duels.

Read the full roadmap at C:\Users\lasse\Desktop\find-hitler\docs\ROADMAP.md — it has the complete Phase 5 spec including:
- NextAuth.js email magic link auth
- PostgreSQL + Prisma schema (User, Match models)
- ELO formula + K-factor + rank tier thresholds
- HP Duel format (round-based, BFS distance damage)
- Ranked matchmaking queue with ELO bracket expansion
- New pages: /ranked, /profile

Start by setting up the database FIRST (Supabase or Railway.app), then invoke the superpowers:writing-plans skill. Plan goes to docs/superpowers/plans/YYYY-MM-DD-find-hitler-phase5.md.

Key constraints:
- Guest play must continue to work without accounts
- ELO changes ONLY in Ranked Duel mode (not casual lobbies)
- BFS distance calculation is depth-limited to 6 hops
- npm install next-auth @prisma/client prisma before starting
- Run npx prisma init and configure DATABASE_URL in .env.local
```

---

## Development Notes

**Running locally:**
```
Double-click find-hitler.bat on Desktop
OR: cd C:\Users\lasse\Desktop\find-hitler && npm run dev
```

**Running tests:**
```
cd C:\Users\lasse\Desktop\find-hitler && npm test
```

**Git workflow:** One branch per phase (`feat/phase-2-multiplayer`, etc.), merge to master when complete.

**Logs:** Append session log to `logs/YYYY-MM-DD.md` after every work session.

**Design reference:** The HUD mockup is at `.superpowers/brainstorm/` — retro game show aesthetic, dark #1a1a2e backgrounds, yellow #f1c40f numbers, red #c0392b danger elements.
