# Game Loop Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Find Hitler game loop — redesigned HUD, mode card hierarchy, Wikipedia page title strip, chromatic aberration damage overlay, match history with opponents/ELO, and in-race lobby chat with emotes and system events.

**Architecture:** Six independent slices implemented in order: (1) pure UI changes with no data dependencies, (2) new client component with CSS keyframes, (3) DB migration + API + profile UI, (4) new socket-driven chat component wired into both play pages. Each task is self-contained and commitable.

**Tech Stack:** Next.js App Router, Socket.io, Prisma/PostgreSQL, Tailwind CSS, React hooks

---

## File Map

| File | Change |
|------|--------|
| `src/components/GameHUD.jsx` | Full rewrite — three-zone cockpit layout |
| `src/app/globals.css` | Add `fh-shudder-fast` + `fh-chroma-shake` keyframes |
| `src/app/page.jsx` | Mode section: hero card + variants row |
| `src/app/play/page.jsx` | Add `currentPageTitle` state + title strip |
| `src/app/play/multi/page.jsx` | Add title strip + wire LobbyChat + DamageOverlay |
| `src/app/play/ranked/page.jsx` | Wire DamageOverlay on `duel:round-end` |
| `src/components/DamageOverlay.jsx` | **New** — chromatic aberration + red wash + shake |
| `src/components/LobbyChat.jsx` | **New** — chat feed, emote bar, text input |
| `src/lib/socketHandlers.js` | Add `chat:message`, `chat:emote` handlers; emit `chat:event` at key moments |
| `prisma/schema.prisma` | Add `rank`, `totalPlayers`, `opponentIds String[]` to `Match` |
| `src/app/api/profile/route.js` | Return enriched match rows with opponent names |
| `src/app/profile/page.jsx` | Rich match history rows with filter tabs |

---

## Task 1: HUD Redesign

**Files:**
- Modify: `src/components/GameHUD.jsx`
- Modify: `src/app/globals.css` (add `fh-shudder-fast`)

- [ ] **Step 1: Replace GameHUD.jsx with three-zone cockpit**

