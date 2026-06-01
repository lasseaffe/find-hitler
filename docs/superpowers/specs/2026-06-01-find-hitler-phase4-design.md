# Find Hitler — Phase 4: Post-Game Node Graph + Leaderboard
**Date:** 2026-06-01  
**Status:** Approved  
**Phase:** 4 of 5

---

## Goal

Add a shareable post-game moment (D3 force-directed node graph of player paths) and a localStorage-backed leaderboard. Both solo and multiplayer games route to the new results page.

---

## Scope

### In scope
- `/results` page with D3 force-directed node graph (React-owns-DOM, D3-computes-positions)
- Solo wins routed to `/results` (path already returned by move API, currently discarded)
- Multiplayer wins routed to `/results` (finishers[] paths already emitted by socketHandlers)
- Copy Path button (clipboard text: `Brazil → Coffee → Germany → Adolf Hitler`)
- Share button (summary text to clipboard; real shareable URLs deferred to Phase 5)
- `/leaderboard` page: minimal single board, localStorage persistence, 50-entry LRU cap
- `npm install d3` as first step

### Deliberately cut / deferred
| Item | Reason | Deferral |
|---|---|---|
| `/results/[roomId]` with server-persistent store | Rooms are in-memory; sessionStorage matches existing codebase pattern | Phase 5 (when accounts + DB land) |
| Dead-end branch stubs (faded grey) | `useUndoToken` pops history, abandoned paths aren't tracked | Phase 4-CUT (marked in code) |
| Leaderboard tabs (Today / All-Time / Speedrun) | Defer UI complexity; persistence foundation ships now | Phase 5 polish pass |
| Leaderboard filter/pagination | Same reason | Phase 5 polish pass |
| Real shareable URLs | Needs server persistence | Phase 5 |

---

## Architecture

### Data flow — solo

```
play/page.jsx: WIN response already returns `path` (move/route.js:82) — currently discarded
  ↓
Capture path in handleNavigate when data.status === 'WIN'
Write sessionStorage['gameResults'] = { finishers: [{ name, path, clicks, time, score, isMe: true }], target, mode }
Call leaderboard.addEntry({ mode, target, clicks, time, score, playerName })
WinScreen gains "View Node Graph →" button → router.push('/results')
  ↓
/results page reads sessionStorage['gameResults'], renders ResultsScreen
```

### Data flow — multiplayer

```
play/multi/page.jsx: game:player-finished events accumulate in finishers[] state
  (each finisher already carries { playerId, name, clicks, seconds, score, path, isBot })
  ↓
MultiWinScreen gains "View Results →" button
  → writes sessionStorage['gameResults'] = { finishers, target, mode }
  → human finishers written to leaderboard.addEntry()
  → router.push('/results')
  ↓
/results page reads sessionStorage['gameResults'], renders ResultsScreen
```

### Session storage schema

```js
// sessionStorage['gameResults']
{
  target: string,           // "Adolf Hitler"
  mode: string,             // "classic" | "speedrun" | "golf" | ...
  finishers: [
    {
      name: string,
      path: string[],       // ["Brazil", "Coffee production in Brazil", ..., "Adolf Hitler"]
      clicks: number,
      time: number,         // seconds, null for golf/jesus
      score: number,
      isMe: boolean,
      isBot: boolean,
    }
  ]
}
```

---

## New Files

### `src/lib/pathGraph.js` — pure, unit-tested

```
buildGraph(finishers) → { nodes: Node[], links: Link[] }
```

- Merges shared pages into one node (same normalized title → same node id)
- Each node: `{ id, label (≤20 chars truncated), fullTitle }`
- Each link: `{ source, target, playerId, color }` — color from finish order
- Start node gets a special `isStart: true` flag; target node gets `isTarget: true`
- Dead-end stubs: `// PHASE-4-CUT: dead-end stubs — undo pops history, data not available`

### `src/lib/leaderboard.js` — pure, unit-tested

```
addEntry({ mode, target, clicks, time, score, playerName }) → void
getEntries({ mode? }) → Entry[]   // sorted by score desc, capped at 50 LRU
```

