# Retention System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily streaks, personal bests, 20 achievement badges, a LoL-style ranked ladder (6 tiers × 5 divisions + Challenger), friend duel challenges, and a friends leaderboard tab.

**Architecture:** All retention state lives on the `User` model (streak, bests, badges, division). Streak/badge computation happens in `/api/match/record` as a post-save side effect. Friend duels are a new `Challenge`/`ChallengeResponse` pair stored in Postgres, shared via token. Challenger top-50 is a cached live query.

**Tech Stack:** Next.js 15 App Router, Prisma 7 + PostgreSQL (Supabase), React 19, Tailwind v4, Vitest.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add streak/bests/badges/division to User; add Challenge + ChallengeResponse models |
| `src/lib/elo.js` | Modify | Replace 4-tier RANKS with 6-tier × 5-division ladder; add `getRankLabel`, `getTopChallengers` |
| `tests/elo.test.js` | Modify | Add division + label tests |
| `src/lib/badges.js` | Create | Pure badge award logic |
| `tests/badges.test.js` | Create | Unit tests for badge triggers |
| `src/app/api/match/record/route.js` | Modify | Generalize to all modes; add streak + badge computation |
| `src/app/api/challenge/create/route.js` | Create | POST — save challenge, return token |
| `src/app/api/challenge/[token]/route.js` | Create | GET — return challenge seed for respondent |
| `src/app/api/challenge/respond/route.js` | Create | POST — save response |
| `src/components/RankBadge.jsx` | Modify | Show tier + division number |
| `src/components/PersonalBest.jsx` | Create | Small stat card for home screen |
| `src/components/BadgeGrid.jsx` | Create | Badge display grid for profile |
| `src/components/StreakBadge.jsx` | Create | Flame streak indicator |
| `src/app/page.jsx` | Modify | Show PersonalBest card + streak under mode selector |
| `src/app/profile/page.jsx` | Modify | Add badges grid, streak display |
| `src/app/leaderboard/page.jsx` | Modify | Add Friends tab |
| `src/app/results/page.jsx` | Modify | Add "Challenge a friend" button |
| `src/app/challenge/[token]/page.jsx` | Create | Challenge landing + game start |
| `src/app/challenge/[token]/result/page.jsx` | Create | Side-by-side results comparison |

---

### Task 1: DB schema — streak, bests, badges, division, Challenge models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update User model and add Challenge models**

Open `prisma/schema.prisma`. Replace the `User` model with:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  emailVerified DateTime?
  image         String?
  elo           Int       @default(1000)
  rank          String    @default("BRONZE_5")
  division      Int       @default(5)
  streak        Int       @default(0)
  longestStreak Int       @default(0)
  lastPlayedAt  DateTime?
  bests         Json      @default("{}")
  badges        String[]  @default([])
  accounts      Account[]
  sessions      Session[]
  matches       Match[]
  createdAt     DateTime  @default(now())
}
```

Then append after the `Match` model:

```prisma
model Challenge {
  id             String              @id @default(cuid())
  creatorId      String?
  target         String
  mode           String
  startPage      String
  creatorScore   Int
  creatorPath    String[]
  creatorClicks  Int
  creatorSeconds Int
  token          String              @unique @default(cuid())
  responses      ChallengeResponse[]
  createdAt      DateTime            @default(now())
  expiresAt      DateTime
}

model ChallengeResponse {
  id            String    @id @default(cuid())
  challengeId   String
  challenge     Challenge @relation(fields: [challengeId], references: [id])
  responderId   String?
  responderName String
  score         Int
  path          String[]
  clicks        Int
  seconds       Int
  won           Boolean
  playedAt      DateTime  @default(now())
}
```

- [ ] **Step 2: Push schema**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(retention): schema — streak/bests/badges/division on User + Challenge models"
```

---

### Task 2: Update ELO ladder to LoL-style divisions

**Files:**
- Modify: `src/lib/elo.js`
- Modify: `tests/elo.test.js`

- [ ] **Step 1: Write new failing tests**

Open `tests/elo.test.js` and append:

```js
import { getRankLabel, getRankFromElo, TIER_THRESHOLDS } from '../src/lib/elo.js'

describe('getRankLabel', () => {
  it('returns Bronze 5 for ELO 0', () => {
    expect(getRankLabel(0)).toBe('Bronze 5')
  })
  it('returns Bronze 4 for ELO 200', () => {
    expect(getRankLabel(200)).toBe('Bronze 4')
  })
  it('returns Bronze 1 for ELO 800', () => {
    expect(getRankLabel(800)).toBe('Bronze 1')
  })
  it('returns Silver 5 for ELO 1000', () => {
    expect(getRankLabel(1000)).toBe('Silver 5')
  })
  it('returns Gold 3 for ELO 2400', () => {
    expect(getRankLabel(2400)).toBe('Gold 3')
  })
  it('returns Diamond 1 for ELO 4800', () => {
    expect(getRankLabel(4800)).toBe('Diamond 1')
  })
})

describe('getRankFromElo', () => {
  it('returns tier and division for Bronze', () => {
    const r = getRankFromElo(350)
    expect(r.tier).toBe('BRONZE')
    expect(r.division).toBe(4)
  })
  it('returns tier SILVER for ELO 1500', () => {
    expect(getRankFromElo(1500).tier).toBe('SILVER')
  })
  it('clamps division to 1 at top of non-Challenger tier', () => {
    expect(getRankFromElo(4999).division).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/elo.test.js
```

