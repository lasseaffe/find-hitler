# Fact Checker Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Fact Checker" game mode where players read a Claude-tampered Wikipedia article and accuse inaccuracies in real time, relying on their own knowledge.

**Architecture:** New game page at `/play/fact-checker` backed by a curated article pool in Postgres. Claude generates tampered articles + answer keys; an admin review queue gates them before they go live. Difficulty controls whether spans are pre-marked (Easy/Medium) or require free-text selection (Hard/Hardcore).

**Tech Stack:** Next.js 15 App Router, Prisma 7 + PostgreSQL (Supabase), React 19, Tailwind v4, Vitest, existing `src/lib/db.js` singleton.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `FactCheckArticle` model |
| `src/lib/factChecker.js` | Create | Pure helpers: normalize selection, score accusation, compute spans |
| `tests/factChecker.test.js` | Create | Unit tests for helpers |
| `src/app/api/fact-checker/article/route.js` | Create | GET — return random approved article (strips answer key) |
| `src/app/api/fact-checker/accuse/route.js` | Create | POST — validate accusation, return verdict + score delta |
| `src/app/api/fact-checker/complete/route.js` | Create | POST — record completed game to Match table |
| `src/app/api/admin/fact-checker/route.js` | Create | GET list + PATCH approve/reject (admin-gated) |
| `src/components/FactCheckerHUD.jsx` | Create | Two-row HUD: title/difficulty/count + chips bar |
| `src/components/FactCheckerArticle.jsx` | Create | Article renderer with accusation mechanic |
| `src/app/play/fact-checker/page.jsx` | Create | Full game page |
| `src/app/admin/fact-checker/page.jsx` | Create | Admin review queue UI |
| `src/app/page.jsx` | Modify | Add `fact-checker` to MODES array |

---

### Task 1: DB schema — add FactCheckArticle model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add model to schema**

Open `prisma/schema.prisma` and append after the last model:

```prisma
model FactCheckArticle {
  id          String   @id @default(cuid())
  title       String
  subject     String
  category    String
  tampered    String   @db.Text
  mistakes    Json
  spans       Json
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  approvedAt  DateTime?
}
```

`mistakes` shape: `[{ span: string, correct: string, explanation: string }]`
`spans` shape: `[{ text: string, isMistake: boolean }]` — pre-marked clickable spans for Easy/Medium difficulty. Only the `isMistake: true` entries map to entries in `mistakes` (same order).

- [ ] **Step 2: Push schema to Supabase**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(fact-checker): add FactCheckArticle schema"
```

---

### Task 2: Pure helpers library

**Files:**
- Create: `src/lib/factChecker.js`
- Create: `tests/factChecker.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/factChecker.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  normalizeSelection,
  scoreAccusation,
  SCORE_CONFIG,
} from '../src/lib/factChecker.js'

describe('normalizeSelection', () => {
  it('strips leading/trailing whitespace', () => {
    expect(normalizeSelection('  corporal  ')).toBe('corporal')
  })
  it('strips leading article "the"', () => {
    expect(normalizeSelection('the corporal')).toBe('corporal')
  })
  it('strips leading article "a"', () => {
    expect(normalizeSelection('a sergeant')).toBe('sergeant')
  })
  it('strips leading article "an"', () => {
    expect(normalizeSelection('an officer')).toBe('officer')
  })
  it('lowercases result', () => {
    expect(normalizeSelection('CORPORAL')).toBe('corporal')
  })
  it('handles multi-word span', () => {
    expect(normalizeSelection('  Iron Cross First Class  ')).toBe('iron cross first class')
  })
  it('does not strip "the" from middle of text', () => {
    expect(normalizeSelection('in the army')).toBe('in the army')
  })
})

