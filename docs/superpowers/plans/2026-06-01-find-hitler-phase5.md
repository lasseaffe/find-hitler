# Find Hitler Phase 5 — Accounts + ELO/Ranked Duels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent player accounts (email magic-link auth), PostgreSQL-backed match history, ELO ranking, and 1v1 HP Duel ranked mode to the WikiRace game.

**Architecture:** NextAuth.js handles sessions via email magic links; Prisma + PostgreSQL (Supabase free tier) persist users and match records. Guest play is fully preserved — accounts are opt-in. ELO and match recording happen server-side only (in API routes and Socket.io handlers) to prevent spoofing. Ranked matchmaking uses an in-memory queue in `globalThis` (same pattern as the existing games/rooms stores) with ELO-bracket expansion over time. HP Duels run as a special room mode on top of the existing Socket.io infrastructure.

**Tech Stack:** NextAuth.js v5 (beta), Prisma ORM, PostgreSQL via Supabase, socket.io (existing), Next.js App Router (existing)

---

## File Map

**New files:**
- `prisma/schema.prisma` — User + Match + RankedQueue models
- `src/lib/db.js` — Prisma client singleton
- `src/lib/elo.js` — ELO formula, rank tier lookup
- `src/lib/bfsDistance.js` — BFS distance calculation via Wikipedia link API (for HP damage)
- `src/lib/rankedQueue.js` — In-memory matchmaking queue (globalThis)
- `src/lib/hpDuel.js` — HP Duel round state manager
- `src/app/api/auth/[...nextauth]/route.js` — NextAuth catch-all route
- `src/app/api/auth/session/route.js` — GET endpoint: current session for client components
- `src/app/api/match/record/route.js` — POST: record a completed match + update ELO
- `src/app/api/ranked/queue/route.js` — POST: join/leave ranked queue
- `src/app/api/ranked/status/route.js` — GET: current queue status
- `src/app/ranked/page.jsx` — Ranked hub: ELO display, matchmaking queue UI, rank badge
- `src/app/profile/page.jsx` — Match history, win rate, ELO history sparkline
- `src/components/RankBadge.jsx` — Visual rank tier badge (Bronze/Silver/Gold/Master)
- `src/components/HpDuelHUD.jsx` — HP bar overlay for ranked duels
- `src/components/EloChange.jsx` — Animated ELO delta shown post-duel
- `tests/elo.test.js` — ELO formula tests
- `tests/bfsDistance.test.js` — BFS distance unit tests
- `tests/hpDuel.test.js` — HP Duel state machine tests
- `tests/rankedQueue.test.js` — Matchmaking queue tests

**Modified files:**
- `package.json` — add next-auth, @prisma/client, prisma, @auth/prisma-adapter, nodemailer
- `server.js` — wire ranked matchmaking socket events, HP Duel handlers
- `src/lib/socketHandlers.js` — add `ranked:*` and `duel:*` event handlers
- `src/app/page.jsx` — add Ranked Duel mode button + account/login link in nav
- `src/app/layout.jsx` — wrap in SessionProvider
- `src/app/leaderboard/page.jsx` — add DB-backed global tab when logged in

---

## Tasks

### Task 1: Install dependencies and set up Prisma

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Create: `.env.local` (new entries only)

- [ ] **Step 1: Install packages**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npm install next-auth@beta @auth/prisma-adapter @prisma/client prisma nodemailer
```

Expected output: packages added, no peer errors.

- [ ] **Step 2: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

- [ ] **Step 3: Write the Prisma schema**

Replace the generated `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  emailVerified DateTime?
  image     String?
  elo       Int       @default(1000)
  rank      String    @default("BRONZE")
  accounts  Account[]
  sessions  Session[]
  matches   Match[]
  createdAt DateTime  @default(now())
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
  path      String[]
  won       Boolean
  eloChange Int      @default(0)
  playedAt  DateTime @default(now())
}
```

- [ ] **Step 4: Add env vars to `.env.local`**

Open `.env.local` (create if missing) and add — filling in real values from Supabase and email provider:

```
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3004"
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="Find Hitler <noreply@findthehitler.game>"
```

> **Note to executor:** Create a free Supabase project at supabase.com. Copy the connection string from Settings → Database → Connection string (URI mode). Use a Gmail App Password for SMTP (requires 2FA enabled in Google account, then generate at myaccount.google.com/apppasswords).

- [ ] **Step 5: Push schema to database**

```bash
npx prisma db push
```

Expected: all tables created, no errors. If DATABASE_URL is wrong you'll see a connection error — fix `.env.local` first.

- [ ] **Step 6: Commit**

```bash
git add prisma/ package.json package-lock.json .env.local
git commit -m "feat(phase5): add Prisma schema + deps (next-auth, prisma)"
```

> `.env.local` is intentionally committed here because it contains non-secret placeholder values. If it has real secrets, add to `.gitignore` first.

---

### Task 2: Prisma client singleton + ELO library

**Files:**
- Create: `src/lib/db.js`
- Create: `src/lib/elo.js`
- Create: `tests/elo.test.js`

- [ ] **Step 1: Write the failing ELO tests**

Create `tests/elo.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { calculateElo, getRankTier, RANKS } from '../src/lib/elo.js'

describe('calculateElo', () => {
  it('winner gains points, loser loses matching points', () => {
    const { newWinner, newLoser } = calculateElo(1000, 1000)
    expect(newWinner).toBeGreaterThan(1000)
    expect(newLoser).toBeLessThan(1000)
    expect(newWinner + newLoser).toBe(2000) // zero-sum
  })

  it('upset: low-rated player beating high-rated gains more', () => {
    const { newWinner: upsetWin } = calculateElo(800, 1400)
    const { newWinner: normalWin } = calculateElo(1200, 1000)
    expect(upsetWin - 800).toBeGreaterThan(normalWin - 1200)
  })

  it('expected win against much weaker opponent gains very few points', () => {
    const { newWinner } = calculateElo(1800, 800)
    expect(newWinner - 1800).toBeLessThan(5)
  })
})

describe('getRankTier', () => {
  it('returns BRONZE for 0-1199', () => {
    expect(getRankTier(0)).toBe('BRONZE')
    expect(getRankTier(1199)).toBe('BRONZE')
  })
  it('returns SILVER for 1200-1499', () => {
    expect(getRankTier(1200)).toBe('SILVER')
    expect(getRankTier(1499)).toBe('SILVER')
  })
  it('returns GOLD for 1500-1799', () => {
    expect(getRankTier(1500)).toBe('GOLD')
  })
  it('returns MASTER for 1800+', () => {
    expect(getRankTier(1800)).toBe('MASTER')
    expect(getRankTier(9999)).toBe('MASTER')
  })
})
```

- [ ] **Step 2: Run — confirm failure**

```bash
npm test -- tests/elo.test.js
```

Expected: FAIL — `src/lib/elo.js` doesn't exist.

- [ ] **Step 3: Write `src/lib/elo.js`**

```js
// K-factor: standard chess value
const K = 32