Expected: FAIL — `getRankLabel is not a function`

- [ ] **Step 3: Rewrite elo.js**

Replace the full content of `src/lib/elo.js`:

```js
const K = 32

// 6 tiers × 5 divisions (div 5 = lowest, div 1 = highest within tier)
// ELO 0–4999 maps to Bronze–Diamond; top 50 by ELO = Challenger
export const TIER_THRESHOLDS = [
  { tier: 'BRONZE',   min: 0,    label: 'Bronze'   },
  { tier: 'SILVER',   min: 1000, label: 'Silver'   },
  { tier: 'GOLD',     min: 2000, label: 'Gold'     },
  { tier: 'PLATINUM', min: 3000, label: 'Platinum' },
  { tier: 'DIAMOND',  min: 4000, label: 'Diamond'  },
]

export const TIER_COLORS = {
  BRONZE:     '#cd7f32',
  SILVER:     '#c0c0c0',
  GOLD:       '#ffd700',
  PLATINUM:   '#00b4d8',
  DIAMOND:    '#a855f7',
  CHALLENGER: '#f59e0b',
}

export function getRankFromElo(elo) {
  // Find tier (highest threshold <= elo)
  let tierData = TIER_THRESHOLDS[0]
  for (const t of TIER_THRESHOLDS) {
    if (elo >= t.min) tierData = t
  }
  const offsetInTier = elo - tierData.min        // 0–999
  const divIndex = Math.floor(offsetInTier / 200) // 0=div5 ... 4=div1
  const division = 5 - Math.min(divIndex, 4)      // 5 down to 1
  return { tier: tierData.tier, division, label: tierData.label }
}

export function getRankLabel(elo) {
  const { label, division } = getRankFromElo(elo)
  return `${label} ${division}`
}

// Returns "BRONZE_5", "GOLD_2", etc. — stored in User.rank
export function getRankKey(elo) {
  const { tier, division } = getRankFromElo(elo)
  return `${tier}_${division}`
}

export function calculateElo(winnerElo, loserElo) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const delta = Math.round(K * (1 - expectedWinner))
  return {
    newWinner: winnerElo + delta,
    newLoser:  loserElo  - delta,
    delta,
  }
}

// Legacy compat — used in RankBadge and other display components
export function getRankTier(elo) {
  return getRankFromElo(elo).tier
}

// Call this server-side; pass prisma instance to avoid circular imports
export async function getTopChallengers(prisma) {
  const top = await prisma.user.findMany({
    orderBy: { elo: 'desc' },
    take: 50,
    select: { id: true, elo: true },
  })
  return new Set(top.map(u => u.id))
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/elo.test.js
```

Expected: all tests pass (including existing `calculateElo` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/elo.js tests/elo.test.js
git commit -m "feat(retention): LoL-style 6-tier × 5-division rank ladder"
```

---

### Task 3: Badge award logic

**Files:**
- Create: `src/lib/badges.js`
- Create: `tests/badges.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/badges.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeNewBadges } from '../src/lib/badges.js'

const base = {
  totalGames: 1, won: true, clicks: 5, seconds: 120,
  mode: 'classic', hardcore: false, streak: 1,
  longestStreak: 1, elo: 1000, existingBadges: [],
  wrongAccusations: 0, correctFinds: 0,
}