describe('scoreAccusation', () => {
  const mistakes = [
    { span: 'corporal', correct: 'lance corporal', explanation: 'He held the rank of lance corporal.' },
    { span: 'april 20', correct: 'April 20 is correct', explanation: 'April 20 is actually correct.' },
  ]

  it('returns correct=true and score delta for matching span', () => {
    const result = scoreAccusation('corporal', mistakes, 'easy')
    expect(result.correct).toBe(true)
    expect(result.delta).toBe(SCORE_CONFIG.easy.correct)
    expect(result.explanation).toBe('He held the rank of lance corporal.')
  })

  it('returns correct=false and negative delta for wrong span', () => {
    const result = scoreAccusation('braunau', mistakes, 'easy')
    expect(result.correct).toBe(false)
    expect(result.delta).toBe(SCORE_CONFIG.easy.wrong)
  })

  it('normalizes the input before matching', () => {
    const result = scoreAccusation('the corporal', mistakes, 'medium')
    expect(result.correct).toBe(true)
  })

  it('uses correct score config per difficulty', () => {
    const easy = scoreAccusation('corporal', mistakes, 'easy')
    const hard = scoreAccusation('corporal', mistakes, 'hard')
    expect(hard.delta).toBeGreaterThan(easy.delta)
  })

  it('returns correct=false with wrong-penalty delta for no match', () => {
    const result = scoreAccusation('nonexistent', mistakes, 'medium')
    expect(result.correct).toBe(false)
    expect(result.delta).toBe(SCORE_CONFIG.medium.wrong)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd C:\Users\lasse\Desktop\find-hitler
npx vitest run tests/factChecker.test.js
```

Expected: `FAIL` — `Cannot find module '../src/lib/factChecker.js'`

- [ ] **Step 3: Create the helpers**

Create `src/lib/factChecker.js`:

```js
export const SCORE_CONFIG = {
  easy:     { correct: 100,  wrong: -30  },
  medium:   { correct: 100,  wrong: -50  },
  hard:     { correct: 150,  wrong: -75  },
  hardcore: { correct: 200,  wrong: -150 },
}

const STRIP_ARTICLES = /^(the|a|an)\s+/i

export function normalizeSelection(text) {
  return text.trim().replace(STRIP_ARTICLES, '').toLowerCase()
}

export function scoreAccusation(rawSelection, mistakes, difficulty) {
  const normalized = normalizeSelection(rawSelection)
  const match = mistakes.find(m => normalizeSelection(m.span) === normalized)
  const config = SCORE_CONFIG[difficulty] ?? SCORE_CONFIG.medium

  if (match) {
    return { correct: true, delta: config.correct, explanation: match.explanation, correct_value: match.correct }
  }
  return { correct: false, delta: config.wrong, explanation: null, correct_value: null }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/factChecker.test.js
```

Expected: `8 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/factChecker.js tests/factChecker.test.js
git commit -m "feat(fact-checker): add normalizeSelection + scoreAccusation helpers"
```

---

### Task 3: API — fetch article

**Files:**
- Create: `src/app/api/fact-checker/article/route.js`

- [ ] **Step 1: Create the route**

Create `src/app/api/fact-checker/article/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const difficulty = searchParams.get('difficulty') ?? 'medium'
  const category = searchParams.get('category') ?? null

  const where = { status: 'approved' }
  if (category) where.category = category

  const count = await db.factCheckArticle.count({ where })
  if (count === 0) {
    return NextResponse.json({ error: 'No approved articles' }, { status: 404 })
  }

  const skip = Math.floor(Math.random() * count)
  const article = await db.factCheckArticle.findFirst({ where, skip })

  // Strip answer key before sending to client
  // spans sent in full (client needs them for easy/medium pre-marking)
  // mistakes omitted — never expose to client
  return NextResponse.json({
    id: article.id,
    title: article.title,
    subject: article.subject,
    category: article.category,
    tampered: article.tampered,
    spans: article.spans,      // [{text, isMistake}] — isMistake stripped below
    mistakeCount: article.mistakes.length,
    difficulty,
  })
}
```

Note: `isMistake` is stripped from spans in the response. Update the return to strip it:

```js
  const safeSpans = article.spans.map(({ text }) => ({ text }))

  return NextResponse.json({
    id: article.id,
    title: article.title,
    subject: article.subject,
    category: article.category,
    tampered: article.tampered,
    spans: safeSpans,
    mistakeCount: article.mistakes.length,
    difficulty,
  })
```

Replace the earlier return with this version.

- [ ] **Step 2: Verify route exists (no automated test — requires DB)**

```bash
npx vitest run
```

Expected: existing test suite still passes (no regressions). Route will be tested manually once an article is seeded.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fact-checker/article/route.js
git commit -m "feat(fact-checker): GET /api/fact-checker/article — fetch random approved article"
```

---

### Task 4: API — validate accusation

**Files:**
- Create: `src/app/api/fact-checker/accuse/route.js`

- [ ] **Step 1: Create the route**

Create `src/app/api/fact-checker/accuse/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scoreAccusation } from '@/lib/factChecker'

export async function POST(request) {
  const { articleId, selection, difficulty, foundSoFar = [] } = await request.json()

  if (!articleId || !selection) {
    return NextResponse.json({ error: 'articleId and selection required' }, { status: 400 })
  }

  const article = await db.factCheckArticle.findUnique({ where: { id: articleId } })
  if (!article || article.status !== 'approved') {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const result = scoreAccusation(selection, article.mistakes, difficulty ?? 'medium')

  // Check if all mistakes now found
  const allFound = result.correct
    ? [...foundSoFar, selection].length >= article.mistakes.length
    : foundSoFar.length >= article.mistakes.length

  return NextResponse.json({
    correct: result.correct,
    delta: result.delta,
    explanation: result.explanation,
    correctValue: result.correct_value,
    allFound,
  })
}
```

- [ ] **Step 2: Run test suite for regressions**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fact-checker/accuse/route.js
git commit -m "feat(fact-checker): POST /api/fact-checker/accuse — validate accusation"
```

---

### Task 5: API — complete game

**Files:**
- Create: `src/app/api/fact-checker/complete/route.js`

- [ ] **Step 1: Create the route**

Create `src/app/api/fact-checker/complete/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(request) {
  const { articleId, score, correct, wrong, seconds } = await request.json()

  const session = await auth()

  if (session?.user?.id) {
    await db.match.create({
      data: {
        userId: session.user.id,
        target: articleId,
        mode: 'fact-checker',
        clicks: correct,        // repurpose clicks = correct finds
        seconds,
        score,
        path: [],
        won: wrong === 0,       // "perfect" = no wrong accusations
        eloChange: 0,
        eloBefore: 0,
        eloAfter: 0,
        totalPlayers: 1,
        opponentIds: [],
      },
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fact-checker/complete/route.js
git commit -m "feat(fact-checker): POST /api/fact-checker/complete — record game to Match"
```

---

### Task 6: Admin API — list + approve/reject

**Files:**
- Create: `src/app/api/admin/fact-checker/route.js`

- [ ] **Step 1: Create the route**

Create `src/app/api/admin/fact-checker/route.js`:

```js
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

async function requireAdmin(request) {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!session?.user?.email || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'

  const articles = await db.factCheckArticle.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ articles })
}

export async function PATCH(request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const { id, action } = await request.json()
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })
  }

  const data = action === 'approve'
    ? { status: 'approved', approvedAt: new Date() }
    : { status: 'rejected' }

  const updated = await db.factCheckArticle.update({ where: { id }, data })
  return NextResponse.json({ ok: true, article: updated })
}
```

- [ ] **Step 2: Add `ADMIN_EMAIL` to `.env.local`**

Open `.env.local` and add:
```
ADMIN_EMAIL=lasse.kusch@gmail.com
```

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/fact-checker/route.js .env.local
git commit -m "feat(fact-checker): admin API — list + approve/reject articles"
```

---

### Task 7: FactCheckerHUD component

**Files:**
- Create: `src/components/FactCheckerHUD.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/FactCheckerHUD.jsx`:

```jsx
'use client'

// Two-row HUD: row 1 = title/difficulty/found-count/score + latest chip
//              row 2 = scrollable chips bar of all accusations
export default function FactCheckerHUD({ subject, difficulty, found, total, score, accusations }) {
  const latest = accusations.at(-1) ?? null

  const chipColor = (acc) => {
    if (acc.correct === true)  return 'bg-green-100 text-green-800 border-green-300'
    if (acc.correct === false) return 'bg-red-100 text-red-400 border-red-300 border-dashed'
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  }

  const chipSymbol = (acc) => {
    if (acc.correct === true)  return '✓'
    if (acc.correct === false) return '✗'
    return '?'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 font-mono">
      {/* Row 1 — main HUD */}
      <div className="bg-[#1a1a2e] border-b border-[#334155] px-4 py-2 flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-[#94a3b8] tracking-[0.12em] uppercase">Fact Checker</span>
          <span className="text-[13px] font-bold text-[#e2e8f0]">{subject}</span>
        </div>
        <div className="flex items-center gap-4">
          {latest && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Latest</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] border ${chipColor(latest)}`}>
                "{latest.text}" {chipSymbol(latest)}
              </span>
            </div>
          )}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Found</span>
            <span className="text-[18px] font-bold text-[#f59e0b]">
              {found}<span className="text-[12px] text-[#475569]">/{total}</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] text-[#64748b] tracking-[0.08em] uppercase">Score</span>
            <span className={`text-[14px] font-bold ${score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {score >= 0 ? '+' : ''}{score}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 — chips bar */}
      <div className="bg-[#0f172a] border-b-2 border-[#2563eb] px-4 py-1.5 flex gap-2 items-center overflow-x-auto min-h-[30px]">
        <span className="text-[#475569] text-[10px] shrink-0">accusations →</span>
        {accusations.length === 0 && (
          <span className="text-[#334155] text-[10px]">click text to accuse</span>
        )}
        {accusations.map((acc, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-full text-[10px] border shrink-0 ${chipColor(acc)}`}
          >
            {chipSymbol(acc)} "{acc.text}"
          </span>
        ))}
      </div>
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
git add src/components/FactCheckerHUD.jsx
git commit -m "feat(fact-checker): FactCheckerHUD — two-row HUD with chips bar"
```

---

### Task 8: FactCheckerArticle component

**Files:**
- Create: `src/components/FactCheckerArticle.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/FactCheckerArticle.jsx`:

```jsx
'use client'
import { useRef } from 'react'