```jsx
// src/components/GameHUD.jsx
'use client'
import { useState, useEffect } from 'react'

export default function GameHUD({ startPage, target, mode, clicks, undoTokens, onUndo, timeLimitSeconds, jesusRound, onTimeUp, onElapsedTick }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (timeLimitSeconds && next >= timeLimitSeconds && onTimeUp) onTimeUp()
        if (onElapsedTick) onElapsedTick(next)
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, onTimeUp, onElapsedTick])

  const remaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null
  const displaySeconds = remaining !== null ? remaining : elapsed
  const mins = String(Math.floor(displaySeconds / 60)).padStart(2, '0')
  const secs = String(displaySeconds % 60).padStart(2, '0')
  const danger = remaining !== null && remaining <= 30
  const ultraDanger = remaining !== null && remaining <= 10
  const isCountdown = remaining !== null

  const modeLabel = {
    classic: 'Classic · Fewest clicks wins',
    speedrun: 'Speedrun · Fastest time wins',
    golf: 'Golf · 5-min cap · lowest clicks',
    jesus: '5-Clicks to Jesus · par scoring',
    daily: 'Daily Challenge · one attempt',
    nohub: 'No-Hub · hubs bounce you',
  }[mode] ?? mode ?? 'Classic'

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 pt-safe" style={{ background: '#0e0e0e', borderBottom: '3px solid #e5241e' }}>
        <div className="flex items-stretch" style={{ minHeight: 80 }}>

          {/* LEFT: Clicks */}
          <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0" style={{ padding: '0 28px', borderRight: '1px solid #1e1e1e' }}>
            <span style={{ color: '#777', fontSize: 11, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>Clicks</span>
            <span style={{ color: '#f5f0e8', fontSize: 38, fontWeight: 700, fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>{clicks}</span>
          </div>

          {/* CENTRE: Target */}
          <div className="flex flex-col items-center justify-center gap-1.5 flex-1" style={{ padding: '10px 24px', borderRight: '1px solid #1e1e1e' }}>
            <span style={{ color: '#666', fontSize: 9, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Target</span>
            <span style={{ background: '#e5241e', color: '#fff', fontSize: 24, fontWeight: 700, padding: '3px 16px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'ui-monospace,monospace' }}>{target}</span>
            <span style={{ color: '#888', fontSize: 13, letterSpacing: '0.04em', fontFamily: 'ui-monospace,monospace', textAlign: 'center' }}>Navigate Wikipedia links to find him</span>
          </div>

          {/* RIGHT: Timer + Undo side-by-side, Path below */}
          <div className="flex flex-col justify-center flex-shrink-0" style={{ padding: '10px 20px', width: 270, borderLeft: '1px solid #1e1e1e', gap: 8 }}>
            <div className="flex items-center" style={{ gap: 18 }}>
              {/* Timer */}
              <div className="flex flex-col" style={{ gap: 2 }}>
                <span style={{ fontSize: 7, color: '#444', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Time</span>
                <span style={{
                  fontSize: 28, fontWeight: 700, lineHeight: 1,
                  fontFamily: 'ui-monospace,monospace', letterSpacing: '0.04em',
                  color: danger ? '#ef4444' : isCountdown ? '#fbbf24' : '#888',
                  animation: ultraDanger ? 'fh-shudder-fast 0.15s ease-in-out infinite' : danger ? 'fh-shudder 0.3s ease-in-out infinite' : undefined,
                }}>{mins}:{secs}</span>
              </div>
              <div style={{ width: 1, background: '#222', alignSelf: 'stretch' }} />
              {/* Undo */}
              <div className="flex flex-col" style={{ gap: 5 }}>
                <span style={{ fontSize: 10, color: '#888', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Undo</span>
                <div className="flex" style={{ gap: 7, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < undoTokens ? '#f5f0e8' : '#252525', border: i < undoTokens ? 'none' : '1px solid #333', display: 'inline-block' }} />
                  ))}
                </div>
              </div>
              {jesusRound != null && (
                <span style={{ color: '#f5f0e8', fontSize: 11, fontFamily: 'ui-monospace,monospace', marginLeft: 8 }}>
                  R{jesusRound}<span style={{ color: '#444' }}>/5</span>
                </span>
              )}
            </div>
            {/* Path */}
            <div className="flex flex-col" style={{ gap: 1 }}>
              <span style={{ fontSize: 6.5, color: '#333', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Path</span>
              <span className="truncate" style={{ fontSize: 8, color: '#555', fontFamily: 'ui-monospace,monospace' }}>{startPage} › … › {target}</span>
            </div>
          </div>
        </div>

        {/* Mode strip */}
        <div style={{ background: '#0a0a0a', borderTop: '1px solid #161616', padding: '3px 16px', fontSize: 7, color: '#333', fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {modeLabel}
        </div>
      </header>

      {/* Bottom action bar */}
      <footer className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3 pb-safe" style={{ background: '#0e0e0e', borderTop: '3px solid #e5241e', minHeight: 48 }}>
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          style={{
            background: undoTokens === 0 ? '#252525' : '#e5241e', color: undoTokens === 0 ? '#3a3a3a' : '#fff',
            border: 'none', fontFamily: 'ui-monospace,monospace', fontSize: 8.5, fontWeight: 700,
            padding: '5px 14px', textTransform: 'uppercase', letterSpacing: '0.1em',
            cursor: undoTokens === 0 ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >↶ Undo{undoTokens > 0 ? ` (${undoTokens})` : ''}</button>
        <span className="flex-1" />
        <span className="truncate text-right" style={{ color: '#444', fontSize: 7.5, fontFamily: 'ui-monospace,monospace', maxWidth: '60%' }}>
          {startPage} › … › {target}
        </span>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: Add `fh-shudder-fast` keyframe to globals.css**

In `src/app/globals.css`, after the existing `@keyframes fh-shudder` block, add:

```css
@keyframes fh-shudder-fast {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-2px); }
  75%      { transform: translateX(2px); }
}
```

- [ ] **Step 3: Fix paddingTop on play page wrapper**

In `src/app/play/page.jsx`, find:
```jsx
<div className="flex" style={{ paddingTop: 88, paddingBottom: 56, minHeight: '100vh', background: '#fff' }}>
```
Change `paddingTop: 88` to `paddingTop: 100` to clear the taller HUD (80px main row + 14px mode strip + 3px border + safe area buffer).

- [ ] **Step 4: Fix paddingTop on multi play page wrapper**

In `src/app/play/multi/page.jsx`, find:
```jsx
<main className="mx-auto max-w-3xl px-5 pt-24 pb-24 sm:pt-20 lg:pr-72">
```
Change to:
```jsx
<main className="mx-auto max-w-3xl px-5 pt-28 pb-24 lg:pr-72">
```

- [ ] **Step 5: Verify visually**

Start the dev server (`npm run dev` in `C:\Users\lasse\Desktop\find-hitler`), play a Classic solo game, confirm: three zones render, clicks number is large and legible, target badge is centred, timer counts up from 00:00, undo dots shrink when undo is used, mode strip reads "Classic · Fewest clicks wins". No content cut off at top or bottom.

- [ ] **Step 6: Commit**

```bash
git add src/components/GameHUD.jsx src/app/globals.css src/app/play/page.jsx src/app/play/multi/page.jsx
git commit -m "feat: redesign GameHUD — three-zone cockpit with 38px clicks, 24px target, 28px timer"
```

---

## Task 2: Mode Card Hierarchy

**Files:**
- Modify: `src/app/page.jsx` (Game Mode section only)

- [ ] **Step 1: Replace the mode grid in page.jsx**

Find the entire `{/* GAME MODE */}` section (lines 151–165) and replace it with:

```jsx
{/* GAME MODE */}
<div className="px-5 py-4 border-b-4 border-ink">
  <MonoLabel className="block mb-2.5">Game Mode</MonoLabel>

  {/* Hero: Classic */}
  <button
    onClick={() => setMode('classic')}
    className={`w-full flex items-center gap-4 px-4 py-5 mb-[3px] border-[3px] cursor-pointer transition-colors ${mode === 'classic' ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-ink hover:bg-paper-dim'}`}
  >
    <HitlerMark size={52} fill={mode === 'classic' ? 'var(--color-paper)' : 'var(--color-ink)'} className="flex-none" />
    <div className="flex-1 text-left">
      <div className="font-display uppercase text-[22px] leading-none">Classic · Find Hitler</div>
      <div className={`mt-1.5 font-mono text-[11px] ${mode === 'classic' ? 'text-paper/70' : 'text-ink/60'}`}>
        Navigate Wikipedia from a random page to Adolf Hitler. Fewest clicks wins.
      </div>
    </div>
    {mode === 'classic' && (
      <span className="flex-none font-mono text-[8px] uppercase tracking-[0.12em] text-red bg-paper px-2 py-1">★ Main mode</span>
    )}
  </button>

  {/* Variants row */}
  <MonoLabel className="block mt-3 mb-1.5">Variants</MonoLabel>
  <div className="grid grid-cols-5 gap-[3px] bg-ink border-[3px] border-ink">
    {MODES.filter(m => m.value !== 'classic').map(m => {
      const sel = mode === m.value
      return (
        <SelectCell key={m.value} selected={sel} onClick={() => setMode(m.value)} className="flex flex-col items-center justify-center text-center py-3 px-1">
          <span className="font-display uppercase text-[9px] leading-tight">{m.label}</span>
          <MonoLabel className={`mt-1 block text-[7px] ${sel ? 'text-paper/70' : ''}`}>{m.shortDesc}</MonoLabel>
        </SelectCell>
      )
    })}
  </div>