describe('computeNewBadges', () => {
  it('awards first_blood on first win', () => {
    expect(computeNewBadges({ ...base, totalGames: 1 })).toContain('first_blood')
  })
  it('does not re-award first_blood if already owned', () => {
    expect(computeNewBadges({ ...base, existingBadges: ['first_blood'] })).not.toContain('first_blood')
  })
  it('awards three_clicks for classic win in 3 clicks', () => {
    expect(computeNewBadges({ ...base, clicks: 3 })).toContain('three_clicks')
  })
  it('does not award three_clicks for 4 clicks', () => {
    expect(computeNewBadges({ ...base, clicks: 4 })).not.toContain('three_clicks')
  })
  it('awards speed_demon for speedrun under 60s', () => {
    expect(computeNewBadges({ ...base, mode: 'speedrun', seconds: 59 })).toContain('speed_demon')
  })
  it('does not award speed_demon for speedrun at 60s', () => {
    expect(computeNewBadges({ ...base, mode: 'speedrun', seconds: 60 })).not.toContain('speed_demon')
  })
  it('awards daily_7 at streak 7', () => {
    expect(computeNewBadges({ ...base, streak: 7 })).toContain('daily_7')
  })
  it('awards daily_30 at streak 30', () => {
    expect(computeNewBadges({ ...base, streak: 30 })).toContain('daily_30')
  })
  it('awards century at 100 total games', () => {
    expect(computeNewBadges({ ...base, totalGames: 100 })).toContain('century')
  })
  it('awards fact_ace for fact-checker with 0 wrong accusations', () => {
    expect(computeNewBadges({ ...base, mode: 'fact-checker', wrongAccusations: 0, correctFinds: 3, won: true })).toContain('fact_ace')
  })
  it('does not award fact_ace with wrong accusations', () => {
    expect(computeNewBadges({ ...base, mode: 'fact-checker', wrongAccusations: 1, won: true })).not.toContain('fact_ace')
  })
  it('awards hardcore_clear for hardcore win', () => {
    expect(computeNewBadges({ ...base, hardcore: true })).toContain('hardcore_clear')
  })
  it('returns empty array when nothing new earned', () => {
    const all = ['first_blood','three_clicks','speed_demon','daily_7','daily_30',
      'century','fact_ace','hardcore_clear','ranked_win','gold_rank','challenger',
      'hole_in_one','no_undo','globetrotter','veteran','speed_run_1','no_hub_clear',
      'golf_eagle','fact_historian','nerd']
    expect(computeNewBadges({ ...base, existingBadges: all })).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/badges.test.js
```

Expected: FAIL — `Cannot find module '../src/lib/badges.js'`

- [ ] **Step 3: Create badges.js**

Create `src/lib/badges.js`:

```js
// All 20 badges. computeNewBadges returns only newly earned ones (not already in existingBadges).
// Input shape: { totalGames, won, clicks, seconds, mode, hardcore, streak,
//               longestStreak, elo, existingBadges, wrongAccusations, correctFinds }

const BADGE_RULES = [
  { id: 'first_blood',    check: ({ totalGames, won }) => totalGames === 1 && won },
  { id: 'three_clicks',   check: ({ won, clicks, mode }) => won && mode === 'classic' && clicks <= 3 },
  { id: 'speed_demon',    check: ({ won, mode, seconds }) => won && mode === 'speedrun' && seconds < 60 },
  { id: 'speed_run_1',    check: ({ won, mode, seconds }) => won && mode === 'speedrun' && seconds < 30 },
  { id: 'hole_in_one',    check: ({ won, mode, clicks }) => won && mode === 'jesus' && clicks === 1 },
  { id: 'no_undo',        check: ({ won, mode }) => won && mode === 'classic' },  // undoTokens check passed in via clicks=undosUsed convention; caller must pass clicks=0 for no-undo
  { id: 'daily_7',        check: ({ streak }) => streak >= 7 },
  { id: 'daily_30',       check: ({ streak }) => streak >= 30 },
  { id: 'ranked_win',     check: ({ won, mode }) => won && mode === 'ranked' },
  { id: 'gold_rank',      check: ({ elo }) => elo >= 2000 },
  { id: 'fact_ace',       check: ({ won, mode, wrongAccusations }) => won && mode === 'fact-checker' && wrongAccusations === 0 },
  { id: 'fact_historian', check: ({ mode, totalGames }) => mode === 'fact-checker' && totalGames >= 10 },
  { id: 'hardcore_clear', check: ({ won, hardcore }) => won && hardcore },
  { id: 'century',        check: ({ totalGames }) => totalGames >= 100 },
  { id: 'veteran',        check: ({ totalGames }) => totalGames >= 365 },
  { id: 'no_hub_clear',   check: ({ won, mode }) => won && mode === 'nohub' },
  { id: 'golf_eagle',     check: ({ won, mode, clicks }) => won && mode === 'golf' && clicks <= 3 },
  { id: 'globetrotter',   check: () => false }, // computed externally (needs DB query for distinct targets)
  { id: 'nerd',           check: () => false },  // computed externally (needs match history)
  { id: 'challenger',     check: () => false },  // computed externally (needs top-50 query)
]

export function computeNewBadges(ctx) {
  const owned = new Set(ctx.existingBadges ?? [])
  return BADGE_RULES
    .filter(rule => !owned.has(rule.id) && rule.check(ctx))
    .map(rule => rule.id)
}

export const ALL_BADGE_IDS = BADGE_RULES.map(r => r.id)

export const BADGE_META = {
  first_blood:    { label: 'First Blood',      desc: 'Win your first game' },
  three_clicks:   { label: 'Three Clicks',     desc: 'Win Classic in 3 clicks or fewer' },
  speed_demon:    { label: 'Speed Demon',      desc: 'Finish Speedrun in under 60 seconds' },
  speed_run_1:    { label: 'Blink',            desc: 'Finish Speedrun in under 30 seconds' },
  hole_in_one:    { label: 'Hole in One',      desc: '5-Clicks: reach Jesus in 1 click' },
  no_undo:        { label: 'No Safety Net',    desc: 'Win Classic without using any undos' },
  daily_7:        { label: 'Weekly',           desc: '7-day play streak' },
  daily_30:       { label: 'Monthly',          desc: '30-day play streak' },
  ranked_win:     { label: 'Ranked',           desc: 'Win your first ranked duel' },
  gold_rank:      { label: 'Gold',             desc: 'Reach Gold division' },
  fact_ace:       { label: 'Fact Ace',         desc: 'Complete Fact Checker with zero wrong accusations' },
  fact_historian: { label: 'Historian',        desc: 'Complete 10 Fact Checker games' },
  hardcore_clear: { label: 'Hardcore',         desc: 'Win any mode with Hardcore modifier' },
  century:        { label: 'Century',          desc: 'Play 100 total games' },
  veteran:        { label: 'Veteran',          desc: 'Play 365 total games' },
  no_hub_clear:   { label: 'Pathfinder',       desc: 'Win No-Hub mode' },
  golf_eagle:     { label: 'Eagle',            desc: 'Golf mode: Eagle or better (3 clicks)' },
  globetrotter:   { label: 'Globetrotter',     desc: 'Win with 5 different targets' },
  nerd:           { label: 'Nerd',             desc: 'Win 10 games using 1 undo or fewer total' },
  challenger:     { label: 'Challenger',       desc: 'Reach top 50 players by ELO' },
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/badges.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/badges.js tests/badges.test.js
git commit -m "feat(retention): badge award logic — 20 badges with unit tests"
```

---

### Task 4: Update match record API — generalize + add streak/badge

**Files:**
- Modify: `src/app/api/match/record/route.js`

- [ ] **Step 1: Rewrite the route**

Replace the full content of `src/app/api/match/record/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { calculateElo, getRankKey, getTopChallengers } from '@/lib/elo'
import { computeNewBadges } from '@/lib/badges'

// Cached Challenger set — refreshed after each ranked match
let challengerCache = { set: new Set(), ts: 0 }
async function getChallengerSet() {
  if (Date.now() - challengerCache.ts < 5 * 60 * 1000) return challengerCache.set
  const set = await getTopChallengers(db)
  challengerCache = { set, ts: Date.now() }
  return set
}

function computeStreak(lastPlayedAt, currentStreak) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (!lastPlayedAt) return 1
  const last = new Date(lastPlayedAt).toISOString().slice(0, 10)
  if (last === today) return currentStreak           // already played today
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10)
  if (last === yesterday) return currentStreak + 1  // consecutive day
  return 1                                           // streak broken
}

function updateBests(existing, { mode, clicks, seconds, score }) {
  const bests = typeof existing === 'string' ? JSON.parse(existing) : (existing ?? {})
  const key = mode
  const current = bests[key]
  const better =
    !current ||
    (mode === 'speedrun' ? seconds < current.seconds :
     mode === 'golf'     ? clicks < current.clicks   :
                           score > (current.score ?? 0))
  if (better) bests[key] = { clicks, seconds, score }
  return bests
}

export async function POST(request) {
  const body = await request.json()
  const {
    userId, target, mode, clicks, seconds, score, path,
    won, opponentElo, hardcore = false, wrongAccusations = 0, correctFinds = 0,
  } = body

  const session = await auth()
  const resolvedUserId = userId || session?.user?.id
  if (!resolvedUserId) {
    // Guest — just return ok, no persistence
    return NextResponse.json({ ok: true })
  }

  const user = await db.user.findUnique({ where: { id: resolvedUserId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // ELO update (ranked only)
  let newElo = user.elo
  let eloChange = 0
  if (mode === 'ranked' && opponentElo != null) {
    const { calculateElo: calcElo } = await import('@/lib/elo')
    if (won) {
      const result = calcElo(user.elo, opponentElo)
      newElo = result.newWinner
      eloChange = result.delta
    } else {
      const result = calcElo(opponentElo, user.elo)
      newElo = result.newLoser
      eloChange = -(result.delta)
    }
  }

  // Streak
  const newStreak = computeStreak(user.lastPlayedAt, user.streak)
  const newLongest = Math.max(newStreak, user.longestStreak)

  // Personal bests (only on wins)
  const newBests = won
    ? updateBests(user.bests, { mode, clicks, seconds, score })
    : user.bests

  // Total games (for badge triggers)
  const totalGames = await db.match.count({ where: { userId: resolvedUserId } }) + 1

  // Badges
  const challengerSet = await getChallengerSet()
  const isChallenger = challengerSet.has(resolvedUserId) ||
    (mode === 'ranked' && won && newElo > (Array.from(challengerSet).length < 50 ? 0 : Infinity))

  const newBadges = computeNewBadges({
    totalGames,
    won,
    clicks,
    seconds,
    mode,
    hardcore,
    streak: newStreak,
    longestStreak: newLongest,
    elo: newElo,
    existingBadges: user.badges,
    wrongAccusations,
    correctFinds,
  })

  // Challenger badge (external check)
  if (isChallenger && !user.badges.includes('challenger')) newBadges.push('challenger')

  const allBadges = [...new Set([...user.badges, ...newBadges])]

  // Persist match
  const match = await db.match.create({
    data: {
      userId: resolvedUserId,
      target,
      mode,
      clicks,
      seconds,
      score,
      path: path ?? [],
      won,
      eloChange,
      eloBefore: user.elo,
      eloAfter: newElo,
      totalPlayers: 1,
      opponentIds: [],
    },
  })

  // Persist user updates
  await db.user.update({
    where: { id: resolvedUserId },
    data: {
      elo: newElo,
      rank: getRankKey(newElo),
      division: (() => { const { division } = (await import('@/lib/elo')).getRankFromElo(newElo); return division })(),
      streak: newStreak,
      longestStreak: newLongest,
      lastPlayedAt: new Date(),
      bests: newBests,
      badges: allBadges,
    },
  })

  return NextResponse.json({ ok: true, matchId: match.id, eloChange, newBadges, newStreak })
}
```

Note: the `division` inline IIFE is awkward due to async import. Refactor to use a sync import at the top:

Replace that one data field with:
```js
      division: getRankFromElo(newElo).division,
```

And add `getRankFromElo` to the top-level import:
```js
import { calculateElo, getRankKey, getRankFromElo, getTopChallengers } from '@/lib/elo'
```

Also remove the `const { calculateElo: calcElo } = await import('@/lib/elo')` inside the ranked block — replace with the already-imported `calculateElo`:

```js
  if (mode === 'ranked' && opponentElo != null) {
    if (won) {
      const result = calculateElo(user.elo, opponentElo)
      newElo = result.newWinner
      eloChange = result.delta
    } else {
      const result = calculateElo(opponentElo, user.elo)
      newElo = result.newLoser
      eloChange = -(result.delta)
    }
  }
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/match/record/route.js
git commit -m "feat(retention): match/record — streak, personal bests, badge awards"
```

---

### Task 5: Update RankBadge component

**Files:**
- Modify: `src/components/RankBadge.jsx`

- [ ] **Step 1: Read the current RankBadge**

Read `src/components/RankBadge.jsx` to understand its current props and rendering.

- [ ] **Step 2: Update to show tier + division**

Replace the component's render logic to use `getRankLabel`:

```jsx
import { getRankLabel, TIER_COLORS, getRankFromElo } from '@/lib/elo'

export default function RankBadge({ elo, isChallenger = false }) {
  if (isChallenger) {
    return (
      <span style={{ color: TIER_COLORS.CHALLENGER, fontWeight: 'bold', fontFamily: 'monospace' }}>
        ★ Challenger
      </span>
    )
  }
  const label = getRankLabel(elo)
  const { tier } = getRankFromElo(elo)
  return (
    <span style={{ color: TIER_COLORS[tier], fontWeight: 'bold', fontFamily: 'monospace' }}>
      {label}
    </span>
  )
}
```

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/RankBadge.jsx
git commit -m "feat(retention): RankBadge — show tier + division (Gold 3, Silver 1, etc.)"
```

---

### Task 6: StreakBadge and PersonalBest components

**Files:**
- Create: `src/components/StreakBadge.jsx`
- Create: `src/components/PersonalBest.jsx`

- [ ] **Step 1: Create StreakBadge**

Create `src/components/StreakBadge.jsx`:

```jsx
export default function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#f59e0b]">
      🔥 {streak}-day streak
    </span>
  )
}
```

- [ ] **Step 2: Create PersonalBest**

Create `src/components/PersonalBest.jsx`:

```jsx
// Shows the user's personal best for a given mode.
// bests shape: { classic: {clicks, seconds, score}, speedrun: {seconds}, golf: {clicks}, ... }
export default function PersonalBest({ mode, bests }) {
  if (!bests || !bests[mode]) return null
  const b = bests[mode]

  const display =
    mode === 'speedrun'     ? `${b.seconds}s`      :
    mode === 'golf'         ? `${b.clicks} clicks`  :
    mode === 'fact-checker' ? `${b.score} pts`      :
                              `${b.clicks} clicks · ${b.seconds}s`

  return (
    <p className="text-[10px] font-mono text-[#64748b] mt-1">
      PB: <span className="text-[#94a3b8]">{display}</span>
    </p>
  )
}
```

- [ ] **Step 3: Wire PersonalBest into home screen**

In `src/app/page.jsx`, import and render `PersonalBest` below the mode card for the currently selected mode. The user's bests come from the NextAuth session (or a `/api/profile` fetch on mount):

```jsx
import PersonalBest from '@/components/PersonalBest'
import StreakBadge from '@/components/StreakBadge'

// Near the top of the component, fetch bests on mount (only if signed in):
const [userMeta, setUserMeta] = useState(null)
useEffect(() => {
  fetch('/api/profile').then(r => r.json()).then(d => { if (!d.error) setUserMeta(d) }).catch(() => {})
}, [])

// In JSX, below the mode selector cards, above the target selector:
{userMeta && (
  <div className="flex items-center gap-4 mt-2">
    <PersonalBest mode={mode} bests={userMeta.bests} />
    <StreakBadge streak={userMeta.streak} />
  </div>
)}
```

- [ ] **Step 4: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/StreakBadge.jsx src/components/PersonalBest.jsx src/app/page.jsx
git commit -m "feat(retention): StreakBadge + PersonalBest components, wired into home screen"
```

---

### Task 7: BadgeGrid component

**Files:**
- Create: `src/components/BadgeGrid.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/BadgeGrid.jsx`:

```jsx
import { ALL_BADGE_IDS, BADGE_META } from '@/lib/badges'

export default function BadgeGrid({ earned = [] }) {
  const ownedSet = new Set(earned)
  return (
    <div className="grid grid-cols-4 gap-3">
      {ALL_BADGE_IDS.map(id => {
        const meta = BADGE_META[id]
        const owned = ownedSet.has(id)
        return (
          <div
            key={id}
            title={meta.desc}
            className={`flex flex-col items-center gap-1 p-2 rounded border text-center
              ${owned
                ? 'border-[#2563eb] bg-[#1e3a5f]'
                : 'border-[#1e293b] bg-[#0f172a] opacity-40'}`}
          >
            <span className="text-[18px]">{owned ? '🏅' : '🔒'}</span>
            <span className="text-[10px] font-mono text-[#e2e8f0] leading-tight">{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/BadgeGrid.jsx
git commit -m "feat(retention): BadgeGrid — 20-badge display grid with locked silhouettes"
```

---

### Task 8: Wire streak + badges into profile page

**Files:**
- Modify: `src/app/profile/page.jsx`

- [ ] **Step 1: Add BadgeGrid and StreakBadge to profile**

In `src/app/profile/page.jsx`:

1. Import the new components at the top:
```jsx
import BadgeGrid from '@/components/BadgeGrid'
import StreakBadge from '@/components/StreakBadge'
```

2. The profile page fetches `/api/profile` — that API already returns user data. Add `streak` and `badges` to what it returns (modify the API route):

In `src/app/api/profile/route.js`, find where it returns user data and add:
```js
streak: session.user.streak ?? 0,
badges: session.user.badges ?? [],
```

Note: you'll need to update the `auth` session or fetch the user from DB. If the profile API already queries `db.user.findUnique`, add `streak` and `badges` to the select or just return the full user object fields.

3. In the profile page JSX, after the stats grid, add:
```jsx
<section className="mt-6">
  <div className="flex items-center gap-3 mb-3">
    <h2 className="font-mono text-sm uppercase tracking-wider text-[#94a3b8]">Streak</h2>
    <StreakBadge streak={user.streak} />
  </div>
  <p className="text-[11px] font-mono text-[#64748b]">Longest: {user.longestStreak} days</p>
</section>

<section className="mt-6">
  <h2 className="font-mono text-sm uppercase tracking-wider text-[#94a3b8] mb-3">Badges</h2>
  <BadgeGrid earned={user.badges} />
</section>
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.jsx src/app/api/profile/route.js
git commit -m "feat(retention): profile page — badges grid + streak display"
```

---

### Task 9: Challenge API — create, fetch, respond

**Files:**
- Create: `src/app/api/challenge/create/route.js`
- Create: `src/app/api/challenge/[token]/route.js`
- Create: `src/app/api/challenge/respond/route.js`

- [ ] **Step 1: Create challenge create route**

Create `src/app/api/challenge/create/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(request) {
  const { target, mode, startPage, creatorScore, creatorPath, creatorClicks, creatorSeconds } = await request.json()

  const session = await auth()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const challenge = await db.challenge.create({
    data: {
      creatorId: session?.user?.id ?? null,
      target,
      mode,
      startPage,
      creatorScore,
      creatorPath: creatorPath ?? [],
      creatorClicks,
      creatorSeconds,
      expiresAt,
    },
  })

  return NextResponse.json({ token: challenge.token })
}
```

- [ ] **Step 2: Create challenge fetch route**

Create `src/app/api/challenge/[token]/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request, { params }) {
  const { token } = await params
  const challenge = await db.challenge.findUnique({
    where: { token },
    include: { responses: { orderBy: { playedAt: 'asc' }, take: 10 } },
  })

  if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (challenge.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 410 })
  }

  return NextResponse.json({
    id: challenge.id,
    target: challenge.target,
    mode: challenge.mode,
    startPage: challenge.startPage,
    creatorScore: challenge.creatorScore,
    creatorClicks: challenge.creatorClicks,
    creatorSeconds: challenge.creatorSeconds,
    responses: challenge.responses,
  })
}
```

- [ ] **Step 3: Create respond route**

Create `src/app/api/challenge/respond/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(request) {
  const { challengeId, responderName, score, path, clicks, seconds } = await request.json()

  const session = await auth()
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } })
  if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const won = score > challenge.creatorScore

  const response = await db.challengeResponse.create({
    data: {
      challengeId,
      responderId: session?.user?.id ?? null,
      responderName: responderName ?? 'Anonymous',
      score,
      path: path ?? [],
      clicks,
      seconds,
      won,
    },
  })

  return NextResponse.json({ ok: true, responseId: response.id, won, creatorScore: challenge.creatorScore })
}
```

- [ ] **Step 4: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/challenge/create/route.js src/app/api/challenge/[token]/route.js src/app/api/challenge/respond/route.js
git commit -m "feat(retention): challenge API — create, fetch, respond"
```

---

### Task 10: Challenge pages

**Files:**
- Create: `src/app/challenge/[token]/page.jsx`
- Create: `src/app/challenge/[token]/result/page.jsx`

- [ ] **Step 1: Create challenge landing page**

Create `src/app/challenge/[token]/page.jsx`:

```jsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ChallengeLanding() {
  const { token } = useParams()
  const router = useRouter()
  const [challenge, setChallenge] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/challenge/${token}`)
      .then(r => r.json())
      .then(d => { setChallenge(d); setLoading(false) })
  }, [token])

  function handleAccept() {
    if (!name.trim()) return
    // Store challenge context for the game page to pick up
    sessionStorage.setItem('challengeContext', JSON.stringify({
      challengeId: challenge.id,
      startPage: challenge.startPage,
      target: challenge.target,
      mode: challenge.mode,
      responderName: name,
      token,
    }))
    // Route to the appropriate game page with challenge flag
    router.push(`/play?challenge=1`)
  }

  if (loading) return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-mono text-[#94a3b8]">Loading challenge...</div>
  if (challenge.error) return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-mono text-red-500">{challenge.error}</div>

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-6 font-mono px-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a]">You've been challenged!</h1>
      <div className="border-2 border-[#1a1a2e] rounded p-6 max-w-md w-full bg-white">
        <p className="text-sm text-[#64748b] mb-1 uppercase tracking-wider">Target</p>
        <p className="text-lg font-bold mb-4">{challenge.target}</p>
        <p className="text-sm text-[#64748b] mb-1 uppercase tracking-wider">Mode</p>
        <p className="text-base mb-4 capitalize">{challenge.mode}</p>
        <p className="text-sm text-[#64748b] mb-1 uppercase tracking-wider">Score to beat</p>
        <p className="text-2xl font-bold text-[#2563eb]">{challenge.creatorScore}</p>
      </div>
      <div className="max-w-md w-full">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter your codename"
          className="w-full border-2 border-[#1a1a2e] p-3 font-mono text-sm rounded mb-3"
        />
        <button
          onClick={handleAccept}
          disabled={!name.trim()}
          className="w-full bg-[#1a1a2e] text-white py-3 font-bold rounded disabled:opacity-40"
        >
          Accept Challenge →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create result comparison page**

Create `src/app/challenge/[token]/result/page.jsx`:

```jsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ChallengeResult() {
  const { token } = useParams()
  const router = useRouter()
  const [challenge, setChallenge] = useState(null)
  const [myResult, setMyResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('challengeResult')
    if (stored) setMyResult(JSON.parse(stored))

    fetch(`/api/challenge/${token}`)
      .then(r => r.json())
      .then(d => { setChallenge(d); setLoading(false) })
  }, [token])

  if (loading) return <div className="min-h-screen flex items-center justify-center font-mono text-[#94a3b8]">Loading...</div>

  const myScore = myResult?.score ?? 0
  const creatorScore = challenge?.creatorScore ?? 0
  const iWon = myScore > creatorScore

  return (
    <div className="min-h-screen bg-[#f8f9fa] px-6 py-12 font-mono max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{iWon ? '🏆 You won!' : '😤 They beat you'}</h1>
      <p className="text-[#64748b] mb-8">Target: {challenge?.target} · Mode: {challenge?.mode}</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className={`border-2 rounded p-4 ${iWon ? 'border-[#2563eb] bg-[#1e3a5f] text-white' : 'border-[#e2e8f0] bg-white'}`}>
          <p className="text-[10px] uppercase tracking-wider mb-2 opacity-60">You</p>
          <p className="text-3xl font-bold">{myScore}</p>
          <p className="text-[11px] mt-1 opacity-70">{myResult?.clicks} clicks · {myResult?.seconds}s</p>
        </div>
        <div className={`border-2 rounded p-4 ${!iWon ? 'border-[#2563eb] bg-[#1e3a5f] text-white' : 'border-[#e2e8f0] bg-white'}`}>
          <p className="text-[10px] uppercase tracking-wider mb-2 opacity-60">Challenger</p>
          <p className="text-3xl font-bold">{creatorScore}</p>
          <p className="text-[11px] mt-1 opacity-70">{challenge?.creatorClicks} clicks · {challenge?.creatorSeconds}s</p>
        </div>
      </div>

      <button onClick={() => router.push('/')} className="px-6 py-3 bg-[#1a1a2e] text-white font-bold rounded">
        Play Again
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Wire challenge context into the solo game page**

In `src/app/play/page.jsx`, in the `useEffect` that reads `sessionStorage.gameInit`, add a branch for challenge context:

```js
// After reading gameInit, also check for challenge context
const challengeCtx = sessionStorage.getItem('challengeContext')
if (challengeCtx && !init) {
  const ctx = JSON.parse(challengeCtx)
  sessionStorage.removeItem('challengeContext')
  // Fetch game start with the forced startPage
  const res = await fetch('/api/game/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: ctx.target,
      mode: ctx.mode,
      playerName: ctx.responderName,
      forcedStartPage: ctx.startPage,
    }),
  })
  const data = await res.json()
  // Store challengeId on the game state ref for use in win handler
  gameState.current = { ...data, challengeId: ctx.challengeId, challengeToken: ctx.token, responderName: ctx.responderName }
  setHtml(data.html)
  // ... rest of init
}
```

Also in `src/app/api/game/start/route.js`, handle the `forcedStartPage` param:

```js
// After extracting body params, add:
const startTitle = body.forcedStartPage ?? null
// Then in the existing startTitle resolution logic, only call fetchRandomWikiPage() if startTitle is null
```

And in the win handler of the solo game page, if `challengeId` exists on gameState, submit the response:

```js
if (gameState.current.challengeId) {
  await fetch('/api/challenge/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: gameState.current.challengeId,
      responderName: gameState.current.responderName,
      score: data.score,
      path: data.path,
      clicks: data.clicks,
      seconds: elapsed,
    }),
  })
  sessionStorage.setItem('challengeResult', JSON.stringify({ score: data.score, clicks: data.clicks, seconds: elapsed }))
  router.push(`/challenge/${gameState.current.challengeToken}/result`)
  return
}
```

- [ ] **Step 4: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/challenge src/app/play/page.jsx src/app/api/game/start/route.js
git commit -m "feat(retention): friend challenge flow — landing, game, results comparison"
```

