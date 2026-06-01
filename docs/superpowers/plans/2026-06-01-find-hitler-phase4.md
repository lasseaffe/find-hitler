# Find Hitler Phase 4 — Node Graph + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a D3 force-directed node graph of player paths on a `/results` page and a localStorage-backed `/leaderboard`, both reachable from solo and multiplayer win screens.

**Architecture:** Solo game already returns `path[]` on WIN (move/route.js:82) — capture it in `play/page.jsx` and write to `sessionStorage['gameResults']`. Multiplayer already has `finishers[]` state in `multi/page.jsx` — write that same key on win. Both win screens grow a "View Results →" button. `/results` reads the key and renders a D3 SVG node graph via `NodeGraph.jsx`. `/leaderboard` reads `localStorage` via `leaderboard.js`. Two pure libs (`pathGraph.js`, `leaderboard.js`) ship with unit tests; no API changes needed.

**Tech Stack:** Next.js 15 App Router, React 19, D3 v7, Vitest, Tailwind CSS, sessionStorage + localStorage

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/pathGraph.js` | Pure: merge finisher paths into nodes+links for D3 |
| Create | `src/lib/leaderboard.js` | Pure: localStorage CRUD, 50-entry LRU cap |
| Create | `src/lib/resultColors.js` | Pure: finish-order → hex color |
| Create | `src/components/NodeGraph.jsx` | D3 force sim, React renders SVG |
| Create | `src/components/ResultsScreen.jsx` | Layout: graph + finisher rows + action buttons |
| Create | `src/app/results/page.jsx` | Reads sessionStorage, renders ResultsScreen |
| Create | `src/app/leaderboard/page.jsx` | Reads leaderboard.getEntries(), renders table |
| Create | `src/components/Leaderboard.jsx` | Table UI + empty state |
| Create | `tests/pathGraph.test.js` | Unit tests for pathGraph |
| Create | `tests/leaderboard.test.js` | Unit tests for leaderboard |
| Modify | `src/app/play/page.jsx` | Capture path on WIN, write sessionStorage, call leaderboard |
| Modify | `src/components/WinScreen.jsx` | Add "View Node Graph →" button + `onViewResults` prop |
| Modify | `src/app/play/multi/page.jsx` | Write sessionStorage on win, add `onViewResults` prop |
| Modify | `src/components/MultiWinScreen.jsx` | Add "View Results →" button + `onViewResults` prop |
| Modify | `src/app/page.jsx` | Add Leaderboard nav link in header |

---

## Task 1: Install D3 + create `resultColors.js`

**Files:**
- Modify: `package.json` (npm install)
- Create: `src/lib/resultColors.js`

- [ ] **Step 1: Install D3**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npm install d3
```

Expected: d3 appears in `package.json` dependencies, no errors.

- [ ] **Step 2: Create `src/lib/resultColors.js`**

```js
// src/lib/resultColors.js
const COLORS = ['#2ecc71', '#e74c3c', '#e67e22', '#3498db']
const FALLBACK = '#95a5a6'

export function getColor(finishIndex) {
  return COLORS[finishIndex] ?? FALLBACK
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/resultColors.js
git commit -m "feat: install d3, add resultColors utility"
```

---

## Task 2: `pathGraph.js` — pure graph builder (TDD)