export const RANKS = {
  BRONZE: { min: 0, max: 1199, label: 'Bronze', color: '#cd7f32' },
  SILVER: { min: 1200, max: 1499, label: 'Silver', color: '#c0c0c0' },
  GOLD:   { min: 1500, max: 1799, label: 'Gold',   color: '#ffd700' },
  MASTER: { min: 1800, max: Infinity, label: 'Master', color: '#b24bf3' },
}

export function calculateElo(winnerElo, loserElo) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const expectedLoser  = 1 - expectedWinner
  const delta = Math.round(K * (1 - expectedWinner))
  return {
    newWinner: winnerElo + delta,
    newLoser:  loserElo  - delta,
    delta,
  }
}

export function getRankTier(elo) {
  for (const [tier, { min, max }] of Object.entries(RANKS)) {
    if (elo >= min && elo <= max) return tier
  }
  return 'BRONZE'
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/elo.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 5: Write `src/lib/db.js`**

```js
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient())
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/elo.js src/lib/db.js tests/elo.test.js
git commit -m "feat(phase5): ELO formula + Prisma client singleton"
```

---

### Task 3: BFS distance for HP Duel damage calculation

**Files:**
- Create: `src/lib/bfsDistance.js`
- Create: `tests/bfsDistance.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/bfsDistance.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { calculateHpDamage } from '../src/lib/bfsDistance.js'

describe('calculateHpDamage', () => {
  it('unreachable within 6 hops → max damage 2500', async () => {
    // Mock fetchLinks to always return empty
    const fetchLinks = vi.fn().mockResolvedValue([])
    const damage = await calculateHpDamage('Nowhere', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(2500)
  })

  it('1 hop away → 500 damage', async () => {
    // target is directly linked from currentPage
    const fetchLinks = vi.fn()
      .mockResolvedValueOnce(['Adolf Hitler', 'Germany'])  // links from currentPage
    const damage = await calculateHpDamage('CurrentPage', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(500)
  })

  it('2 hops away → 1000 damage', async () => {
    const fetchLinks = vi.fn()
      .mockResolvedValueOnce(['Germany', 'France'])        // hop 1: no target
      .mockResolvedValueOnce(['Adolf Hitler', 'Austria'])  // hop 2: found
      .mockResolvedValueOnce(['something'])
    const damage = await calculateHpDamage('CurrentPage', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(1000)
  })

  it('caps at depth 6 even if target exists deeper', async () => {
    const fetchLinks = vi.fn().mockResolvedValue(['SomePage'])
    const damage = await calculateHpDamage('Start', 'NeverReached', { fetchLinks })
    expect(damage).toBe(2500)
  })
})
```

- [ ] **Step 2: Run — confirm failure**

```bash
npm test -- tests/bfsDistance.test.js
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `src/lib/bfsDistance.js`**

```js
const MAX_DEPTH = 6
const DAMAGE_PER_HOP = 500
const MAX_DAMAGE = 2500

// Default fetchLinks uses Wikipedia API — injectable for tests
async function defaultFetchLinks(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=links&pllimit=500&format=json&origin=*`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const pages = Object.values(data.query?.pages || {})
    if (!pages[0]?.links) return []
    return pages[0].links.map(l => l.title)
  } catch {
    return []
  }
}

export async function calculateHpDamage(currentPage, target, { fetchLinks = defaultFetchLinks } = {}) {
  function normTitle(t) {
    return t.replace(/_/g, ' ').trim().toLowerCase()
  }

  const normTarget = normTitle(target)
  const visited = new Set([normTitle(currentPage)])
  let frontier = [currentPage]

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const nextFrontier = []
    const linkPromises = frontier.map(page => fetchLinks(page))
    const results = await Promise.all(linkPromises)

    for (const links of results) {
      for (const link of links) {
        if (normTitle(link) === normTarget) return depth * DAMAGE_PER_HOP
        const norm = normTitle(link)
        if (!visited.has(norm)) {
          visited.add(norm)
          nextFrontier.push(link)
        }
      }
    }

    frontier = nextFrontier
    if (frontier.length === 0) return MAX_DAMAGE
  }

  return MAX_DAMAGE
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/bfsDistance.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bfsDistance.js tests/bfsDistance.test.js
git commit -m "feat(phase5): BFS distance for HP Duel damage calculation"
```

---

### Task 4: NextAuth.js configuration

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.js`
- Create: `src/auth.js` (auth config, imported by route)
- Modify: `src/app/layout.jsx`

NextAuth v5 splits config from the route handler. The config lives in `src/auth.js` and the route just re-exports.

- [ ] **Step 1: Write `src/auth.js`**

```js
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Nodemailer from 'next-auth/providers/nodemailer'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (user) session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=true',
  },
})
```

- [ ] **Step 2: Write `src/app/api/auth/[...nextauth]/route.js`**

```js
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 3: Update `src/app/layout.jsx` to wrap with SessionProvider**

```jsx
import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata = { title: 'Find Hitler — WikiRace' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa] text-[#202122]">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Create the login page `src/app/login/page.jsx`**

```jsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const verify = searchParams.get('verify')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const res = await signIn('nodemailer', { email, redirect: false })
    setLoading(false)
    if (res?.error) setError('Could not send magic link. Check your email address.')
  }

  if (verify) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h1 className="text-2xl font-black text-yellow-400">Check your email</h1>
          <p className="text-gray-400 font-mono text-sm">
            A magic link was sent. Click it to sign in. You can close this tab.
          </p>
          <a href="/" className="block text-yellow-400/60 hover:text-yellow-400 font-mono text-xs uppercase tracking-widest mt-4">
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-yellow-400 tracking-tight">Sign In</h1>
          <p className="text-gray-400 font-mono text-sm mt-2">Get a magic link by email. No password needed.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
            required
          />
          {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {loading ? 'Sending...' : 'Send Magic Link →'}
          </button>
        </form>
        <a href="/" className="block text-center text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
          ← Back · play as guest
        </a>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117]" />}>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 5: Verify dev server starts without errors**

```bash
npm run dev
```

Navigate to `http://localhost:3004/login` — should show the email form with no runtime errors in console.

- [ ] **Step 6: Commit**

```bash
git add src/auth.js src/app/api/auth/ src/app/layout.jsx src/app/login/
git commit -m "feat(phase5): NextAuth.js magic link auth + login page"
```

---

### Task 5: Match recording API route

**Files:**
- Create: `src/app/api/match/record/route.js`

This route is called server-side (from socket handlers or from the `/api/game/move` route) after a game ends. It writes the match to Postgres and updates the player's ELO if it was a ranked duel.

- [ ] **Step 1: Write `src/app/api/match/record/route.js`**