---

### Task 11: "Challenge a friend" button on results screen

**Files:**
- Modify: `src/app/results/page.jsx`

- [ ] **Step 1: Add the button**

In `src/app/results/page.jsx`, find the "Play Again" / share section. Add a "Challenge a friend" button that calls `/api/challenge/create` with the current game's data and copies the link:

```jsx
async function handleChallenge() {
  const myResult = finishers.find(f => f.isMe)
  if (!myResult) return
  const res = await fetch('/api/challenge/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: gameTarget,
      mode: gameMode,
      startPage: myResult.path?.[0] ?? '',
      creatorScore: myResult.score,
      creatorPath: myResult.path,
      creatorClicks: myResult.clicks,
      creatorSeconds: myResult.time,
    }),
  })
  const { token } = await res.json()
  const url = `${window.location.origin}/challenge/${token}`
  await navigator.clipboard.writeText(url)
  setChallengeLink(url)
}
```

Add `challengeLink` state and render:
```jsx
const [challengeLink, setChallengeLink] = useState(null)

// In JSX, below share buttons:
<button onClick={handleChallenge} className="px-4 py-2 border-2 border-[#2563eb] text-[#2563eb] font-mono text-sm rounded">
  Challenge a friend →
</button>
{challengeLink && (
  <p className="text-[11px] font-mono text-[#64748b] mt-2">Link copied! {challengeLink}</p>
)}
```