**Files:**
- Create: `src/lib/pathGraph.js`
- Create: `tests/pathGraph.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/pathGraph.test.js
import { describe, it, expect } from 'vitest'
import { buildGraph } from '../src/lib/pathGraph.js'

describe('buildGraph', () => {
  it('returns empty nodes and links for empty finishers', () => {
    const { nodes, links } = buildGraph([])
    expect(nodes).toEqual([])
    expect(links).toEqual([])
  })

  it('builds nodes from a single finisher path', () => {
    const finishers = [{ name: 'Alice', path: ['Brazil', 'Coffee', 'Adolf Hitler'], clicks: 2, isMe: true, isBot: false }]
    const { nodes, links } = buildGraph(finishers)
    expect(nodes.map(n => n.fullTitle)).toEqual(['Brazil', 'Coffee', 'Adolf Hitler'])
    expect(links).toHaveLength(2)
  })

  it('merges shared nodes across two finishers', () => {
    const finishers = [
      { name: 'Alice', path: ['Brazil', 'Coffee', 'Adolf Hitler'], clicks: 2, isMe: true, isBot: false },
      { name: 'Bob',   path: ['Brazil', 'Germany', 'Adolf Hitler'], clicks: 2, isMe: false, isBot: false },
    ]
    const { nodes } = buildGraph(finishers)
    // Brazil and Adolf Hitler are shared — should appear only once each
    const titles = nodes.map(n => n.fullTitle)
    expect(titles.filter(t => t === 'Brazil')).toHaveLength(1)
    expect(titles.filter(t => t === 'Adolf Hitler')).toHaveLength(1)
    expect(titles).toHaveLength(4) // Brazil, Coffee, Germany, Adolf Hitler
  })

  it('marks first node as isStart and last node of first finisher as isTarget', () => {
    const finishers = [{ name: 'Alice', path: ['Brazil', 'Adolf Hitler'], clicks: 1, isMe: true, isBot: false }]
    const { nodes } = buildGraph(finishers)
    expect(nodes.find(n => n.fullTitle === 'Brazil').isStart).toBe(true)
    expect(nodes.find(n => n.fullTitle === 'Adolf Hitler').isTarget).toBe(true)
  })

  it('truncates long node labels to 20 chars', () => {
    const long = 'A'.repeat(30)
    const finishers = [{ name: 'Alice', path: [long, 'End'], clicks: 1, isMe: true, isBot: false }]
    const { nodes } = buildGraph(finishers)
    const node = nodes.find(n => n.fullTitle === long)
    expect(node.label.length).toBeLessThanOrEqual(20)
  })

  it('assigns color from finisher index to each link', () => {
    const finishers = [
      { name: 'Alice', path: ['A', 'B'], clicks: 1, isMe: true, isBot: false },
      { name: 'Bob',   path: ['A', 'C'], clicks: 1, isMe: false, isBot: false },
    ]
    const { links } = buildGraph(finishers)
    const aliceLink = links.find(l => l.targetTitle === 'B')
    const bobLink   = links.find(l => l.targetTitle === 'C')
    expect(aliceLink.color).toBe('#2ecc71')
    expect(bobLink.color).toBe('#e74c3c')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npm test -- tests/pathGraph.test.js
```

Expected: all 6 tests fail with "Cannot find module '../src/lib/pathGraph.js'"

- [ ] **Step 3: Implement `src/lib/pathGraph.js`**

```js
// src/lib/pathGraph.js
import { getColor } from './resultColors.js'

function nodeId(title) {
  return title.trim().toLowerCase().replace(/\s+/g, '_')
}

function truncate(title) {
  return title.length > 20 ? title.slice(0, 19) + '…' : title
}

export function buildGraph(finishers) {
  if (!finishers.length) return { nodes: [], links: [] }

  const nodeMap = new Map()  // id → node object
  const links = []

  finishers.forEach((finisher, finishIndex) => {
    const color = getColor(finishIndex)
    finisher.path.forEach((title, i) => {
      const id = nodeId(title)
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: truncate(title),
          fullTitle: title,
          isStart: false,
          isTarget: false,
        })
      }
      if (i > 0) {
        links.push({
          source: nodeId(finisher.path[i - 1]),
          target: id,
          targetTitle: title,
          color,
          finishIndex,
        })
      }
    })
  })

  const nodes = Array.from(nodeMap.values())

  // Mark start (first page of first finisher) and target (last page of first finisher)
  const firstPath = finishers[0].path
  if (firstPath.length > 0) {
    const startNode = nodeMap.get(nodeId(firstPath[0]))
    if (startNode) startNode.isStart = true
    const targetNode = nodeMap.get(nodeId(firstPath[firstPath.length - 1]))
    if (targetNode) targetNode.isTarget = true
  }

  return { nodes, links }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/pathGraph.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pathGraph.js tests/pathGraph.test.js src/lib/resultColors.js
git commit -m "feat: pathGraph pure graph builder with tests"
```