</div>
```

- [ ] **Step 2: Add `shortDesc` to MODES constant**

Replace the existing `MODES` array (top of `page.jsx`) with:

```jsx
const MODES = [
  { value: 'classic',  label: 'Classic',          desc: 'FEWEST CLICKS · RANDOM START', shortDesc: 'RANDOM START' },
  { value: 'speedrun', label: 'Speedrun',          desc: 'FASTEST TIME · CURATED START', shortDesc: 'FASTEST TIME' },
  { value: 'golf',     label: 'Golf',              desc: '5-MIN CAP · LOWEST CLICKS',    shortDesc: '5-MIN CAP' },
  { value: 'jesus',    label: '5-Clicks',          desc: 'PAR · 5 ROUNDS · TARGET = JESUS', shortDesc: 'TO JESUS' },
  { value: 'daily',    label: 'Daily',             desc: 'ONE ATTEMPT · SAME FOR ALL',   shortDesc: 'ONE SHOT' },
  { value: 'nohub',    label: 'No-Hub',            desc: 'HUBS BOUNCE YOU · COST AN UNDO', shortDesc: 'HUB PENALTY' },
]
```

- [ ] **Step 3: Verify visually**

Open the home page. Classic shows as a tall hero card with the Hitler mark and description. Clicking Speedrun/Golf/etc selects that variant in the 5-col row. Clicking back on the hero card reselects Classic. Hardcore toggle and bot slider still work.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: mode card hierarchy — Classic hero card + compact variants row"
```

---

## Task 3: Wikipedia Page Title Strip

**Files:**
- Modify: `src/app/play/page.jsx`
- Modify: `src/app/play/multi/page.jsx`

- [ ] **Step 1: Add `currentPageTitle` state to solo play page**

In `src/app/play/page.jsx`, add to the state declarations:

```jsx
const [currentPageTitle, setCurrentPageTitle] = useState('')
```

In the `useEffect` that reads `gameInit`, after `setHtml(init.html)`, add:
```jsx
setCurrentPageTitle(init.title || '')
```

In `handleNavigate`, in the `data.status === 'WIN'` branch and the `else` branch, after `setHtml(data.html)`, add:
```jsx
setCurrentPageTitle(data.title || '')
```

- [ ] **Step 2: Render title strip above WikiArticle in solo play**

In `src/app/play/page.jsx`, find:
```jsx
<WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!win} />
```
Replace with:
```jsx
{currentPageTitle && (
  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.12em', paddingBottom: 4, borderBottom: '1px solid #e8e4dc', marginBottom: 8 }}>
    {currentPageTitle}
  </div>
)}
<WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!win} />
```

- [ ] **Step 3: Add `currentPageTitle` state to multi play page**

In `src/app/play/multi/page.jsx`, add state:
```jsx
const [currentPageTitle, setCurrentPageTitle] = useState('')
```

In the `useEffect` that reads `multiGameInit`, after `setHtml(init.html)`, add:
```jsx
setCurrentPageTitle(init.title || '')
```

In the `'game:page'` socket handler, after `setHtml(data.html)`, add:
```jsx
setCurrentPageTitle(data.title || '')
```

- [ ] **Step 4: Render title strip in multi play**

In `src/app/play/multi/page.jsx`, find:
```jsx
<WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!myFinish} />
```
Replace with:
```jsx
{currentPageTitle && (
  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.12em', paddingBottom: 4, borderBottom: '1px solid #e8e4dc', marginBottom: 8 }}>
    {currentPageTitle}
  </div>
)}
<WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!myFinish} />
```