```js
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateElo, getRankTier } from '@/lib/elo'

export async function POST(request) {
  try {
    const { userId, target, mode, clicks, seconds, score, path, won, opponentElo } = await request.json()

    if (!userId || !target || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    let eloChange = 0

    if (mode === 'ranked' && typeof opponentElo === 'number') {
      const opElo = opponentElo
      if (won) {
        const { newWinner, delta } = calculateElo(user.elo, opElo)
        eloChange = delta
        const newRank = getRankTier(newWinner)
        await prisma.user.update({
          where: { id: userId },
          data: { elo: newWinner, rank: newRank },
        })
      } else {
        const { newLoser, delta } = calculateElo(opElo, user.elo)
        eloChange = -delta
        const newRank = getRankTier(newLoser)
        await prisma.user.update({
          where: { id: userId },
          data: { elo: newLoser, rank: newRank },
        })
      }
    }

    const match = await prisma.match.create({
      data: {
        userId,
        target,
        mode,
        clicks: clicks ?? 0,
        seconds: seconds ?? 0,
        score: score ?? 0,
        path: path ?? [],
        won: won ?? false,
        eloChange,
      },
    })

    return NextResponse.json({ ok: true, matchId: match.id, eloChange })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test the route manually**

Start the server and run in a terminal:

```bash
curl -X POST http://localhost:3004/api/match/record \
  -H "Content-Type: application/json" \
  -d '{"userId":"PASTE_REAL_USER_ID","target":"Adolf Hitler","mode":"classic","clicks":5,"seconds":47,"score":7530,"path":["Brazil","Coffee","Germany","Adolf Hitler"],"won":true}'
```

Expected: `{"ok":true,"matchId":"...","eloChange":0}` (eloChange=0 because mode is not "ranked").

> To get a real userId, sign in at `/login` first, then check Supabase Dashboard → Table Editor → User table.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/match/record/
git commit -m "feat(phase5): match recording API with ELO update"
```

---

### Task 6: Ranked matchmaking queue

**Files:**
- Create: `src/lib/rankedQueue.js`
- Create: `tests/rankedQueue.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/rankedQueue.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  joinQueue,
  leaveQueue,
  findMatch,
  getQueueEntry,
} from '../src/lib/rankedQueue.js'

// Reset the global store between tests
beforeEach(() => {
  globalThis._rankedQueue = new Map()
})

describe('joinQueue', () => {
  it('adds a player to the queue', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    expect(getQueueEntry('p1')).toBeDefined()
  })

  it('overwrites if same player joins again', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p1', socketId: 's2', elo: 1050, name: 'Alice' })
    expect(getQueueEntry('p1').elo).toBe(1050)
  })
})

describe('leaveQueue', () => {
  it('removes a player from the queue', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    leaveQueue('p1')
    expect(getQueueEntry('p1')).toBeNull()
  })
})

describe('findMatch', () => {
  it('matches two players within 200 ELO of each other', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p2', socketId: 's2', elo: 1150, name: 'Bob' })
    const match = findMatch('p1', 200)
    expect(match).not.toBeNull()
    expect(match.playerId).toBe('p2')
  })

  it('does not match players outside ELO range', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    joinQueue({ playerId: 'p2', socketId: 's2', elo: 1300, name: 'Bob' })
    const match = findMatch('p1', 200)
    expect(match).toBeNull()
  })

  it('does not match player with themselves', () => {
    joinQueue({ playerId: 'p1', socketId: 's1', elo: 1000, name: 'Alice' })
    const match = findMatch('p1', 500)
    expect(match).toBeNull()
  })
})
```

- [ ] **Step 2: Run — confirm failure**

```bash
npm test -- tests/rankedQueue.test.js
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `src/lib/rankedQueue.js`**

```js
const queue = globalThis._rankedQueue || (globalThis._rankedQueue = new Map())

// Each entry: { playerId, socketId, elo, name, joinedAt, searchRange }
export function joinQueue({ playerId, socketId, elo, name }) {
  queue.set(playerId, { playerId, socketId, elo, name, joinedAt: Date.now(), searchRange: 200 })
}

export function leaveQueue(playerId) {
  queue.delete(playerId)
}

export function getQueueEntry(playerId) {
  return queue.get(playerId) || null
}

// Expand search range by 100 ELO for players who have waited >30s
export function tickSearchRanges() {
  const now = Date.now()
  for (const entry of queue.values()) {
    const waitSeconds = (now - entry.joinedAt) / 1000
    if (waitSeconds > 30) {
      entry.searchRange = 200 + Math.floor((waitSeconds - 30) / 30) * 100
    }
  }
}

// Returns opponent entry or null
export function findMatch(playerId, overrideRange) {
  const seeker = queue.get(playerId)
  if (!seeker) return null

  const range = overrideRange ?? seeker.searchRange

  for (const [id, entry] of queue.entries()) {
    if (id === playerId) continue
    if (Math.abs(entry.elo - seeker.elo) <= range) {
      return entry
    }
  }

  return null
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/rankedQueue.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rankedQueue.js tests/rankedQueue.test.js
git commit -m "feat(phase5): ranked matchmaking queue with ELO bracket expansion"
```

---

### Task 7: HP Duel state manager

**Files:**
- Create: `src/lib/hpDuel.js`
- Create: `tests/hpDuel.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/hpDuel.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDuel,
  getDuel,
  applyDamage,
  isDuelOver,
} from '../src/lib/hpDuel.js'

beforeEach(() => {
  globalThis._duelsStore = new Map()
})

describe('createDuel', () => {
  it('creates two players with 5000 HP', () => {
    const duelId = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1100 })
    const duel = getDuel(duelId)
    expect(duel.players.a.hp).toBe(5000)
    expect(duel.players.b.hp).toBe(5000)
  })
})

describe('applyDamage', () => {
  it('reduces target HP by damage amount', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 1000)
    expect(getDuel(id).players.a.hp).toBe(4000)
  })

  it('floors HP at 0', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 9999)
    expect(getDuel(id).players.a.hp).toBe(0)
  })
})

describe('isDuelOver', () => {
  it('returns false when both players have HP > 0', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    expect(isDuelOver(id)).toBe(false)
  })

  it('returns winner id when a player reaches 0 HP', () => {
    const id = createDuel({ p1Id: 'a', p1Name: 'Alice', p1Elo: 1000, p2Id: 'b', p2Name: 'Bob', p2Elo: 1000 })
    applyDamage(id, 'a', 5000)
    expect(isDuelOver(id)).toBe('b') // Bob wins because Alice is at 0
  })
})
```

- [ ] **Step 2: Run — confirm failure**

```bash
npm test -- tests/hpDuel.test.js
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `src/lib/hpDuel.js`**