---

## Task 3: `leaderboard.js` — localStorage persistence (TDD)

**Files:**
- Create: `src/lib/leaderboard.js`
- Create: `tests/leaderboard.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/leaderboard.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// Mock localStorage for node environment
const store = {}
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
}

// Import AFTER mocking localStorage (dynamic to avoid top-level hoisting issues)
const { addEntry, getEntries, STORAGE_KEY } = await import('../src/lib/leaderboard.js')

describe('leaderboard', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('getEntries returns empty array when storage is empty', () => {
    expect(getEntries()).toEqual([])
  })

  it('addEntry stores an entry retrievable by getEntries', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'lasse' })
    const entries = getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].playerName).toBe('lasse')
    expect(entries[0].score).toBe(7530)
  })

  it('getEntries returns entries sorted by score descending', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'a' })
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 3, time: 30, score: 8500, playerName: 'b' })
    const entries = getEntries()
    expect(entries[0].score).toBe(8500)
    expect(entries[1].score).toBe(7530)
  })

  it('getEntries filters by mode when provided', () => {
    addEntry({ mode: 'classic',  target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'a' })
    addEntry({ mode: 'speedrun', target: 'Adolf Hitler', clicks: 3, time: 20, score: 9000, playerName: 'b' })
    expect(getEntries({ mode: 'classic' })).toHaveLength(1)
    expect(getEntries({ mode: 'speedrun' })).toHaveLength(1)
    expect(getEntries()).toHaveLength(2)
  })

  it('caps at 50 entries, dropping the lowest score when over the limit', () => {
    for (let i = 0; i < 50; i++) {
      addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 5, time: 60, score: 1000 + i, playerName: `p${i}` })
    }
    // All 50 have score 1000..1049. Add one with score 500 — should be dropped immediately.
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 10, time: 90, score: 500, playerName: 'worst' })
    const entries = getEntries()
    expect(entries).toHaveLength(50)
    expect(entries.find(e => e.playerName === 'worst')).toBeUndefined()
  })

  it('addEntry attaches a date string to each entry', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'lasse' })
    const [entry] = getEntries()
    expect(typeof entry.date).toBe('string')
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/leaderboard.test.js
```

Expected: all 6 tests fail with "Cannot find module '../src/lib/leaderboard.js'"

- [ ] **Step 3: Implement `src/lib/leaderboard.js`**

```js
// src/lib/leaderboard.js
export const STORAGE_KEY = 'findHitlerLeaderboard'
const MAX_ENTRIES = 50

function today() {
  return new Date().toISOString().slice(0, 10)
}

function read() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function write(entries) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function addEntry({ mode, target, clicks, time, score, playerName }) {
  const entries = read()
  entries.push({ mode, target, clicks, time, score, playerName, date: today() })

  if (entries.length > MAX_ENTRIES) {
    // Drop the entry with the lowest score (LRU by quality)
    const minIdx = entries.reduce((best, e, i, arr) => e.score < arr[best].score ? i : best, 0)
    entries.splice(minIdx, 1)
  }

  write(entries)
}

export function getEntries({ mode } = {}) {
  const entries = read()
  const filtered = mode ? entries.filter(e => e.mode === mode) : entries
  return [...filtered].sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/leaderboard.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leaderboard.js tests/leaderboard.test.js
git commit -m "feat: leaderboard localStorage persistence with LRU cap"
```

---

## Task 4: `NodeGraph.jsx` — D3 force simulation in React SVG

**Files:**
- Create: `src/components/NodeGraph.jsx`

`★ Insight ─────────────────────────────────────`
D3 and React can conflict when both try to control the DOM. The cleanest pattern for this codebase:
D3 only *computes* positions (runs the simulation), React *renders* the SVG. On each tick, copy node x/y into React state. This keeps React in control of the DOM and avoids ref-based D3 DOM manipulation that would fight Next.js hydration.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Create `src/components/NodeGraph.jsx`**