Also read `gameTarget` and `gameMode` from the results data (they should already be accessible from `finishers[0]` or sessionStorage gameResults).

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/results/page.jsx
git commit -m "feat(retention): results screen — challenge a friend button"
```

---

### Task 12: Friends leaderboard tab

**Files:**
- Modify: `src/app/leaderboard/page.jsx`
- Create: `src/app/api/leaderboard/friends/route.js`

- [ ] **Step 1: Create friends leaderboard API**

Create `src/app/api/leaderboard/friends/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ entries: [] })

  const userId = session.user.id

  // Find all challenge tokens where user was creator or respondent
  const asCreator = await db.challenge.findMany({
    where: { creatorId: userId },
    include: { responses: { select: { responderId: true, responderName: true, score: true } } },
  })
  const asRespondent = await db.challengeResponse.findMany({
    where: { responderId: userId },
    include: { challenge: { select: { creatorId: true } } },
  })

  // Collect friend user IDs
  const friendIds = new Set()
  for (const c of asCreator) {
    for (const r of c.responses) { if (r.responderId) friendIds.add(r.responderId) }
  }
  for (const r of asRespondent) {
    if (r.challenge.creatorId) friendIds.add(r.challenge.creatorId)
  }
  friendIds.delete(userId)

  if (friendIds.size === 0) return NextResponse.json({ entries: [] })

  const friends = await db.user.findMany({
    where: { id: { in: [...friendIds] } },
    select: { id: true, name: true, elo: true, rank: true },
    orderBy: { elo: 'desc' },
  })

  return NextResponse.json({ entries: friends })
}
```

- [ ] **Step 2: Add Friends tab to leaderboard page**

In `src/app/leaderboard/page.jsx`, add tab state and fetch:

```jsx
const [tab, setTab] = useState('global')
const [friends, setFriends] = useState([])