- [ ] **Step 5: Verify**

Play a solo game, click a link. The small mono label above the article updates to the new page title on each navigation.

- [ ] **Step 6: Commit**

```bash
git add src/app/play/page.jsx src/app/play/multi/page.jsx
git commit -m "feat: show current Wikipedia page title above article"
```

---

## Task 4: DamageOverlay Component

**Files:**
- Create: `src/components/DamageOverlay.jsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/play/ranked/page.jsx`
- Modify: `src/app/play/multi/page.jsx`

- [ ] **Step 1: Add `fh-chroma-shake` keyframe to globals.css**

Append after the existing `fh-shudder-fast` block:

```css
@keyframes fh-chroma-shake {
  0%   { transform: translate(0,0) rotate(0deg); }
  15%  { transform: translate(-6px,-3px) rotate(-0.3deg); }
  30%  { transform: translate(6px,3px) rotate(0.3deg); }
  50%  { transform: translate(-3px,2px) rotate(0deg); }
  70%  { transform: translate(3px,-1px); }
  100% { transform: translate(0,0) rotate(0deg); }
}
@keyframes fh-chroma-shake-med {
  0%   { transform: translate(0,0); }
  15%  { transform: translate(-8px,-4px) rotate(-0.4deg); }
  30%  { transform: translate(8px,4px) rotate(0.4deg); }
  50%  { transform: translate(-4px,2px); }
  70%  { transform: translate(4px,-2px); }
  100% { transform: translate(0,0); }
}
@keyframes fh-chroma-shake-hard {
  0%   { transform: translate(0,0); }
  15%  { transform: translate(-12px,-5px) rotate(-0.6deg); }
  30%  { transform: translate(12px,5px) rotate(0.6deg); }
  50%  { transform: translate(-6px,3px); }
  70%  { transform: translate(6px,-3px); }
  100% { transform: translate(0,0); }
}
```

- [ ] **Step 2: Create DamageOverlay.jsx**