```jsx
// src/components/NodeGraph.jsx
'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const WIDTH = 600
const HEIGHT = 400
const NODE_R = 18

export default function NodeGraph({ nodes, links }) {
  const [positions, setPositions] = useState({})
  const simRef = useRef(null)

  useEffect(() => {
    if (!nodes.length) return

    // Deep-clone so D3 can mutate x/y without touching React state objects
    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = links.map(l => ({ ...l }))

    simRef.current?.stop()
    simRef.current = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(90).strength(1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collision', d3.forceCollide(NODE_R + 8))
      .on('tick', () => {
        const pos = {}
        simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
        setPositions({ ...pos })
      })

    return () => simRef.current?.stop()
  }, [nodes, links])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full border border-yellow-400/20 rounded-xl bg-[#0d1117]"
      style={{ maxHeight: 400 }}
    >
      {/* Links */}
      {links.map((link, i) => {
        const s = positions[link.source]
        const t = positions[link.target]
        if (!s || !t) return null
        const isWinner = link.finishIndex === 0
        return (
          <line
            key={i}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={link.color}
            strokeWidth={isWinner ? 3 : 1.5}
            strokeOpacity={isWinner ? 0.9 : 0.6}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions[node.id]
        if (!pos) return null
        const fill = node.isTarget ? '#c0392b' : '#1a1a2e'
        const stroke = node.isStart ? '#f1c40f' : node.isTarget ? '#c0392b' : '#4a5568'
        const strokeW = node.isStart || node.isTarget ? 3 : 1.5
        return (
          <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
            <title>{node.fullTitle}</title>
            <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={strokeW} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill={node.isTarget ? '#fff' : '#e2e8f0'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NodeGraph.jsx
git commit -m "feat: NodeGraph D3 force simulation rendered as React SVG"
```

---

## Task 5: `ResultsScreen.jsx` — post-game layout

**Files:**
- Create: `src/components/ResultsScreen.jsx`

- [ ] **Step 1: Create `src/components/ResultsScreen.jsx`**

```jsx
// src/components/ResultsScreen.jsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { buildGraph } from '@/lib/pathGraph'
import { getColor } from '@/lib/resultColors'

// Dynamic import avoids SSR issues with D3 and SVG
const NodeGraph = dynamic(() => import('@/components/NodeGraph'), { ssr: false })

const MEDALS = ['🥇', '🥈', '🥉']

export default function ResultsScreen({ results }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [sharedCopied, setSharedCopied] = useState(false)

  const { nodes, links } = buildGraph(results.finishers)
  const me = results.finishers.find(f => f.isMe) || results.finishers[0]

  const handleCopyPath = async () => {
    const text = me?.path?.join(' → ') || ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const lines = [
      `🎯 Find Hitler — ${results.target}`,
      ...results.finishers.map((f, i) => {
        const medal = MEDALS[i] || '▪'
        const time = f.time != null ? ` · ${f.time}s` : ''
        return `${medal} ${f.name}: ${f.clicks} clicks${time}`
      }),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setSharedCopied(true)
    setTimeout(() => setSharedCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <div className="text-center pt-8 pb-4 border-b border-yellow-400/20">
        <div className="text-3xl font-black text-yellow-400 tracking-tight">RACE COMPLETE</div>
        <div className="text-red-400 font-mono text-sm mt-1">Target: {results.target}</div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Node Graph */}
        {nodes.length > 0 && <NodeGraph nodes={nodes} links={links} />}

        {/* Finisher rows */}
        <div className="space-y-2">
          {results.finishers.map((f, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg font-mono text-sm ${
                f.isMe ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-[#1a1a2e]'
              }`}
            >
              <span className="text-base">{MEDALS[i] || '▪'}</span>
              <span
                className="flex-1 font-bold"
                style={{ color: getColor(i) }}
              >
                {f.name}{f.isMe ? ' (you)' : ''}
              </span>
              <span className="text-yellow-400">{f.clicks} clicks</span>
              {f.time != null && <span className="text-gray-400">{f.time}s</span>}
              {f.score != null && <span className="text-gray-300">{f.score.toLocaleString()} pts</span>}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCopyPath}
            className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Path'}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-[#1a1a2e] border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {sharedCopied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ResultsScreen.jsx