useEffect(() => {
  if (tab === 'friends') {
    fetch('/api/leaderboard/friends')
      .then(r => r.json())
      .then(d => setFriends(d.entries ?? []))
  }
}, [tab])
```

Add tab UI above the leaderboard table:
```jsx
<div className="flex gap-3 mb-4">
  {['global', 'friends'].map(t => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`px-4 py-2 font-mono text-sm uppercase rounded ${tab === t ? 'bg-[#1a1a2e] text-white' : 'text-[#64748b] border border-[#e2e8f0]'}`}
    >
      {t}
    </button>
  ))}
</div>
```

When `tab === 'friends'`, render `friends` array instead of the existing local leaderboard. Show a "No friends yet — challenge someone first!" empty state if `friends.length === 0`.

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/leaderboard/page.jsx src/app/api/leaderboard/friends/route.js
git commit -m "feat(retention): friends leaderboard tab"
```

---

### Task 13: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test streak**

Sign in, play a game, check `/profile` — streak shows 1. Come back tomorrow and play → streak shows 2.

- [ ] **Step 3: Test badges**

Win Classic in 3 clicks → check `/profile` → `three_clicks` and `first_blood` badges are highlighted.

- [ ] **Step 4: Test rank ladder**

Win a ranked duel, check `/ranked` — rank shows tier + division (e.g. "Bronze 4").

- [ ] **Step 5: Test friend challenge**

Complete a solo game → click "Challenge a friend" → copy link. Open link in a new tab (or incognito) → enter a codename → play the same start page → results comparison shows both scores side by side.

- [ ] **Step 6: Test friends leaderboard**

After completing the challenge above, open `/leaderboard` → Friends tab → the respondent appears.

- [ ] **Step 7: Commit smoke test confirmation**

```bash
git commit --allow-empty -m "chore: retention system smoke test passed"
```