```jsx
// src/components/DamageOverlay.jsx
'use client'
import { useEffect, useState } from 'react'

// trigger: { damage, timestamp } — a new object reference fires the effect
// hp / maxHp: used to scale intensity
export default function DamageOverlay({ trigger, hp, maxHp = 5000 }) {
  const [active, setActive] = useState(false)
  const [intensity, setIntensity] = useState('normal') // normal | medium | hard

  useEffect(() => {
    if (!trigger) return
    const ratio = hp / maxHp
    const lvl = ratio < 0.25 ? 'hard' : ratio < 0.5 ? 'medium' : 'normal'
    setIntensity(lvl)
    setActive(true)
    const t = setTimeout(() => setActive(false), 700)
    return () => clearTimeout(t)
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  const washOpacity = { normal: 0.35, medium: 0.50, hard: 0.65 }[intensity]
  const shakeAnim = {
    normal: 'fh-chroma-shake 0.5s ease-out',
    medium: 'fh-chroma-shake-med 0.5s ease-out',
    hard:   'fh-chroma-shake-hard 0.5s ease-out',
  }[intensity]
  const blur = intensity === 'hard' ? 'blur(1px)' : 'none'

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 39 }}>
      {/* Red wash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(200,0,0,${washOpacity})`,
        animation: 'fh-overlay-fade 0.6s ease-out forwards',
      }} />
      {/* Chromatic R bleed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(255,0,0,0.12)',
        transform: 'translateX(3px)',
        animation: 'fh-overlay-fade 0.5s ease-out forwards',
        mixBlendMode: 'screen',
      }} />
      {/* Chromatic B bleed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,255,0.08)',
        transform: 'translateX(-3px)',
        animation: 'fh-overlay-fade 0.5s ease-out forwards',
        mixBlendMode: 'screen',
      }} />
      {/* Shake wrapper — covers wiki content area only, not the HUD */}
      <div style={{
        position: 'absolute', inset: 0,
        animation: shakeAnim,
        filter: blur,
        pointerEvents: 'none',
      }} />
    </div>
  )
}
```

- [ ] **Step 3: Add `fh-overlay-fade` keyframe to globals.css**

```css
@keyframes fh-overlay-fade {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 4: Wire DamageOverlay into ranked play page**

In `src/app/play/ranked/page.jsx`:

Add import at top:
```jsx
import DamageOverlay from '@/components/DamageOverlay'
```

Add state:
```jsx
const [damageEvent, setDamageEvent] = useState(null)
const [myHp, setMyHp] = useState(5000)
```

In the `'duel:round-end'` handler, after `setDuelPlayers(...)`, add:
```jsx
// Only trigger overlay if we are the loser
if (data.loserId === myIdRef.current) {
  setMyHp(Object.values(data.duelPlayers).find((_, idx) =>
    Object.keys(data.duelPlayers)[idx] === myIdRef.current
  )?.hp ?? myHp)
  setDamageEvent({ damage: data.damage, timestamp: Date.now() })
}
```

In the JSX, just before the closing `</div>` of the ranked game page, add:
```jsx
<DamageOverlay trigger={damageEvent} hp={myHp} maxHp={5000} />
```

- [ ] **Step 5: Verify ranked damage effect**

Start a ranked duel (use two browser tabs or bots). Lose a round. The screen should flash red with RGB channel offset and shake for ~500ms. At <25% HP the effect should be noticeably more intense.

- [ ] **Step 6: Commit**

```bash
git add src/components/DamageOverlay.jsx src/app/globals.css src/app/play/ranked/page.jsx
git commit -m "feat: DamageOverlay — chromatic aberration + red wash + screenshake on HP damage"
```

---

## Task 5: Match History — DB Migration + API + Profile UI

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/profile/route.js`
- Modify: `src/app/profile/page.jsx`

- [ ] **Step 1: Add fields to Match model in schema.prisma**

Find the `model Match` block and replace it with:

```prisma
model Match {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  target       String
  mode         String
  clicks       Int
  seconds      Int
  score        Int
  path         String[]
  won          Boolean
  eloChange    Int      @default(0)
  eloBefore    Int      @default(0)
  eloAfter     Int      @default(0)
  rank         Int      @default(0)
  totalPlayers Int      @default(1)
  opponentIds  String[]
  playedAt     DateTime @default(now())
}
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npx prisma migrate dev --name add-match-history-fields
```

Expected: migration file created and applied, Prisma client regenerated.

- [ ] **Step 3: Update /api/profile to return enriched match data**

Replace `src/app/api/profile/route.js` with:

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
    take: 100,
    select: {
      id: true, target: true, mode: true, clicks: true, seconds: true,
      score: true, path: true, won: true, eloChange: true, eloBefore: true,
      eloAfter: true, rank: true, totalPlayers: true, opponentIds: true, playedAt: true,
    },
  })

  // Resolve opponent names from their user IDs
  const allOpponentIds = [...new Set(matches.flatMap(m => m.opponentIds || []))]
  const opponents = allOpponentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allOpponentIds } },
        select: { id: true, name: true },
      })
    : []
  const opponentMap = Object.fromEntries(opponents.map(o => [o.id, o.name || o.id]))

  const enriched = matches.map(m => ({
    ...m,
    opponents: (m.opponentIds || []).map(id => ({ userId: id, name: opponentMap[id] || 'Unknown' })),
    playedAt: m.playedAt.toISOString(),
  }))

  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({
    user,
    matches: enriched,
    stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 },
  })
}
```

- [ ] **Step 4: Rewrite the match history section in profile/page.jsx**

Replace the entire `{/* match history */}` div (and add filter state) with:

```jsx
// Add at top of ProfilePage component (after existing useState calls):
const [filter, setFilter] = useState('all') // 'all' | 'ranked' | 'classic' | 'other'
const [showCount, setShowCount] = useState(20)

// Add helper at top of file (after formatSeconds):
const MODE_COLORS = {
  classic:  { bg: '#e5241e', text: '#fff' },
  speedrun: { bg: '#b45309', text: '#fff' },
  golf:     { bg: '#166534', text: '#fff' },
  jesus:    { bg: '#1e40af', text: '#fff' },
  daily:    { bg: '#6b21a8', text: '#fff' },
  nohub:    { bg: '#374151', text: '#fff' },
  ranked:   { bg: '#0e0e0e', text: '#e5241e' },
}

function ModeBadge({ mode }) {
  const c = MODE_COLORS[mode] || { bg: '#222', text: '#fff' }
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 7, fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>
      {mode}
    </span>
  )
}

function PathChain({ path }) {
  if (!path || path.length === 0) return <span style={{ color: '#555', fontFamily: 'ui-monospace,monospace', fontSize: 9 }}>—</span>
  const nodes = path.length > 5 ? [...path.slice(0, 2), '…', ...path.slice(-2)] : path
  return (
    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 9, color: '#666' }}>
      {nodes.map((n, i) => (
        <span key={i}>{i > 0 && <span style={{ color: '#333', margin: '0 3px' }}>›</span>}{n}</span>
      ))}
    </span>
  )
}
```

Then replace the match history section JSX:

```jsx
{/* match history */}
<div className="px-5 py-4">
  <div className="flex items-center justify-between mb-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Match History</div>
    <div className="flex gap-[2px]">
      {['all','ranked','classic','other'].map(f => (
        <button key={f} onClick={() => { setFilter(f); setShowCount(20) }}
          className={`font-mono text-[8px] uppercase tracking-[0.1em] px-2.5 py-1 border-[2px] border-ink cursor-pointer ${filter === f ? 'bg-ink text-paper' : 'bg-paper hover:bg-paper-dim'}`}>
          {f}
        </button>
      ))}
    </div>
  </div>

  {(() => {
    const filtered = matches.filter(m => {
      if (filter === 'all') return true
      if (filter === 'ranked') return m.mode === 'ranked'
      if (filter === 'classic') return m.mode === 'classic'
      return m.mode !== 'ranked' && m.mode !== 'classic'
    })
    const visible = filtered.slice(0, showCount)

    if (filtered.length === 0) return (
      <div className="border-[3px] border-ink px-6 py-8 text-center font-mono text-xs text-ink/60">
        No matches yet. <a href="/" className="text-red underline">Play a race</a> to begin.
      </div>
    )

    return (
      <>
        <div className="border-[3px] border-ink divide-y-2 divide-ink">
          {visible.map(m => (
            <div key={m.id} className="px-4 py-3 font-mono" style={{ background: m.won ? 'transparent' : '#fafaf8' }}>
              {/* Row 1: date · mode · target · clicks · rank */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span style={{ fontSize: 8, color: '#888' }}>{new Date(m.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <ModeBadge mode={m.mode} />
                <span className="font-display uppercase text-[11px]">{m.target}</span>
                <span style={{ fontSize: 9, color: '#555' }}>{m.clicks} cl · {formatSeconds(m.seconds)}</span>
                {m.totalPlayers > 1 && m.rank > 0 && (
                  <span style={{ fontSize: 8, color: m.rank === 1 ? '#e5241e' : '#888' }}>#{m.rank} of {m.totalPlayers}</span>
                )}
                {m.mode === 'ranked' && m.eloChange !== 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: m.eloChange > 0 ? '#16a34a' : '#e5241e' }}>
                    {m.eloChange > 0 ? '+' : ''}{m.eloChange} LP
                  </span>
                )}
                {m.mode === 'ranked' && m.eloBefore > 0 && (
                  <span style={{ fontSize: 8, color: '#555' }}>{m.eloBefore} → {m.eloAfter}</span>
                )}
              </div>
              {/* Row 2: path */}
              <PathChain path={m.path} />
              {/* Row 3: opponents */}
              {m.opponents && m.opponents.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {m.opponents.map(o => (
                    <a key={o.userId} href={`/profile/${o.userId}`}
                      style={{ fontSize: 8, fontFamily: 'ui-monospace,monospace', color: '#555', border: '1px solid #ccc', padding: '1px 6px', textDecoration: 'none' }}
                      className="hover:border-ink hover:text-ink transition-colors">
                      {o.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {filtered.length > showCount && (
          <button onClick={() => setShowCount(n => n + 20)}
            className="mt-2 w-full border-[3px] border-ink py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-paper-dim cursor-pointer">
            Load more ({filtered.length - showCount} remaining)
          </button>
        )}
      </>
    )
  })()}
</div>
```

- [ ] **Step 5: Create public profile route**

Create `src/app/profile/[userId]/page.jsx`:

```jsx
// src/app/profile/[userId]/page.jsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import RankBadge from '@/components/RankBadge'
import HitlerMark from '@/components/ui/HitlerMark'

export default function PublicProfilePage() {
  const { userId } = useParams()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/profile/public?userId=${userId}`)
      .then(r => r.json())
      .then(setData)
  }, [userId])

  if (!data?.user) return (
    <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">
      {data === null ? 'Loading…' : 'Profile not found.'}
    </div>
  )

  const { user, stats } = data
  return (
    <div className="min-h-screen bg-paper px-4 py-8">
      <main className="mx-auto max-w-2xl border-4 border-ink bg-paper">
        <div className="flex items-center gap-3 border-b-4 border-ink px-5 py-4">
          <HitlerMark size={40} />
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-ink/60">Player</div>
            <h1 className="text-2xl">{user.name || 'Anonymous'}</h1>
          </div>
          <div className="ml-auto"><RankBadge rank={user.rank} elo={user.elo} size="sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-[3px] border-b-4 border-ink bg-ink">
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Matches</div>
            <div className="font-display text-2xl">{stats.totalMatches}</div>
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Wins</div>
            <div className="font-display text-2xl text-red">{stats.wins}</div>
          </div>
          <div className="bg-paper px-4 py-4 text-center">
            <div className="mb-1 font-mono text-[8px] uppercase tracking-widest text-ink/60">Win Rate</div>
            <div className="font-display text-2xl">{stats.winRate}%</div>
          </div>
        </div>
        <div className="px-5 py-4">
          <a href="/" className="font-mono text-[9px] uppercase tracking-widest text-ink/60 hover:text-red">← Home</a>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 6: Create public profile API route**

Create `src/app/api/profile/public/route.js`:

```js
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, elo: true, rank: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const matches = await prisma.match.findMany({
    where: { userId },
    select: { won: true },
  })
  const totalMatches = matches.length
  const wins = matches.filter(m => m.won).length

  return NextResponse.json({
    user,
    stats: { totalMatches, wins, winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0 },
  })
}
```

- [ ] **Step 7: Verify**

Open `/profile`. Play two games. Match rows show date, mode badge, target, clicks, path chain, and (if opponents present) clickable name chips. Ranked matches show LP delta and ELO before/after. Filter tabs work. "Load more" appears when > 20 matches.

- [ ] **Step 8: Commit**

```bash
git add prisma/ src/app/api/profile/ src/app/profile/
git commit -m "feat: match history — path, rank, opponents, ELO delta, filter tabs, public profile pages"
```

---

## Task 6: LobbyChat Component + Socket Events

**Files:**
- Create: `src/components/LobbyChat.jsx`
- Modify: `src/lib/socketHandlers.js`
- Modify: `src/app/play/multi/page.jsx`

- [ ] **Step 1: Create LobbyChat.jsx**

```jsx
// src/components/LobbyChat.jsx
'use client'
import { useState, useEffect, useRef } from 'react'

const ALLOWED_EMOTES = ['💀', '🔥', '😭', '👏', '⚡', '🤡']

// msg shape: { type: 'system'|'chat'|'emote', text?, name?, emote?, actor?, highlight? }
export default function LobbyChat({ socket, roomCode, myName, playerCount = 0 }) {
  const [messages, setMessages] = useState([{ type: 'system', text: 'Race started' }])
  const [input, setInput] = useState('')
  const feedRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    const onChatMessage = (data) => {
      setMessages(prev => [...prev, { type: 'chat', name: data.name, text: data.text }])
    }
    const onChatEmote = (data) => {
      setMessages(prev => [...prev, { type: 'emote', name: data.name, emote: data.emote }])
    }
    const onChatEvent = (data) => {
      setMessages(prev => [...prev, { type: 'system', text: data.text, isWin: data.isWin }])
    }

    socket.on('chat:message', onChatMessage)
    socket.on('chat:emote', onChatEmote)
    socket.on('chat:event', onChatEvent)

    return () => {
      socket.off('chat:message', onChatMessage)
      socket.off('chat:emote', onChatEmote)
      socket.off('chat:event', onChatEvent)
    }
  }, [socket])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    const text = input.trim().slice(0, 120)
    if (!text || !socket) return
    socket.emit('chat:message', { roomCode, text })
    setInput('')
  }

  const sendEmote = (emote) => {
    if (!socket) return
    socket.emit('chat:emote', { roomCode, emote })
  }

  return (
    <div className="flex flex-col border-l-4 border-ink bg-paper" style={{ width: 264, height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-ink px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 flex-shrink-0">
        <span>Chat</span>
        <span style={{ color: '#e5241e' }}>{playerCount} players</span>
      </div>

      {/* Emote bar */}
      <div className="flex gap-1 px-2 py-1.5 border-b-2 border-ink bg-paper-dim flex-shrink-0 flex-wrap">
        {ALLOWED_EMOTES.map(e => (
          <button key={e} onClick={() => sendEmote(e)}
            className="text-base hover:scale-125 transition-transform cursor-pointer"
            style={{ background: 'none', border: 'none', padding: '1px 3px', lineHeight: 1 }}>
            {e}
          </button>
        ))}
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1" style={{ fontSize: 9, fontFamily: 'ui-monospace,monospace' }}>
        {messages.map((msg, i) => {
          if (msg.type === 'emote') return (
            <div key={i} className="flex items-center gap-1.5">
              <span style={{ fontSize: 15 }}>{msg.emote}</span>
              <span style={{ color: '#555', fontSize: 8 }}>{msg.name}</span>
            </div>
          )
          if (msg.type === 'chat') return (
            <div key={i}>
              <span style={{ color: '#fbbf24' }}>{msg.name}: </span>
              <span style={{ color: '#888' }}>{msg.text}</span>
            </div>
          )
          // system
          return (
            <div key={i} style={{ color: msg.isWin ? '#e5241e' : '#555', fontStyle: 'italic' }}>
              {msg.text}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="flex border-t-2 border-ink flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message…"
          maxLength={120}
          style={{
            flex: 1, background: '#fafaf8', border: 'none', outline: 'none',
            fontFamily: 'ui-monospace,monospace', fontSize: 9, padding: '7px 8px',
            color: '#0e0e0e',
          }}
        />
        <button onClick={sendMessage}
          style={{
            background: '#e5241e', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'ui-monospace,monospace', fontSize: 8, fontWeight: 700,
            padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add chat socket handlers to socketHandlers.js**

In `setupSocketHandlers`, after the `socket.on('ranked:leave', ...)` handler and before the closing `})` of `io.on('connection', ...)`, add:

```js
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
```

- [ ] **Step 3: Emit `chat:event` at key game moments in socketHandlers.js**

In `processMoveForPlayer`, find the `if (won)` block. After `io.to(roomCode).emit('game:player-finished', ...)`, add:

```js
io.to(roomCode).emit('chat:event', {
  text: `${roomPlayer?.name || 'Someone'} found ${game.target} — ${updated.clicks} clicks · ${Math.floor((Date.now() - room.startTime) / 1000)}s 🏆`,
  isWin: true,
})
```

In `processMoveForPlayer`, find the undo token decrement logic. In `socketHandlers.js`, find the `socket.on('game:navigate', ...)` block. After `await processMoveForPlayer(...)` completes, this is already handled in `processMoveForPlayer` — instead, hook into the `no-Hub bounce` return in the API layer. For the undo event, add a new socket handler:

```js
// --- CHAT: LAST UNDO EVENT (client notifies after API undo response) ---
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
```

- [ ] **Step 4: Emit `chat:last-undo` from multi play page after undo**

In `src/app/play/multi/page.jsx`, in `handleUndo`, after `setUndoTokens(data.undoTokens)`:

```jsx
if (data.undoTokens === 0) {
  socketRef.current?.emit('chat:last-undo', { roomCode: gameState.roomCode })
}
```

- [ ] **Step 5: Emit `chat:event` on disconnect in socketHandlers.js**

In the `socket.on('disconnect', ...)` handler, after `removePlayer(roomCode, socket.id)`:

```js
const room2 = getRoom(roomCode)
if (room2) {
  const disconnectedName = room?.players?.get(socket.id)?.name || 'A player'
  io.to(roomCode).emit('chat:event', { text: `${disconnectedName} disconnected`, isWin: false })
}
```

- [ ] **Step 6: Wire LobbyChat into multi play page**

In `src/app/play/multi/page.jsx`:

Add import:
```jsx
import LobbyChat from '@/components/LobbyChat'
```

Replace the right rail div:
```jsx
// Find:
<div className="fixed right-0 top-0 z-30 hidden h-full lg:block">
  <LiveFeed players={players} myId={myIdRef.current} />