- SSR-guarded: all reads/writes wrapped in `typeof window !== 'undefined'` check
- LRU cap: if >50 entries, drop the lowest-score entry (not oldest)
- Persisted in `localStorage['findHitlerLeaderboard']` as JSON

### `src/lib/resultColors.js` — trivial

```
getColor(finishIndex) → hex string
// 0 → #2ecc71 (green), 1 → #e74c3c (red), 2 → #e67e22 (orange), 3 → #3498db (blue)
// 4+ → #95a5a6 (grey)
```

### `src/components/NodeGraph.jsx` — client component

- `'use client'`
- Props: `{ nodes, links }`
- Runs `d3.forceSimulation` in a `useRef`/`useEffect` — D3 computes x/y, React renders SVG
- On each simulation tick: `setPositions(nodes.map(n => ({ id: n.id, x: n.x, y: n.y })))`
- SVG renders: `<line>` per link (colored by player), `<circle>` + `<text>` per node
- Clicking a node shows full title tooltip (HTML title attribute is sufficient)
- Winner's path lines: `strokeWidth=3`, others: `strokeWidth=1.5`
- Start node: yellow ring (#f1c40f). Target node: red fill (#c0392b)

### `src/components/ResultsScreen.jsx` — client component

Layout (matches roadmap ASCII):
```
┌─────────────────────────────────────┐
│  RACE COMPLETE                      │
│  Target: Adolf Hitler               │
├─────────────────────────────────────┤
│         [NodeGraph SVG]             │
│                                     │
│  🟢 you (lasse)   4 clicks · 47s   │
│  🔴 DeepLink      7 clicks · DNF   │
├─────────────────────────────────────┤
│  [Copy Path]  [Share]  [Play Again] │
└─────────────────────────────────────┘
```

- Copy Path: copies `path.join(' → ')` for "me" (first `isMe: true` finisher)
- Share: copies summary card text to clipboard
- Play Again: `router.push('/')`

### `src/app/results/page.jsx`

- Reads `sessionStorage['gameResults']` on mount
- If absent → `router.push('/')`
- Clears key after read (one-time view; reload = gone, consistent with `gameInit` pattern)
- Renders `<ResultsScreen />`

### `src/app/leaderboard/page.jsx` + `src/components/Leaderboard.jsx`

- Reads `leaderboard.getEntries()` on mount
- Single table: Rank / Player / Target / Clicks / Time / Score / Date
- Sorted by score desc
- Empty state: "No races recorded yet. Play a game to get on the board."
- Nav link added to home page header

---

## Modifications to Existing Files

| File | Change |
|---|---|
| `src/app/play/page.jsx` | Capture `data.path` on WIN; write `gameResults` to sessionStorage; call `leaderboard.addEntry()`; WinScreen gets `onViewResults` prop |
| `src/components/WinScreen.jsx` | Add "View Node Graph →" button (secondary, below Play Again) |
| `src/app/play/multi/page.jsx` | After `game:you-finished`, accumulate finishers until done or user clicks; MultiWinScreen gets `onViewResults` prop |
| `src/components/MultiWinScreen.jsx` | Add "View Results →" button; on click write `gameResults` + route to `/results` |
| `src/app/page.jsx` | Add "Leaderboard" link in header |
| `package.json` | `npm install d3` |

---

## Testing

Unit tests in `tests/` (Vitest, matching Phase 1–3 convention):

- `pathGraph.test.js`: buildGraph with single player, two players sharing a node, empty finishers
- `leaderboard.test.js`: addEntry, getEntries, 50-entry LRU cap, SSR guard (mock window absent)

No component or D3-in-jsdom tests (fragile, not done in this codebase).

---

## Deferred / Follow-up (Phase 5)

- `/results/[roomId]` with server-persisted finished-game store (TTL cleanup needed)
- Real shareable URLs
- Leaderboard tabs (Today / All-Time / Speedrun), target filter, pagination
- Dead-end branch stubs in node graph (requires new `visitLog` tracking in gameState)