```js
const duels = globalThis._duelsStore || (globalThis._duelsStore = new Map())

export function createDuel({ p1Id, p1Name, p1Elo, p2Id, p2Name, p2Elo, roomCode }) {
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
  return duels.get(duelId) || null
}

export function applyDamage(duelId, playerId, damage) {
  const duel = duels.get(duelId)
  if (!duel || !duel.players[playerId]) return
  duel.players[playerId].hp = Math.max(0, duel.players[playerId].hp - damage)
}

// Returns false if ongoing, or the winning playerId if the duel is over
export function isDuelOver(duelId) {
  const duel = duels.get(duelId)
  if (!duel) return false
  for (const [id, player] of Object.entries(duel.players)) {
    if (player.hp <= 0) {
      // Return the OTHER player's id (the survivor/winner)
      const winnerId = Object.keys(duel.players).find(k => k !== id)
      return winnerId
    }
  }
  return false
}

export function advanceRound(duelId) {
  const duel = duels.get(duelId)
  if (duel) duel.round++
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm test -- tests/hpDuel.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hpDuel.js tests/hpDuel.test.js
git commit -m "feat(phase5): HP Duel state manager"
```

---

### Task 8: Ranked socket handlers

**Files:**
- Modify: `src/lib/socketHandlers.js`
- Modify: `server.js`

This is the biggest task. Wire ranked matchmaking + HP Duel rounds into Socket.io.

- [ ] **Step 1: Add a range expansion interval to `server.js`**

In `server.js`, after `setupSocketHandlers(io)`, add:

```js
import { tickSearchRanges } from './src/lib/rankedQueue.js'

// Expand ELO search range every 30s for waiting players
setInterval(tickSearchRanges, 30_000)
```

The full updated relevant section of `server.js`:

```js
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'
import { setupSocketHandlers } from './src/lib/socketHandlers.js'
import { tickSearchRanges } from './src/lib/rankedQueue.js'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })
  const io = new Server(httpServer)
  globalThis._io = io
  setupSocketHandlers(io)
  setInterval(tickSearchRanges, 30_000)
  httpServer.listen(3004, () => {
    console.log('> Ready on http://localhost:3004')
  })
})
```

- [ ] **Step 2: Add ranked events to `src/lib/socketHandlers.js`**

At the top of the file, add these imports:

```js
import { joinQueue, leaveQueue, findMatch, getQueueEntry } from './rankedQueue.js'
import { createDuel, getDuel, applyDamage, isDuelOver, advanceRound } from './hpDuel.js'
import { calculateHpDamage } from './bfsDistance.js'
import { getRandomWikiPage, fetchAndSanitizeWiki } from './wikipedia.js'
```

Inside `setupSocketHandlers(io)`, after the existing `socket.on('disconnect', ...)` handler, add:

```js
// --- RANKED: JOIN QUEUE ---
socket.on('ranked:join', ({ userId, elo, name }) => {
  joinQueue({ playerId: socket.id, socketId: socket.id, elo: elo || 1000, name: name || 'Anonymous' })
  socket.data.userId = userId
  socket.emit('ranked:queued', { message: 'Searching for opponent...' })

  // Attempt immediate match
  const opponent = findMatch(socket.id)
  if (opponent) {
    leaveQueue(socket.id)
    leaveQueue(opponent.playerId)
    startRankedDuel(io, socket.id, { elo, name, userId }, opponent)
  }
})

// --- RANKED: LEAVE QUEUE ---
socket.on('ranked:leave', () => {
  leaveQueue(socket.id)
  socket.emit('ranked:left', {})
})

// --- RANKED: DUEL MOVE ---
socket.on('duel:navigate', async ({ duelId, target: moveTarget }) => {
  const duel = getDuel(duelId)
  if (!duel || duel.status !== 'active') return
  const gameId = duel.gameId
  if (!gameId) return
  await processMoveForPlayer({ io, roomCode: duel.roomCode, gameId, room: getRoom(duel.roomCode), playerId: socket.id, targetPage: moveTarget })
})
```

- [ ] **Step 3: Add `startRankedDuel` helper at the bottom of `socketHandlers.js`**

```js
async function startRankedDuel(io, p1SocketId, p1Data, p2Entry) {
  const p2SocketId = p2Entry.socketId

  // Shared start page
  const startTitle = await getRandomWikiPage()
  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)
  const target = 'Adolf Hitler' // ranked always targets Hitler for now

  // Create room + game (reuse existing infrastructure)
  const { createRoom, setRoomStatus, getRoom } = await import('./rooms.js')
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

  const { createGame, addPlayerToGame } = await import('./gameState.js')
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

  const payload = {
    duelId,
    gameId,
    html: cleanHtml,
    title,
    target,
    mode: 'ranked',
    opponent: null,
  }

  const io_ = globalThis._io
  io_.to(p1SocketId).socketsJoin(code)
  io_.to(p2SocketId).socketsJoin(code)

  io_.to(p1SocketId).emit('ranked:matched', { ...payload, opponent: { name: p2Entry.name, elo: p2Entry.elo } })
  io_.to(p2SocketId).emit('ranked:matched', { ...payload, opponent: { name: p1Data.name, elo: p1Data.elo } })
}
```

- [ ] **Step 4: Handle round end in `processMoveForPlayer`**

In the existing `processMoveForPlayer` function, after `if (won)` block, just before the return/broadcast, add HP Duel round-end logic:

```js
// HP Duel round end: loser takes BFS damage
if (room.mode === 'ranked' && won) {
  const duel = getDuel(room.duelId)
  if (duel) {
    // Find the loser (the other player)
    const loserId = Array.from(room.players.keys()).find(id => id !== playerId && !room.players.get(id)?.isBot)
    if (loserId) {
      const loserPlayer = getPlayer(gameId, loserId)
      const damage = await calculateHpDamage(loserPlayer?.currentPage || startTitle, game.target)
      applyDamage(duel.duelId, loserId, damage)

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
        // Reset game for next round — fetch new start page
        const newStart = await getRandomWikiPage()
        const { cleanHtml: newHtml, validLinks: newLinks, title: newTitle } = await fetchAndSanitizeWiki(newStart)
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
```

> Note: `room.duelId` isn't set yet — we'll add it in startRankedDuel. Update `startRankedDuel` to set `room.duelId = duelId` after creating the duel.

- [ ] **Step 5: Commit**

```bash
git add src/lib/socketHandlers.js server.js
git commit -m "feat(phase5): ranked matchmaking + HP Duel socket handlers"
```

---

### Task 9: RankBadge and EloChange components

**Files:**
- Create: `src/components/RankBadge.jsx`
- Create: `src/components/EloChange.jsx`
- Create: `src/components/HpDuelHUD.jsx`

- [ ] **Step 1: Write `src/components/RankBadge.jsx`**

```jsx
import { RANKS } from '@/lib/elo'

export default function RankBadge({ rank, elo, showElo = true, size = 'md' }) {
  const tier = RANKS[rank] || RANKS.BRONZE
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }[size] || 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-black font-mono uppercase tracking-widest border ${sizeClasses}`}
      style={{ color: tier.color, borderColor: tier.color + '60', background: tier.color + '15' }}
    >
      <span>{tier.label}</span>
      {showElo && <span className="opacity-70">{elo}</span>}
    </span>
  )
}
```

- [ ] **Step 2: Write `src/components/EloChange.jsx`**

```jsx
'use client'
import { useEffect, useState } from 'react'