</div>

// Replace with:
<div className="fixed right-0 top-0 z-30 hidden h-full lg:flex flex-col">
  {/* Compact player strip */}
  <LiveFeed players={players} myId={myIdRef.current} compact />
  <LobbyChat
    socket={socketRef.current}
    roomCode={gameState?.roomCode}
    myName={gameState?.startPage ? undefined : 'You'}
    playerCount={players.length}
  />
</div>
```

- [ ] **Step 7: Add `compact` prop to LiveFeed for the combined view**

In `src/components/LiveFeed.jsx`, add `compact` prop. When `compact` is true, cap the container height at `200px` and reduce padding:

```jsx
export default function LiveFeed({ players, myId, compact = false }) {
  const sorted = [...players].sort((a, b) => a.clicks - b.clicks)

  return (
    <div className={`flex flex-col border-l-4 border-ink bg-paper border-b-4 ${compact ? '' : 'h-full'}`} style={{ width: 264, maxHeight: compact ? 200 : undefined }}>
      <div className="border-b-4 border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 flex-shrink-0">
        ⚡ Live Race Feed
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map(p => (
          <div key={p.id} className={`border-b-2 border-ink px-3 py-2 font-mono text-xs ${p.id === myId ? 'border-l-[6px] border-l-red bg-red/10' : ''}`}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="max-w-[120px] truncate font-display uppercase text-[11px]">
                {p.id === myId ? '▶ You' : p.name}
              </span>
              <span className="ml-2 font-display text-sm">{p.clicks}</span>
            </div>
            <div className={`truncate text-[9px] ${isHubRisk(p.currentPage) ? 'text-red' : 'text-ink/60'}`}>
              {p.currentPage || 'Starting…'}
            </div>
            {p.finished && <div className="text-[9px] uppercase tracking-wide text-red">✓ Finished</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify chat end-to-end**

Open two browser tabs on `/play/multi` for the same room. Send a message from tab 1 — appears in both. Click an emote — appears in both. Finish the race — "X found Hitler — N clicks · Ns 🏆" appears in red. Use last undo — "X used their last undo" appears.

- [ ] **Step 9: Commit**

```bash
git add src/components/LobbyChat.jsx src/components/LiveFeed.jsx src/lib/socketHandlers.js src/app/play/multi/page.jsx
git commit -m "feat: lobby chat — free text, emote bar, system events (finish/undo/disconnect)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ HUD three-zone cockpit with all locked sizes → Task 1
- ✅ `fh-shudder-fast` at ≤10s → Task 1 Step 1 (ultraDanger branch) + Step 2
- ✅ Mode hero card + variants row → Task 2
- ✅ Wikipedia page title strip → Task 3
- ✅ DamageOverlay chromatic aberration + red wash + shake + HP escalation → Task 4
- ✅ Match history: date, mode badge, target, clicks, path, rank, opponents (clickable), LP delta, ELO snapshot, filter tabs, load more → Task 5
- ✅ Public profile page `/profile/[userId]` → Task 5 Step 5+6
- ✅ LobbyChat: free text, emotes, system events → Task 6
- ✅ HTML stripping on chat messages → Task 6 Step 2
- ✅ `chat:event` on win, last undo, disconnect → Task 6 Steps 3, 4, 5

**Type consistency:**
- `chat:event` emitted by server with `{ text, isWin }` — consumed in `LobbyChat.jsx` as `msg.isWin` ✅
- `DamageOverlay` props: `trigger` (object with timestamp), `hp`, `maxHp` — used consistently in Task 4 Steps 2 and 4 ✅
- `LiveFeed` new `compact` prop defaults to `false` — existing solo usage unchanged ✅
- `opponentIds String[]` on Match — resolved to `opponents: [{ userId, name }]` in API, consumed as `m.opponents` in profile UI ✅