// Renders the tampered article.
// Easy/Medium: wraps pre-marked spans in clickable buttons.
// Hard/Hardcore: full free-text selection via mouseup event.
export default function FactCheckerArticle({ html, spans, difficulty, onAccuse, accused }) {
  const articleRef = useRef(null)

  const isHard = difficulty === 'hard' || difficulty === 'hardcore'

  // Free-text selection handler (hard/hardcore)
  function handleMouseUp() {
    if (!isHard) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (text.length < 2) return
    onAccuse(text)
    sel.removeAllRanges()
  }

  // For easy/medium, inject span buttons into the HTML
  // Replace each span text with a clickable button wrapper
  function buildSpanHtml() {
    if (!spans || spans.length === 0) return html
    let result = html
    // Wrap each span text in a button (first occurrence only, to avoid double-wrapping)
    for (const { text } of spans) {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, '')
      const isAccused = accused.some(a => a.text.toLowerCase() === text.toLowerCase())
      const accusedClass = isAccused ? 'fc-span-accused' : ''
      result = result.replace(
        regex,
        `<button class="fc-span ${accusedClass}" data-span="${text.replace(/"/g, '&quot;')}">$1</button>`
      )
    }
    return result
  }

  function handleClick(e) {
    if (isHard) return
    const btn = e.target.closest('.fc-span')
    if (!btn) return
    onAccuse(btn.dataset.span)
  }

  return (
    <>
      <style>{`
        .fc-span {
          background: transparent;
          border: none;
          padding: 1px 2px;
          border-radius: 2px;
          cursor: pointer;
          border-bottom: 1px dotted #94a3b8;
          font: inherit;
          color: inherit;
        }
        .fc-span:hover { background: #fef9c3; color: #1a1a1a; }
        .fc-span-accused { background: #fef08a; color: #1a1a1a; border-bottom: 2px solid #eab308; }
      `}</style>
      <div
        ref={articleRef}
        className="wiki-article px-4 py-4 font-serif text-[14px] leading-relaxed"
        style={{ fontFamily: 'Georgia, "Linux Libertine", serif', background: '#fff', color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: isHard ? html : buildSpanHtml() }}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      />
    </>
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
git add src/components/FactCheckerArticle.jsx
git commit -m "feat(fact-checker): FactCheckerArticle — inline accusation with pre-marked spans + free-text selection"
```

---

### Task 9: Game page

**Files:**
- Create: `src/app/play/fact-checker/page.jsx`

- [ ] **Step 1: Create the page**

Create `src/app/play/fact-checker/page.jsx`:

```jsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FactCheckerHUD from '@/components/FactCheckerHUD'
import FactCheckerArticle from '@/components/FactCheckerArticle'

export default function FactCheckerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') ?? 'medium'

  const [article, setArticle] = useState(null)
  const [accusations, setAccusations] = useState([])   // [{text, correct, delta}]
  const [score, setScore] = useState(0)
  const [found, setFound] = useState(0)
  const [done, setDone] = useState(false)
  const [revealMistakes, setRevealMistakes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    fetch(`/api/fact-checker/article?difficulty=${difficulty}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { router.push('/'); return }
        setArticle(data)
        setLoading(false)
      })
  }, [difficulty])

  async function handleAccuse(text) {
    if (done || !article) return
    // Avoid duplicate accusations of same text
    if (accusations.some(a => a.text.toLowerCase() === text.toLowerCase())) return

    const res = await fetch('/api/fact-checker/accuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        selection: text,
        difficulty,
        foundSoFar: accusations.filter(a => a.correct).map(a => a.text),
      }),
    })
    const data = await res.json()

    const newAcc = { text, correct: data.correct, delta: data.delta, explanation: data.explanation }
    setAccusations(prev => [...prev, newAcc])
    setScore(prev => prev + data.delta)
    if (data.correct) setFound(prev => prev + 1)

    if (data.allFound) {
      setDone(true)
      await completeGame(score + data.delta, found + 1)
    }
  }

  async function completeGame(finalScore, finalFound) {
    const seconds = Math.round((Date.now() - startTime) / 1000)
    await fetch('/api/fact-checker/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        score: finalScore,
        correct: finalFound,
        wrong: accusations.filter(a => a.correct === false).length,
        seconds,
      }),
    })
    // Fetch reveal data (full mistakes with explanations)
    const r = await fetch(`/api/fact-checker/article?id=${article.id}&reveal=true`)
    const d = await r.json()
    setRevealMistakes(d.mistakes ?? [])
  }

  async function handleGiveUp() {
    setDone(true)
    await completeGame(score, found)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-mono">
        <p className="text-[#94a3b8] text-sm">Loading article...</p>
      </div>
    )
  }

  if (revealMistakes !== null) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pt-20 px-6 font-mono max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">{article.subject} — Results</h2>
        <p className="text-[#64748b] mb-6">Score: <strong>{score}</strong> · Found {found}/{article.mistakeCount}</p>
        <h3 className="text-lg font-bold mb-3">The planted mistakes:</h3>
        <div className="flex flex-col gap-4">
          {revealMistakes.map((m, i) => (
            <div key={i} className="border border-[#e2e8f0] rounded p-4 bg-white">
              <p className="text-[13px] font-bold text-red-600 mb-1">"{m.span}" was wrong</p>
              <p className="text-[13px] text-[#1a1a1a] mb-1">Correct: <strong>{m.correct}</strong></p>
              <p className="text-[12px] text-[#64748b]">{m.explanation}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          className="mt-8 px-6 py-3 bg-[#2563eb] text-white font-bold rounded"
        >
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <FactCheckerHUD
        subject={article.subject}
        difficulty={difficulty}
        found={found}
        total={article.mistakeCount}
        score={score}
        accusations={accusations}
      />
      <div className="pt-24">
        <FactCheckerArticle
          html={article.tampered}
          spans={article.spans}
          difficulty={difficulty}
          onAccuse={handleAccuse}
          accused={accusations}
        />
      </div>
      {!done && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={handleGiveUp}
            className="px-4 py-2 bg-[#1a1a2e] text-[#94a3b8] text-sm font-mono rounded border border-[#334155]"
          >
            Give Up
          </button>
        </div>
      )}
    </div>
  )
}
```

Also update `GET /api/fact-checker/article` to handle the `?id=&reveal=true` case for post-game reveal. Add to `src/app/api/fact-checker/article/route.js` after the existing logic:

```js
// Add at top of GET handler, before existing logic:
const id = searchParams.get('id')
const reveal = searchParams.get('reveal') === 'true'

if (id && reveal) {
  const article = await db.factCheckArticle.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ mistakes: article.mistakes })
}
```

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/play/fact-checker/page.jsx src/app/api/fact-checker/article/route.js
git commit -m "feat(fact-checker): game page + reveal endpoint"
```

---

### Task 10: Admin review queue UI

**Files:**
- Create: `src/app/admin/fact-checker/page.jsx`

- [ ] **Step 1: Create the page**

Create `src/app/admin/fact-checker/page.jsx`:

```jsx
'use client'
import { useState, useEffect } from 'react'

export default function AdminFactChecker() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    fetch(`/api/admin/fact-checker?status=${tab}`)
      .then(r => r.json())
      .then(d => { setArticles(d.articles ?? []); setLoading(false) })
  }, [tab])

  async function act(id, action) {
    await fetch('/api/admin/fact-checker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e2e8f0] p-8 font-mono">
      <h1 className="text-2xl font-bold mb-6">Fact Checker — Admin Queue</h1>
      <div className="flex gap-4 mb-6">
        {['pending', 'approved', 'rejected'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setLoading(true) }}
            className={`px-4 py-2 rounded text-sm uppercase ${tab === t ? 'bg-[#2563eb] text-white' : 'bg-[#1e293b] text-[#94a3b8]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-[#64748b]">Loading...</p>}

      {!loading && articles.length === 0 && (
        <p className="text-[#64748b]">No {tab} articles.</p>
      )}

      <div className="flex flex-col gap-6">
        {articles.map(a => (
          <div key={a.id} className="border border-[#334155] rounded p-6 bg-[#1e293b]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{a.subject}</h2>
                <p className="text-[#64748b] text-sm">{a.category} · {new Date(a.createdAt).toLocaleDateString()}</p>
              </div>
              {tab === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => act(a.id, 'approve')} className="px-4 py-2 bg-green-700 text-white rounded text-sm">Approve</button>
                  <button onClick={() => act(a.id, 'reject')} className="px-4 py-2 bg-red-800 text-white rounded text-sm">Reject</button>
                </div>
              )}
            </div>

            <details className="mb-4">
              <summary className="cursor-pointer text-[#94a3b8] text-sm mb-2">Show tampered article</summary>
              <div className="bg-[#0f172a] p-4 rounded text-sm leading-relaxed max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: a.tampered }} />
            </details>

            <div>
              <p className="text-[#94a3b8] text-sm mb-2 uppercase tracking-wider">Planted mistakes:</p>
              {a.mistakes.map((m, i) => (
                <div key={i} className="mb-2 p-3 bg-[#0f172a] rounded">
                  <p className="text-red-400 text-sm">"{m.span}" → <span className="text-green-400">{m.correct}</span></p>
                  <p className="text-[#64748b] text-xs mt-1">{m.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
git add src/app/admin/fact-checker/page.jsx
git commit -m "feat(fact-checker): admin review queue UI"
```

---

### Task 11: Add to home screen mode selector

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Add fact-checker to MODES array**

In `src/app/page.jsx`, find the `MODES` array and add the new entry:

```js
{ value: 'fact-checker', label: 'Fact Checker', desc: 'A Wikipedia article has been tampered with. Find the planted inaccuracies using only your knowledge.', shortDesc: 'SPOT THE LIE' },
```

- [ ] **Step 2: Handle fact-checker in the start handler**

In `handleStart` (or wherever the mode routes to a game page), add:

```js
if (mode === 'fact-checker') {
  const params = new URLSearchParams({ difficulty: hardcore ? 'hard' : 'medium' })
  router.push(`/play/fact-checker?${params}`)
  return
}
```

Add this before the existing API fetch, since fact-checker doesn't use `/api/game/start`.

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat(fact-checker): add Fact Checker to home screen mode selector"
```

---

### Task 12: Seed first article (manual)

This task requires manual Claude API interaction to generate the first article.

- [ ] **Step 1: Create seed script**

Create `scripts/seed-fact-checker.mjs`:

```js
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// Paste Claude-generated article data here before running
const article = {
  title: 'Adolf Hitler',
  subject: 'Adolf Hitler',
  category: 'history',
  tampered: `<p>Adolf Hitler was born on <b>20 April 1879</b> in Braunau am Inn, Austria-Hungary...</p>
<p>He served as a <b>sergeant</b> in the Bavarian Army during World War I, receiving the <b>Iron Cross Second Class</b>...</p>
<p>On 30 April 1945, Hitler died by suicide in his underground bunker in <b>Munich</b>...</p>`,
  mistakes: [
    { span: '1879', correct: '1889', explanation: 'Hitler was born in 1889, not 1879.' },
    { span: 'sergeant', correct: 'corporal', explanation: 'Hitler held the rank of Gefreiter (lance corporal), not sergeant.' },
    { span: 'Munich', correct: 'Berlin', explanation: 'Hitler died in his bunker in Berlin, not Munich.' },
  ],
  spans: [
    { text: '20 April 1879' },
    { text: 'sergeant' },
    { text: 'Bavarian Army' },
    { text: 'Iron Cross Second Class' },
    { text: 'Munich' },
    { text: 'Braunau am Inn' },
    { text: 'World War I' },
    { text: '30 April 1945' },
  ],
  status: 'approved',
}

await db.factCheckArticle.create({ data: article })
console.log('Seeded article:', article.subject)
await db.$disconnect()
```

- [ ] **Step 2: Run the seed script**

```bash
node scripts/seed-fact-checker.mjs
```

Expected: `Seeded article: Adolf Hitler`

- [ ] **Step 3: Verify article appears in admin queue**

Start the dev server (`npm run dev`) and visit `http://localhost:3004/admin/fact-checker?status=approved`. The seeded article should appear.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-fact-checker.mjs
git commit -m "feat(fact-checker): seed script for first article"
```

---

### Task 13: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Play a game**

Navigate to `http://localhost:3004`, select Fact Checker mode, click Play.

Verify:
- Article loads with pre-marked spans (medium difficulty — some spans clickable)
- Clicking a wrong span → red dashed highlight, negative score flash, chip appears in bar
- Clicking the correct span → green highlight, positive score flash, found counter increments
- Finding all 3 → post-game reveal screen with explanations

- [ ] **Step 3: Test free-text (hard difficulty)**

Navigate to `http://localhost:3004/play/fact-checker?difficulty=hard`.

Verify:
- No pre-marked spans (plain article text)
- Selecting text with mouse/drag → accusation fires
- Selecting "the corporal" matches the "corporal" span (leniency normalization works)

- [ ] **Step 4: Commit smoke test confirmation**

```bash
git commit --allow-empty -m "chore: fact-checker smoke test passed"
```