git commit -m "feat: ResultsScreen with node graph, finisher rows, share actions"
```

---

## Task 6: `/results` page

**Files:**
- Create: `src/app/results/page.jsx`

- [ ] **Step 1: Create `src/app/results/page.jsx`**

```jsx
// src/app/results/page.jsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ResultsScreen from '@/components/ResultsScreen'

export default function ResultsPage() {
  const router = useRouter()
  const [results, setResults] = useState(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('gameResults')
    if (!raw) { router.push('/'); return }
    sessionStorage.removeItem('gameResults')
    setResults(JSON.parse(raw))
  }, [router])

  if (!results) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117] text-gray-400 font-mono">
        Loading...
      </div>
    )
  }

  return <ResultsScreen results={results} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/results/page.jsx
git commit -m "feat: /results page reads sessionStorage and renders ResultsScreen"
```

---

## Task 7: Wire solo game → results

**Files:**
- Modify: `src/app/play/page.jsx`
- Modify: `src/components/WinScreen.jsx`

- [ ] **Step 1: Add `onViewResults` prop to `WinScreen.jsx`**

Add a second button below "Play Again":

```jsx
// src/components/WinScreen.jsx
// Change the props signature:
export default function WinScreen({ score, clicks, time, target, mode, parGrade, parDelta, timeUp, onPlayAgain, onViewResults }) {
```

Add the button after the Play Again button (inside the card div, after the existing `<button>`):

```jsx
{onViewResults && !timeUp && (
  <button
    onClick={onViewResults}
    className="w-full mt-2 py-2 bg-transparent border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
  >
    View Node Graph →
  </button>
)}
```

- [ ] **Step 2: Capture `path` and write sessionStorage in `play/page.jsx`**

In `handleNavigate`, replace the WIN handling block (lines 72–79) with:

```jsx
if (data.status === 'WIN') {
  // Write results to sessionStorage for /results page
  const playerName = JSON.parse(sessionStorage.getItem('gameInit') || '{}').playerName
    || 'You'
  const finisher = {
    name: playerName,
    path: data.path || [],
    clicks: data.clicks,
    time: data.time,
    score: data.score,
    isMe: true,
    isBot: false,
  }
  sessionStorage.setItem('gameResults', JSON.stringify({
    target: gameState.target,
    mode: gameState.mode,
    finishers: [finisher],
  }))
  // Add to leaderboard (import at top of file)
  addEntry({
    mode: gameState.mode,
    target: gameState.target,
    clicks: data.clicks,
    time: data.time,
    score: data.score,
    playerName,
  })
  setWin({
    score: data.score,
    clicks: data.clicks,
    time: data.time,
    parGrade: data.parGrade || null,
    parDelta: data.parDelta ?? null,
  })
}
```

Add the import at the top of `play/page.jsx`:

```jsx
import { addEntry } from '@/lib/leaderboard'
```

- [ ] **Step 3: Pass `onViewResults` to `WinScreen` in the JSX**

Find the `<WinScreen ... />` block and add the prop:

```jsx
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
    onViewResults={() => router.push('/results')}
  />
)}
```

- [ ] **Step 4: Fix playerName capture**

The `gameInit` key is removed at the top of the `useEffect` before `handleNavigate` ever fires. Store the playerName in a ref instead:

```jsx
// Add near the top of PlayGame(), after the existing state declarations:
const playerNameRef = useRef('You')
```

In the `useEffect` that reads `gameInit`, add after `sessionStorage.removeItem('gameInit')`:

```jsx
playerNameRef.current = init.playerName || 'You'
```

Then in the WIN block in `handleNavigate`, replace the sessionStorage playerName lookup with:

```jsx
const playerName = playerNameRef.current
```

Also add `useRef` to the existing import from react:
```jsx
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/play/page.jsx src/components/WinScreen.jsx
git commit -m "feat: wire solo win → sessionStorage + leaderboard + view results button"
```

---

## Task 8: Wire multiplayer game → results

**Files:**
- Modify: `src/app/play/multi/page.jsx`
- Modify: `src/components/MultiWinScreen.jsx`

- [ ] **Step 1: Add `onViewResults` prop to `MultiWinScreen.jsx`**

Change props signature and add a button:

```jsx
// src/components/MultiWinScreen.jsx
export default function MultiWinScreen({ finishers, myId, target, onPlayAgain, onViewResults }) {
```

Add after the Play Again button:

```jsx
{onViewResults && (
  <button
    onClick={onViewResults}
    className="w-full mt-2 py-2 bg-transparent border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-black rounded-lg uppercase tracking-wide text-sm transition-colors"
  >
    View Results →
  </button>
)}
```

- [ ] **Step 2: Write sessionStorage and leaderboard in `multi/page.jsx`**

Add import at top:
```jsx
import { addEntry } from '@/lib/leaderboard'
```

Add a `handleViewResults` function inside `MultiGame`, just above the `if (!gameState)` guard:

```jsx
const handleViewResults = useCallback(() => {
  const mapped = finishers.map((f, i) => ({
    name: f.name,
    path: f.path || [],
    clicks: f.clicks,
    time: f.seconds ?? null,
    score: f.score ?? null,
    isMe: f.playerId === myIdRef.current,
    isBot: f.isBot || false,
  }))

  // Write human (non-bot) finishers to leaderboard
  mapped.filter(f => f.isMe).forEach(f => {
    addEntry({
      mode: gameState.mode,
      target: gameState.target,
      clicks: f.clicks,
      time: f.time,
      score: f.score || 0,
      playerName: f.name,
    })
  })

  sessionStorage.setItem('gameResults', JSON.stringify({
    target: gameState.target,
    mode: gameState.mode,
    finishers: mapped,
  }))

  router.push('/results')
}, [finishers, gameState, router])
```

Pass it to `<MultiWinScreen />`:

```jsx
{myFinish && (
  <MultiWinScreen
    finishers={finishers}
    myId={myIdRef.current}
    target={gameState.target}
    onPlayAgain={() => router.push('/')}
    onViewResults={handleViewResults}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/play/multi/page.jsx src/components/MultiWinScreen.jsx
git commit -m "feat: wire multiplayer win → sessionStorage + leaderboard + view results button"
```

---

## Task 9: `Leaderboard.jsx` + `/leaderboard` page

**Files:**
- Create: `src/components/Leaderboard.jsx`
- Create: `src/app/leaderboard/page.jsx`

- [ ] **Step 1: Create `src/components/Leaderboard.jsx`**

```jsx
// src/components/Leaderboard.jsx
'use client'

export default function Leaderboard({ entries }) {
  if (!entries.length) {
    return (
      <div className="text-center py-20 text-gray-500 font-mono">
        No races recorded yet. Play a game to get on the board.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="text-yellow-400 border-b border-yellow-400/20 text-left">
            <th className="py-2 pr-4 w-8">#</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Target</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4">Clicks</th>
            <th className="py-2 pr-4">Time</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={i}
              className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e]/50 transition-colors"
            >
              <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
              <td className="py-2 pr-4 text-white font-bold">{e.playerName}</td>
              <td className="py-2 pr-4 text-red-400">{e.target}</td>
              <td className="py-2 pr-4 text-gray-400 capitalize">{e.mode}</td>
              <td className="py-2 pr-4 text-yellow-400">{e.clicks}</td>
              <td className="py-2 pr-4 text-gray-400">{e.time != null ? `${e.time}s` : '—'}</td>
              <td className="py-2 pr-4 text-green-400">{e.score?.toLocaleString() ?? '—'}</td>
              <td className="py-2 text-gray-500">{e.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/leaderboard/page.jsx`**

```jsx
// src/app/leaderboard/page.jsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEntries } from '@/lib/leaderboard'
import Leaderboard from '@/components/Leaderboard'

export default function LeaderboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    setEntries(getEntries())
  }, [])

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-yellow-400 tracking-tight">Leaderboard</h1>
            <p className="text-gray-500 font-mono text-sm mt-1">Your local race history</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-yellow-400/30 hover:border-yellow-400 text-yellow-400 font-black rounded-lg uppercase tracking-widest text-xs transition-colors"
          >
            ← Home
          </button>
        </div>

        <Leaderboard entries={entries} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Leaderboard.jsx src/app/leaderboard/page.jsx
git commit -m "feat: /leaderboard page with localStorage-backed race history"
```

---

## Task 10: Add Leaderboard nav link to home page

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Add leaderboard link to `page.jsx`**

The home page JSX currently starts with the `<div className="min-h-screen ...">` wrapper. Add a nav link in the top-right. Find the opening wrapper and insert a header bar. Locate the existing `return (` in `HomePage` and add a top bar as the first child:

```jsx
// At the very top of the returned JSX in HomePage, before the existing title/heading:
<div className="absolute top-4 right-4">
  <a
    href="/leaderboard"
    className="text-yellow-400/70 hover:text-yellow-400 font-mono text-xs uppercase tracking-widest transition-colors"
  >
    Leaderboard →
  </a>
</div>
```

The parent div needs `relative` positioning if it doesn't already have it. Check the opening wrapper class and add `relative` if absent.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: add Leaderboard nav link to home page"
```

---

## Task 11: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3003](http://localhost:3003)

- [ ] **Step 2: Solo flow**
  1. Enter name → pick Classic → Adolf Hitler → Start
  2. Navigate to Hitler (can use Ctrl+F to search links if needed)
  3. Win screen appears → click "View Node Graph →"
  4. Verify `/results` shows: header "RACE COMPLETE", SVG node graph with at least 2 connected nodes, your name in the finisher row, Copy Path and Share buttons

- [ ] **Step 3: Copy Path**
  1. Click "Copy Path" → paste into notepad → verify format: `PageA → PageB → Adolf Hitler`

- [ ] **Step 4: Leaderboard**
  1. Click browser back (or home link) → click "Leaderboard →" top-right
  2. Verify the race you just played appears in the table with correct player name, target, clicks, score, date

- [ ] **Step 5: Multiplayer flow**
  1. Create a lobby with 1 bot → start game → let bot win (or navigate yourself)
  2. Win screen → "View Results →" → verify node graph shows multiple colored paths

- [ ] **Step 6: Empty leaderboard**
  1. Open DevTools → Application → Local Storage → delete `findHitlerLeaderboard` key
  2. Navigate to `/leaderboard` → verify "No races recorded yet" empty state

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: Phase 4 complete — node graph + leaderboard smoke-tested"
```

---

## Self-Review Checklist (completed by plan author)

**Spec coverage:**
- [x] D3 force-directed node graph (Tasks 4, 5)
- [x] `/results` page (Task 6)
- [x] Solo path capture (Task 7)
- [x] Multiplayer path capture (Task 8)
- [x] Copy Path button (Task 5 — ResultsScreen)
- [x] Share button (Task 5 — ResultsScreen)
- [x] Play Again button (Task 5 — ResultsScreen)
- [x] Leaderboard localStorage, 50-entry LRU cap (Task 3)
- [x] `/leaderboard` page + table (Task 9)
- [x] Nav link from home (Task 10)
- [x] `npm install d3` (Task 1)
- [x] Winner path = green, others colored by finish order (Tasks 2 + 4)
- [x] Start node = yellow ring, target node = red fill (Task 4)
- [x] Node click shows full title tooltip (Task 4 — `<title>` element)
- [x] Dead-end stubs cut (noted in spec, no task needed)

**Placeholder scan:** No TBD/TODO in any code block. All function signatures consistent across tasks.

**Type consistency:**
- `buildGraph(finishers)` → `{ nodes, links }` used consistently in Tasks 2, 5
- `getEntries({ mode? })` / `addEntry({...})` used consistently in Tasks 3, 7, 8
- `getColor(finishIndex)` used in Tasks 1, 2, 5
- `finisher.isMe` used in Tasks 7, 8, 5 consistently
- `finisher.time` (seconds as number | null) consistent across Task 5 display and Task 7/8 capture