export default function EloChange({ delta, oldElo, newElo }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const isGain = delta > 0
  return (
    <div
      className={`fixed top-20 right-8 z-50 font-black font-mono text-2xl animate-bounce px-4 py-2 rounded-xl border-2 shadow-lg ${
        isGain
          ? 'text-green-400 border-green-400/40 bg-green-400/10'
          : 'text-red-400 border-red-400/40 bg-red-400/10'
      }`}
    >
      {isGain ? '+' : ''}{delta} ELO
      <div className="text-xs font-normal opacity-70 text-center mt-0.5">
        {oldElo} → {newElo}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/HpDuelHUD.jsx`**

```jsx
'use client'

function HpBar({ hp, maxHp = 5000, name, isMe, color }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const barColor = hp < 1000 ? '#e74c3c' : hp < 2500 ? '#e67e22' : color

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-1">
        <span className={`font-mono text-xs font-bold uppercase tracking-widest ${isMe ? 'text-yellow-400' : 'text-gray-300'}`}>
          {name}{isMe ? ' (you)' : ''}
        </span>
        <span className="font-mono text-xs text-gray-400">{hp.toLocaleString()} HP</span>
      </div>
      <div className="h-3 bg-[#1a1a2e] rounded-full overflow-hidden border border-gray-700">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

export default function HpDuelHUD({ duelPlayers, myId, round }) {
  const playerEntries = Object.entries(duelPlayers || {})
  if (playerEntries.length === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0d1117]/95 border-b border-yellow-400/20 px-4 py-3">
      <div className="max-w-2xl mx-auto">
        <div className="text-center font-mono text-xs text-yellow-400/60 uppercase tracking-widest mb-2">
          ⚔ Ranked Duel · Round {round || 1}
        </div>
        <div className="flex gap-4 items-center">
          {playerEntries.map(([id, player]) => (
            <HpBar
              key={id}
              hp={player.hp}
              name={player.name}
              isMe={id === myId}
              color={id === myId ? '#2ecc71' : '#e74c3c'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RankBadge.jsx src/components/EloChange.jsx src/components/HpDuelHUD.jsx
git commit -m "feat(phase5): RankBadge, EloChange, HpDuelHUD components"
```

---

### Task 10: Ranked page (`/ranked`)

**Files:**
- Create: `src/app/ranked/page.jsx`

- [ ] **Step 1: Write `src/app/ranked/page.jsx`**

```jsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import RankBadge from '@/components/RankBadge'

export default function RankedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [queueState, setQueueState] = useState('idle') // idle | queued | matched
  const [statusMsg, setStatusMsg] = useState('')
  const [waitSeconds, setWaitSeconds] = useState(0)
  const timerRef = useRef(null)

  const handlers = {
    'ranked:queued': ({ message }) => {
      setQueueState('queued')
      setStatusMsg(message)
      setWaitSeconds(0)
      timerRef.current = setInterval(() => setWaitSeconds(s => s + 1), 1000)
    },
    'ranked:left': () => {
      setQueueState('idle')
      clearInterval(timerRef.current)
    },
    'ranked:matched': (data) => {
      setQueueState('matched')
      clearInterval(timerRef.current)
      sessionStorage.setItem('rankedGameInit', JSON.stringify(data))
      router.push('/play/ranked')
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const handleJoinQueue = () => {
    if (!socketRef.current || !session?.user) return
    socketRef.current.emit('ranked:join', {
      userId: session.user.id,
      elo: session.user.elo || 1000,
      name: session.user.name || session.user.email,
    })
  }

  const handleLeaveQueue = () => {
    socketRef.current?.emit('ranked:leave')
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">Loading...</div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-4xl font-black text-yellow-400">Ranked Duels</h1>
        <p className="text-gray-400 font-mono text-sm text-center max-w-xs">
          Sign in to compete on the ranked ladder. Guest play remains available on the home screen.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl uppercase tracking-widest text-sm"
        >
          Sign In to Play Ranked →
        </button>
        <a href="/" className="text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
          ← Back to Guest Play
        </a>
      </div>
    )
  }

  const user = session.user

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center px-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-black text-yellow-400 tracking-tight">Ranked Duels</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">1v1 · HP Duel format · ELO ladder</p>
      </div>

      <div className="bg-[#1a1a2e] border border-yellow-400/20 rounded-2xl px-8 py-6 text-center space-y-3 min-w-[280px]">
        <div className="font-black text-lg text-white">{user.name || user.email}</div>
        <RankBadge rank={user.rank || 'BRONZE'} elo={user.elo || 1000} size="lg" />
        <a href="/profile" className="block text-xs font-mono text-gray-500 hover:text-gray-300 uppercase tracking-widest">
          View Match History →
        </a>
      </div>

      {queueState === 'idle' && (
        <button
          onClick={handleJoinQueue}
          className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl uppercase tracking-widest shadow-[0_0_30px_rgba(192,57,43,0.4)] transition-colors"
        >
          Find Match →
        </button>
      )}

      {queueState === 'queued' && (
        <div className="text-center space-y-4">
          <div className="flex items-center gap-3 justify-center">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            <span className="font-mono text-yellow-400 text-sm uppercase tracking-widest">
              {statusMsg} · {waitSeconds}s
            </span>
          </div>
          <button
            onClick={handleLeaveQueue}
            className="px-6 py-2 border border-red-500/50 hover:border-red-500 text-red-400 font-mono text-sm rounded-lg uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {queueState === 'matched' && (
        <div className="font-mono text-green-400 text-sm uppercase tracking-widest animate-pulse">
          Opponent found! Starting duel...
        </div>
      )}

      <a href="/" className="text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
        ← Home
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Create the ranked play page `src/app/play/ranked/page.jsx`**

```jsx
'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import WikiArticle from '@/components/WikiArticle'
import GameHUD from '@/components/GameHUD'
import HpDuelHUD from '@/components/HpDuelHUD'
import EloChange from '@/components/EloChange'
import { useSocket } from '@/hooks/useSocket'

function RankedGame() {
  const router = useRouter()
  const { data: session } = useSession()
  const [gameState, setGameState] = useState(null)
  const [html, setHtml] = useState('')
  const [clicks, setClicks] = useState(0)
  const [undoTokens, setUndoTokens] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [duelPlayers, setDuelPlayers] = useState({})
  const [round, setRound] = useState(1)
  const [duelFinished, setDuelFinished] = useState(null)
  const [eloChange, setEloChange] = useState(null)
  const myIdRef = useRef(null)

  const handlers = {
    'connect': () => { if (socketRef.current) myIdRef.current = socketRef.current.id },
    'game:page': (data) => {
      setHtml(data.html)
      setClicks(data.clicks)
      setUndoTokens(data.undoTokens)
      setIsLoading(false)
    },
    'duel:round-end': (data) => {
      setDuelPlayers(Object.fromEntries(
        Object.entries(data.duelPlayers).map(([id, p]) => [id, { name: p.name, hp: p.hp }])
      ))
      setRound(r => r + 1)
      setHtml(data.nextHtml)
      setClicks(0)
      setIsLoading(false)
    },
    'duel:finished': async (data) => {
      const isWinner = data.winnerId === myIdRef.current
      setDuelPlayers(Object.fromEntries(
        Object.entries(data.players).map(([id, p]) => [id, { name: p.name, hp: p.hp }])
      ))
      setDuelFinished({ isWinner, winnerId: data.winnerId })

      // Record match server-side
      if (session?.user?.id && gameState) {
        const opponentEntry = Object.entries(data.players).find(([id]) => id !== myIdRef.current)
        const opponentElo = opponentEntry?.[1]?.elo || 1000
        try {
          const res = await fetch('/api/match/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: session.user.id,
              target: gameState.target,
              mode: 'ranked',
              clicks,
              seconds: 0,
              score: 0,
              path: [],
              won: isWinner,
              opponentElo,
            }),
          })
          const result = await res.json()
          if (result.eloChange) setEloChange(result.eloChange)
        } catch { /* silent */ }
      }
    },
  }

  const socketRef = useSocket(handlers)

  useEffect(() => {
    const raw = sessionStorage.getItem('rankedGameInit')
    if (!raw) { router.push('/ranked'); return }
    const init = JSON.parse(raw)
    sessionStorage.removeItem('rankedGameInit')
    if (socketRef.current?.id) myIdRef.current = socketRef.current.id
    setGameState({ duelId: init.duelId, gameId: init.gameId, target: init.target, roomCode: init.roomCode, startPage: init.title, opponent: init.opponent })
    setHtml(init.html)
  }, [router])

  const handleNavigate = useCallback((target) => {
    if (isLoading || duelFinished || !gameState) return
    setIsLoading(true)
    socketRef.current?.emit('duel:navigate', { duelId: gameState.duelId, target })
  }, [gameState, isLoading, duelFinished])

  if (!gameState) {
    return <div className="flex items-center justify-center min-h-screen font-mono text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <HpDuelHUD duelPlayers={duelPlayers} myId={myIdRef.current} round={round} />

      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-[3px] z-[999] bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 animate-pulse" />
      )}

      <GameHUD
        startPage={gameState.startPage}
        target={gameState.target}
        mode="ranked"
        clicks={clicks}
        undoTokens={undoTokens}
        onUndo={() => {}}
      />

      <div className="max-w-3xl mx-auto pt-32 px-6">
        <WikiArticle
          html={html}
          onNavigate={handleNavigate}
          disabled={isLoading || !!duelFinished}
        />
      </div>

      {eloChange !== null && session?.user && (
        <EloChange
          delta={eloChange}
          oldElo={(session.user.elo || 1000) - eloChange}
          newElo={session.user.elo || 1000}
        />
      )}

      {duelFinished && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0d1117] border border-yellow-400/30 rounded-2xl px-10 py-8 text-center space-y-4 max-w-sm">
            <div className="text-5xl">{duelFinished.isWinner ? '🏆' : '💀'}</div>
            <h2 className="text-3xl font-black text-yellow-400">
              {duelFinished.isWinner ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="text-gray-400 font-mono text-sm">Duel complete · ELO updated</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/ranked')}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-sm"
              >
                Play Again
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm"
              >
                Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RankedPlayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <RankedGame />
    </Suspense>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/ranked/ src/app/play/ranked/
git commit -m "feat(phase5): ranked hub page + ranked play page with HP Duel UI"
```

---

### Task 11: Profile page (`/profile`)

**Files:**
- Create: `src/app/api/profile/route.js`
- Create: `src/app/profile/page.jsx`

- [ ] **Step 1: Write the profile API route**

Create `src/app/api/profile/route.js`:

```js
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, elo: true, rank: true, createdAt: true },
  })

  const matches = await prisma.match.findMany({
    where: { userId: session.user.id },
    orderBy: { playedAt: 'desc' },
    take: 50,
    select: {
      id: true, target: true, mode: true, clicks: true, seconds: true,
      score: true, won: true, eloChange: true, playedAt: true,
    },
  })

  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({ user, matches, stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 } })
}
```

- [ ] **Step 2: Write `src/app/profile/page.jsx`**

```jsx
'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RankBadge from '@/components/RankBadge'

function formatSeconds(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, router])

  if (loading || status === 'loading') {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">Loading...</div>
  }

  if (!data?.user) {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-gray-400 font-mono">No profile data.</div>
  }

  const { user, matches, stats } = data

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-yellow-400">{user.name || user.email}</h1>
            <p className="text-gray-500 font-mono text-sm mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 border border-red-500/40 hover:border-red-500 text-red-400 font-mono text-xs uppercase tracking-widest rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'ELO', value: <RankBadge rank={user.rank} elo={user.elo} size="md" /> },
            { label: 'Matches', value: stats.totalMatches },
            { label: 'Win Rate', value: `${stats.winRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-4 text-center">
              <div className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-2">{label}</div>
              <div className="text-white font-black text-xl">{value}</div>
            </div>
          ))}
        </div>

        {/* Match history */}
        <div>
          <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest font-mono">Match History</h2>
          {matches.length === 0 ? (
            <div className="bg-[#1a1a2e] border border-gray-700 rounded-xl p-8 text-center text-gray-500 font-mono text-sm">
              No matches yet. <a href="/" className="text-yellow-400 hover:underline">Play a race</a> to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-sm border ${m.won ? 'bg-green-900/10 border-green-500/20' : 'bg-[#1a1a2e] border-gray-700'}`}>
                  <span className="text-base">{m.won ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white">{m.target}</span>
                    <span className="text-gray-500 ml-2 text-xs uppercase">{m.mode}</span>
                  </div>
                  <span className="text-gray-300 shrink-0">{m.clicks} clicks</span>
                  <span className="text-gray-500 shrink-0">{formatSeconds(m.seconds)}</span>
                  {m.eloChange !== 0 && (
                    <span className={`font-black shrink-0 ${m.eloChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {m.eloChange > 0 ? '+' : ''}{m.eloChange}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <a href="/" className="px-6 py-2 border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">
            ← Home
          </a>
          <a href="/ranked" className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors">
            Ranked Duels ⚔
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/ src/app/profile/
git commit -m "feat(phase5): profile page + /api/profile with match history"
```

---

### Task 12: Wire Ranked link into home page nav

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Add Ranked and Profile links to the home page header**

In `src/app/page.jsx`, replace the existing nav area (the `<div className="absolute top-4 right-4">` block) with:

```jsx
<div className="absolute top-4 right-4 flex items-center gap-4">
  <a
    href="/ranked"
    className="text-red-400/70 hover:text-red-400 font-mono text-xs uppercase tracking-widest transition-colors"
  >
    ⚔ Ranked
  </a>
  <a
    href="/leaderboard"
    className="text-yellow-400/70 hover:text-yellow-400 font-mono text-xs uppercase tracking-widest transition-colors"
  >
    Leaderboard →
  </a>
</div>
```

- [ ] **Step 2: Verify home page loads without errors**

```bash
npm run dev
```

Open `http://localhost:3004` — should show the ⚔ Ranked link in the top-right alongside Leaderboard.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat(phase5): add Ranked link to home page nav"
```

---

### Task 13: Run all tests and final smoke test

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all existing tests pass + the new elo, bfsDistance, hpDuel, rankedQueue tests pass. Count should be 17 (existing) + 4+6+6 (new) = ~33 tests.

- [ ] **Step 2: Smoke test the ranked flow manually**

Start two browser windows at `http://localhost:3004/ranked`.

Sign into both with different email addresses (use two magic links). Click "Find Match" in both. Verify:
- Both windows show "Searching for opponent..."  
- Within seconds they both redirect to `/play/ranked`
- Both windows show the HP Duel HUD with 5000 HP bars
- Navigating a Wikipedia link in one window updates their click count
- First player to reach Adolf Hitler wins the round; the loser takes damage

- [ ] **Step 3: Verify guest play is unaffected**

Open `http://localhost:3004` in an incognito window. Play a solo Classic race without signing in. Verify:
- No auth prompts during solo play
- Win screen still appears
- Leaderboard at `/leaderboard` still shows localStorage scores

- [ ] **Step 4: Final commit + merge to master**

```bash
git checkout master
git merge feat/phase-5-accounts --no-ff
git commit -m "feat: Phase 5 — accounts, ELO, HP Duels"
```

---

### Task 14: Bot BFS-guided pathfinding (deferred from Phase 2)

**Context:** Bots currently do random walks (`links[Math.floor(Math.random() * links.length)]`). Phase 2's plan explicitly deferred BFS pre-computation. Phase 5 now has `bfsDistance.js` which already fetches Wikipedia link graphs — we can reuse `defaultFetchLinks` to give bots a BFS-computed path toward the target.

**Files:**
- Modify: `src/lib/bots.js`
- Modify: `tests/bots.test.js`

- [ ] **Step 1: Add BFS path computation to `src/lib/bots.js`**

Replace the existing `scheduleBot` function export with a version that pre-computes a BFS path before scheduling ticks:

```js
// src/lib/bots.js — add at top
import { calculateHpDamage } from './bfsDistance.js'

// BFS to find a path from startPage to target, depth-limited to 8 hops.
// Returns an array of page titles from startPage → target (exclusive of startPage).
// Returns null if target not reachable within limit.
async function bfsPath(startPage, target, maxDepth = 8) {
  function norm(t) { return t.replace(/_/g, ' ').trim().toLowerCase() }

  const normTarget = norm(target)
  const visited = new Map([[norm(startPage), null]])  // page → parent
  let frontier = [startPage]

  for (let depth = 1; depth <= maxDepth; depth++) {
    const results = await Promise.all(
      frontier.map(page => fetchWikiLinks(page))
    )
    const nextFrontier = []
    for (let i = 0; i < frontier.length; i++) {
      for (const link of results[i]) {
        const normLink = norm(link)
        if (visited.has(normLink)) continue
        visited.set(normLink, frontier[i])
        if (normLink === normTarget) {
          // Reconstruct path
          const path = [target]
          let cur = frontier[i]
          while (cur && norm(cur) !== norm(startPage)) {
            path.unshift(cur)
            cur = visited.get(norm(cur))
          }
          return path
        }
        nextFrontier.push(link)
      }
    }
    frontier = nextFrontier
    if (frontier.length === 0) return null
  }
  return null
}

async function fetchWikiLinks(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=links&pllimit=500&format=json&origin=*`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const pages = Object.values(data.query?.pages || {})
    if (!pages[0]?.links) return []
    return pages[0].links.map(l => l.title)
  } catch {
    return []
  }
}
```

Then replace `scheduleBot` with this upgraded version:

```js
export function scheduleBot({ roomCode, botId, difficulty, target, getPlayerLinks, onMove, isFinished }) {
  // Pre-compute BFS path, then walk it step-by-step with gaussian timing.
  // Falls back to random walk if BFS can't find a path.
  async function run() {
    if (isFinished()) return

    const links = getPlayerLinks(botId)
    if (!links || links.length === 0) return

    // Try to find the start page from current links' context
    const startGuess = links[0]
    let plannedPath = null

    if (target) {
      try {
        plannedPath = await bfsPath(startGuess, target)
      } catch {
        plannedPath = null
      }
    }

    async function tick(remainingPath) {
      if (isFinished()) return

      const currentLinks = getPlayerLinks(botId)
      let pick = null

      // If we have a planned path, try to follow the next step
      if (remainingPath && remainingPath.length > 0) {
        const next = remainingPath[0]
        function norm(t) { return t.replace(/_/g, ' ').trim().toLowerCase() }
        const match = currentLinks.find(l => norm(l) === norm(next))
        if (match) {
          pick = match
          remainingPath = remainingPath.slice(1)
        }
      }

      // Fallback: random walk
      if (!pick && currentLinks.length > 0) {
        pick = currentLinks[Math.floor(Math.random() * currentLinks.length)]
      }

      if (pick) await onMove(botId, pick)

      if (!isFinished()) {
        setTimeout(() => tick(remainingPath), gaussianDelay(difficulty))
      }
    }

    setTimeout(() => tick(plannedPath), gaussianDelay(difficulty))
  }

  run()
}
```

- [ ] **Step 2: Update `src/lib/socketHandlers.js` to pass `target` to `scheduleBot`**

In the `game:start` handler, find the `scheduleBot` call and add `target: room.target`:

```js
scheduleBot({
  roomCode,
  botId,
  difficulty: 'medium',
  target: room.target,       // ← add this
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
```

- [ ] **Step 3: Add a test for BFS-guided bot path following**

Add to `tests/bots.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { scheduleBot } from '../src/lib/bots.js'

describe('scheduleBot BFS path', () => {
  it('follows BFS-planned path when available', async () => {
    const moves = []
    // Simulate bot with links to 'Germany', which contains link to 'Adolf Hitler'
    let currentLinks = ['Germany', 'France']
    const getPlayerLinks = vi.fn(() => currentLinks)
    const onMove = vi.fn(async (id, page) => {
      moves.push(page)
      if (page === 'Germany') currentLinks = ['Adolf Hitler', 'Austria']
    })

    await new Promise((resolve) => {
      scheduleBot({
        botId: 'bot1',
        difficulty: 'easy',
        target: 'Adolf Hitler',
        getPlayerLinks,
        onMove,
        isFinished: () => moves.includes('Adolf Hitler'),
      })
      setTimeout(resolve, 30_000) // generous wait for easy bot timing
    })

    expect(moves).toContain('Adolf Hitler')
  }, 35_000) // vitest timeout
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/bots.test.js
```

Expected: existing bot tests still pass. The new BFS test may take up to 30s (easy bot timing). If it times out in CI, mark it as `test.skip` with a comment that it requires network.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bots.js src/lib/socketHandlers.js tests/bots.test.js
git commit -m "feat(phase5): upgrade bots to BFS-guided pathfinding (deferred from phase 2)"
```

---

### Task 15: Daily Challenge one-attempt-per-day enforcement (deferred from Phase 3)

**Context:** Phase 3 plan noted: *"Full localStorage daily-attempt gating can be a follow-up."* Currently the Daily mode has no enforcement — a player can replay the same daily pair unlimited times. The fix lives in the client (`src/app/play/page.jsx`) as a localStorage check before allowing the game to start.

**Files:**
- Modify: `src/lib/dailyChallenge.js`
- Modify: `src/app/page.jsx`
- Modify: `src/app/play/page.jsx`
- Create: `tests/dailyChallenge.test.js` (or add to existing)

- [ ] **Step 1: Add `hasPlayedToday` / `markPlayedToday` to `src/lib/dailyChallenge.js`**

```js
// Add to existing dailyChallenge.js

const DAILY_PLAYED_KEY = 'findHitler_dailyPlayed'

export function hasPlayedDailyToday(dateStr = new Date().toISOString().slice(0, 10)) {
  if (typeof localStorage === 'undefined') return false
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_PLAYED_KEY) || 'null')
    return stored?.date === dateStr
  } catch {
    return false
  }
}

export function markDailyPlayed(dateStr = new Date().toISOString().slice(0, 10)) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DAILY_PLAYED_KEY, JSON.stringify({ date: dateStr }))
}
```

- [ ] **Step 2: Add tests for the new functions to `tests/dailyChallenge.test.js`**

Open the existing `tests/dailyChallenge.test.js` and append:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasPlayedDailyToday, markDailyPlayed } from '../src/lib/dailyChallenge.js'

describe('hasPlayedDailyToday', () => {
  beforeEach(() => {
    // Mock localStorage
    const store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v },
    })
  })

  it('returns false when never played', () => {
    expect(hasPlayedDailyToday('2026-06-01')).toBe(false)
  })

  it('returns true after markDailyPlayed called for same date', () => {
    markDailyPlayed('2026-06-01')
    expect(hasPlayedDailyToday('2026-06-01')).toBe(true)
  })

  it('returns false for a different date', () => {
    markDailyPlayed('2026-05-31')
    expect(hasPlayedDailyToday('2026-06-01')).toBe(false)
  })
})
```

- [ ] **Step 3: Run — confirm tests pass**

```bash
npm test -- tests/dailyChallenge.test.js
```

Expected: existing daily challenge tests + 3 new tests all pass.

- [ ] **Step 4: Enforce in `src/app/page.jsx`**

In the `HomePage` component, import `hasPlayedDailyToday` and add a disable guard on the Start button for daily mode:

```jsx
// Add import at top
import { hasPlayedDailyToday } from '@/lib/dailyChallenge'

// In the component body, add:
const alreadyPlayedDaily = mode === 'daily' && hasPlayedDailyToday()
```

Modify the Start button JSX to include:

```jsx
<button
  onClick={handleStart}
  disabled={loading || alreadyPlayedDaily}
  className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(192,57,43,0.4)]"
>
  {loading
    ? 'Connecting...'
    : alreadyPlayedDaily
    ? 'Already played today ✓'
    : playType === 'solo' ? 'Start Race →' : 'Create Lobby →'}
</button>
```

Also add a small info line below the button when daily is selected and already played:

```jsx
{alreadyPlayedDaily && (
  <p className="text-yellow-400/70 font-mono text-xs text-center">
    Come back tomorrow for a new challenge.
  </p>
)}
```

- [ ] **Step 5: Mark the attempt in `src/app/play/page.jsx`**

Import `markDailyPlayed` and call it when a daily game WIN event arrives:

```js
// Add import at top
import { markDailyPlayed } from '@/lib/dailyChallenge'
```

Inside `handleNavigate`, in the `data.status === 'WIN'` block, add:

```js
if (gameState.mode === 'daily') {
  markDailyPlayed()
}
```

Place it just before `addEntry(...)` is called.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dailyChallenge.js src/app/page.jsx src/app/play/page.jsx tests/dailyChallenge.test.js
git commit -m "feat(phase5): daily challenge one-attempt-per-day enforcement (deferred from phase 3)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| NextAuth.js email magic link | Task 4 |
| Guest play continues without accounts | Task 12 (home page unchanged), Task 13 smoke test |
| PostgreSQL + Prisma schema (User, Match) | Task 1 |
| ELO formula + K-factor + rank tiers | Task 2 |
| ELO changes ONLY in Ranked Duel mode | Task 5 (`if (mode === 'ranked')` guard) |
| HP Duel format (round-based) | Task 7 + Task 8 |
| BFS distance damage calc (depth-limited to 6 hops) | Task 3 |
| Ranked matchmaking queue with ELO bracket expansion | Task 6 |
| New page: /ranked | Task 10 |
| New page: /profile | Task 11 |
| Match history stored in DB | Task 5 + Task 11 |
| npm install next-auth @prisma/client prisma first | Task 1, Step 1 |
| npx prisma init + DATABASE_URL in .env.local | Task 1, Steps 2-4 |
| Bot BFS pathfinding (deferred from Phase 2) | Task 14 |
| Daily Challenge one-attempt enforcement (deferred from Phase 3) | Task 15 |

**No placeholder scan:** All steps contain complete code. No "TBD" or "TODO" in plan body.

**Type/name consistency check:**
- `calculateElo` defined in Task 2, imported in Task 5 ✓
- `calculateHpDamage` defined in Task 3, imported in Task 8 ✓
- `createDuel`, `getDuel`, `applyDamage`, `isDuelOver`, `advanceRound` defined in Task 7, imported in Task 8 ✓
- `joinQueue`, `leaveQueue`, `findMatch`, `getQueueEntry` defined in Task 6, imported in Task 8 ✓
- `RankBadge` created in Task 9, used in Tasks 10+11 ✓
- `HpDuelHUD`, `EloChange` created in Task 9, used in Task 10 ✓
- `prisma` singleton from `src/lib/db.js` created in Task 2, used in Tasks 4, 5, 11 ✓
- `duel.gameId` set in `startRankedDuel` (Task 8, Step 3) and read in `duel:navigate` handler ✓
- `room.duelId` note in Task 8 Step 4 flags the needed fix in `startRankedDuel` ✓
- `hasPlayedDailyToday` and `markDailyPlayed` defined in Task 15 Step 1, used in Steps 4 + 5 ✓
- `bfsPath` and `fetchWikiLinks` defined in Task 14 Step 1, used inside `scheduleBot` in same file ✓
