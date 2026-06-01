# In-Game Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brutalist cream/Anton game aesthetic with a Wikipedia-authentic article body + cockpit-style HUD so the game feels like you're literally navigating Wikipedia.

**Architecture:** Pure CSS changes to `globals.css` for typography/infobox/links; JSX-only refactor of `GameHUD.jsx` to a two-row layout (timer logic untouched); new static `WikiSidebar.jsx` component; layout wrapper update in `play/page.jsx`. Zero game logic changes.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, `ui-monospace` / Georgia serif — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-01-ingame-redesign.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/globals.css` | Modify | Typography reset, infobox responsive CSS, link hover, hatnote, background |
| `src/components/GameHUD.jsx` | Modify | Two-row cockpit HUD layout (timer logic unchanged) |
| `src/components/WikiArticle.jsx` | Modify | Remove `prose-headings:font-display prose-headings:uppercase` Tailwind modifiers |
| `src/app/play/page.jsx` | Modify | Layout wrapper, shimmer loading bar, inline bounce toast, sidebar integration |
| `src/components/WikiSidebar.jsx` | Create | Static Wikipedia left-nav, shown sm: and above |

---

## Task 1: CSS foundation — background, typography, links

**Files:**
- Modify: `src/app/globals.css`

This task strips the cream background and Anton heading font from the article body and installs Wikipedia-authentic typography and link hover. The `.wiki` scope means changes only affect the article — the home page and other screens are unaffected.

- [ ] **Step 1: Open `src/app/globals.css` and locate the `@layer base` block (lines 26–51)**

The block currently sets `background: var(--color-paper)` on `body` and `font-family: var(--font-display); text-transform: uppercase` on all `h1, h2, h3`. Both need to stay for non-article pages (home, results) but be overridden inside `.wiki`.

- [ ] **Step 2: Replace the `.wiki a` block and add the full article CSS section**

Find this block in `globals.css`:
```css
  /* the interactive targets in the race — Wikipedia links */
  .wiki a {
    color: var(--color-ink);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
  .wiki a:hover,
  .wiki a:focus-visible {
    color: var(--color-red);
    text-decoration-color: var(--color-red);
    background: #e5241e1a;
    outline: none;
  }
```

Replace it with this entire block:
```css
  /* ── Wikipedia article authenticity ─────────────────────── */

  /* White background for the article wrapper */
  .wiki {
    background: #ffffff;
  }

  /* Headings: Linux Libertine serif stack, normal weight, no uppercase */
  .wiki h1,
  .wiki h2,
  .wiki h3,
  .wiki h4 {
    font-family: 'Linux Libertine', 'Linux Libertine O', Georgia, 'Times New Roman', serif;
    font-weight: normal;
    text-transform: none;
    letter-spacing: normal;
    line-height: 1.3;
  }
  .wiki h1 { font-size: 1.95em; border-bottom: 1px solid #a2a9b1; padding-bottom: 3px; margin-bottom: 0.5em; }
  .wiki h2 { font-size: 1.5em; border-bottom: 1px solid #a2a9b1; padding-bottom: 3px; margin: 1em 0 0.4em; }
  .wiki h3 { font-size: 1.2em; margin: 0.8em 0 0.3em; }

  /* Links: Wikipedia blue + subtle red glow on hover */
  .wiki a {
    color: #3366cc;
    text-decoration: none;
    text-underline-offset: 2px;
  }
  .wiki a:hover,
  .wiki a:focus-visible {
    text-decoration: underline;
    text-shadow: 0 0 8px rgba(229, 36, 30, 0.35);
    outline: none;
  }

  /* Hatnotes (e.g. "Main article: X") */
  .wiki .hatnote,
  .wiki .dablink {
    font-style: italic;
    color: #54595d;
    border-left: 2px solid #a2a9b1;
    padding-left: 0.5em;
    margin-bottom: 0.5em;
    font-family: sans-serif;
    font-size: 0.875em;
    clear: right;
  }

  /* TOC box — don't let Tailwind prose flatten it */
  .wiki .toc,
  .wiki #toc {
    background: #f8f9fa;
    border: 1px solid #a2a9b1;
    padding: 0.5em 1em;
    display: inline-block;
    margin-bottom: 1em;
    font-family: sans-serif;
    font-size: 0.875em;
    clear: right;
  }
  .wiki .toc .toctitle,
  .wiki #toc .toctitle { font-weight: bold; margin-bottom: 0.3em; }
  .wiki .toc ol,
  .wiki #toc ol { margin-left: 1.2em; }
  .wiki .toc a,
  .wiki #toc a { color: #3366cc; text-decoration: none; }

  /* Infobox — mobile: compact horizontal strip */
  .wiki .infobox,
  .wiki .infobox-table,
  .wiki table.infobox {
    float: none !important;
    width: 100% !important;
    display: flex !important;
    margin: 0 0 10px 0 !important;
    clear: both;
    background: #f8f9fa;
    border: 1px solid #a2a9b1;
    font-family: sans-serif;
    font-size: 0.8em;
  }

  /* Desktop: restore standard Wikipedia float-right */
  @media (min-width: 480px) {
    .wiki .infobox,
    .wiki .infobox-table,
    .wiki table.infobox {
      float: right !important;
      width: 22em !important;
      display: table !important;
      margin: 0 0 1em 1em !important;
    }
  }
```

- [ ] **Step 3: Start the dev server and spot-check**

```bash
cd /c/Users/lasse/Desktop/find-hitler
npm run dev
```

Open a game (Classic, start from Brazil). Visually confirm:
- Article background is white (not cream)
- Page heading "Brazil" is serif, not Anton uppercase
- Links are blue (#3366cc)
- Hover a link — underline appears, no red background flash (faint red glow in text is fine)
- TOC box and hatnotes visible if the article contains them

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: Wikipedia-authentic article typography, links, infobox responsive CSS"
```

---

## Task 2: WikiArticle — remove display-font Tailwind overrides

**Files:**
- Modify: `src/components/WikiArticle.jsx`

The component applies Tailwind's `prose-headings:font-display prose-headings:uppercase` modifiers which force Anton + uppercase on headings inside the article. These override the `.wiki h1/h2/h3` CSS we just wrote. Remove them.

- [ ] **Step 1: Open `src/components/WikiArticle.jsx` and find line 41**

Current `className` on the article div:
```jsx
className="wiki prose prose-neutral max-w-none font-serif text-ink
           prose-headings:font-display prose-headings:uppercase prose-headings:text-ink
           prose-a:text-ink text-base sm:text-lg leading-relaxed"
```

- [ ] **Step 2: Remove the three `prose-headings:*` modifiers and `prose-a:text-ink`**

Replace with:
```jsx
className="wiki prose prose-neutral max-w-none font-serif text-ink
           prose-headings:text-ink
           text-base sm:text-lg leading-relaxed"
```

Keeping `prose prose-neutral` for body spacing. `prose-headings:text-ink` is kept so heading color is still dark (Tailwind prose defaults to near-black which is fine). `prose-a:text-ink` is removed because our `.wiki a { color: #3366cc }` CSS now handles links.

- [ ] **Step 3: Verify headings are now serif**

With `npm run dev` still running, navigate to any article. The `h1` should now be Linux Libertine / Georgia serif with normal weight. If it's still Anton, hard-refresh (Ctrl+Shift+R) to bust the Tailwind cache.

- [ ] **Step 4: Commit**

```bash
git add src/components/WikiArticle.jsx
git commit -m "style: remove Anton/uppercase overrides from WikiArticle prose classes"
```

---

## Task 3: WikiSidebar — new static component

**Files:**
- Create: `src/components/WikiSidebar.jsx`

Static Wikipedia-style left navigation. All links are `href="#"` no-ops. Shown only at `sm:` breakpoint and above. No props needed — content is fixed.

- [ ] **Step 1: Create `src/components/WikiSidebar.jsx`**

```jsx
// Static Wikipedia-style left nav. All links are no-ops during gameplay.
export default function WikiSidebar({ className = '' }) {
  return (
    <aside
      className={className}
      style={{
        width: 150,
        flexShrink: 0,
        borderRight: '1px solid #a2a9b1',
        background: '#fff',
        fontFamily: 'sans-serif',
        fontSize: 10,
        padding: '10px 8px',
        alignSelf: 'stretch',
      }}
    >
      <SidebarSection title="Navigation">
        <SidebarLink>Main page</SidebarLink>
        <SidebarLink>Random article</SidebarLink>
        <SidebarLink>Contents</SidebarLink>
        <SidebarLink>Current events</SidebarLink>
      </SidebarSection>

      <SidebarSection title="Contribute">
        <SidebarLink>Help</SidebarLink>
        <SidebarLink>Learn to edit</SidebarLink>
        <SidebarLink>About Wikipedia</SidebarLink>
        <SidebarLink>Community portal</SidebarLink>
      </SidebarSection>

      <SidebarSection title="Languages">
        <SidebarLink>Deutsch</SidebarLink>
        <SidebarLink>Français</SidebarLink>
        <SidebarLink>Español</SidebarLink>
        <SidebarLink>日本語</SidebarLink>
        <SidebarLink>中文</SidebarLink>
      </SidebarSection>
    </aside>
  )
}

function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: '#555',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        borderBottom: '1px solid #a2a9b1',
        paddingBottom: 3,
        marginBottom: 5,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SidebarLink({ children }) {
  return (
    <a
      href="#"
      onClick={e => e.preventDefault()}
      style={{
        display: 'block',
        color: '#3366cc',
        textDecoration: 'none',
        marginBottom: 3,
        fontSize: 10,
      }}
    >
      {children}
    </a>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WikiSidebar.jsx
git commit -m "feat: add static WikiSidebar component (desktop Wikipedia left nav)"
```

---

## Task 4: GameHUD — two-row cockpit layout

**Files:**
- Modify: `src/components/GameHUD.jsx`

Refactor the JSX to the two-row cockpit layout. The `useEffect` timer logic and all props stay identical — only the returned JSX changes.

- [ ] **Step 1: Open `src/components/GameHUD.jsx` and read the current structure**

Props: `startPage, target, mode, clicks, undoTokens, onUndo, timeLimitSeconds, jesusRound, onTimeUp`

The `useEffect` on lines 9–19 and the `elapsed/remaining/mins/secs/danger` derived values on lines 21–25 are untouched.

- [ ] **Step 2: Replace everything from the `return (` statement to the end of the file**

Keep lines 1–25 (imports + useEffect + derived values) exactly as-is. Replace only the `return` block:

```jsx
  const modeLabel = {
    classic: 'Classic',
    speedrun: 'Speedrun',
    golf: 'Golf',
    jesus: '5-Clicks-to-Jesus',
    daily: 'Daily',
    nohub: 'No-Hub',
  }[mode] ?? mode ?? 'Classic'

  return (
    <>
      {/* ── TOP HEADER: two-row cockpit HUD ── */}
      <header className="fixed inset-x-0 top-0 z-40 pt-safe" style={{ background: '#0e0e0e', borderBottom: '3px solid #e5241e' }}>

        {/* Row 1: mode · target badge · spacer · timer */}
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #181818' }}>
          <span style={{ color: '#444', fontSize: 8, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>
            {modeLabel}
          </span>

          <span style={{
            background: '#e5241e', color: '#fff',
            fontSize: 9.5, fontWeight: 700,
            padding: '2px 9px',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.04em',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {target}
          </span>

          <span className="flex-1" />

          {remaining !== null && (
            <span style={{
              color: danger ? '#ef4444' : '#fbbf24',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.04em',
              flexShrink: 0,
              animation: danger ? 'fh-shudder 0.3s ease-in-out infinite' : undefined,
            }}>
              {mins}:{secs}
            </span>
          )}

          {jesusRound != null && (
            <span style={{ color: '#f5f0e8', fontSize: 11, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
              R{jesusRound}<span style={{ color: '#444' }}>/5</span>
            </span>
          )}
        </div>

        {/* Row 2: clicks · undo dots · path breadcrumb */}
        <div className="flex items-center" style={{ fontFamily: 'ui-monospace, monospace' }}>
          <div className="flex flex-col items-center gap-0.5 px-3 py-1" style={{ borderRight: '1px solid #181818', flexShrink: 0 }}>
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Clicks</span>
            <span style={{ color: '#f5f0e8', fontSize: 11, fontWeight: 600 }}>{clicks}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 px-3 py-1" style={{ borderRight: '1px solid #181818', flexShrink: 0 }}>
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Undo</span>
            <span className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: i < undoTokens ? '#f5f0e8' : '#252525',
                  display: 'inline-block',
                }} />
              ))}
            </span>
          </div>

          {/* Path breadcrumb — desktop shows full, mobile truncates */}
          <div className="flex flex-col gap-0.5 px-3 py-1 min-w-0 flex-1">
            <span style={{ color: '#3a3a3a', fontSize: 6.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Path</span>
            <span className="truncate" style={{ color: '#3a3a3a', fontSize: 8 }}>
              {startPage}
              <span style={{ color: '#2a2a2a' }}> › </span>
              <span style={{ color: '#888' }}>…</span>
            </span>
          </div>
        </div>

        {/* Desktop ticker strip */}
        <div
          className="hidden sm:block"
          style={{
            background: '#111',
            borderTop: '1px solid #181818',
            padding: '2px 12px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 7.5,
            color: '#383838',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {modeLabel.toUpperCase()} · Start: {startPage} · Target: {target} · Click blue links to navigate
        </div>
      </header>

      {/* ── BOTTOM ACTION BAR ── */}
      <footer
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3 pb-safe"
        style={{ background: '#0e0e0e', borderTop: '3px solid #e5241e', minHeight: 48 }}
      >
        <button
          onClick={onUndo}
          disabled={undoTokens === 0}
          style={{
            background: undoTokens === 0 ? '#252525' : '#e5241e',
            color: undoTokens === 0 ? '#3a3a3a' : '#fff',
            border: 'none',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 8.5,
            fontWeight: 700,
            padding: '5px 14px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: undoTokens === 0 ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          ↶ Undo{undoTokens > 0 ? ` (${undoTokens})` : ''}
        </button>

        <span className="flex-1" />

        <span
          className="truncate text-right"
          style={{ color: '#2a2a2a', fontSize: 7.5, fontFamily: 'ui-monospace, monospace', maxWidth: '60%' }}
        >
          {startPage} › … › {target}
        </span>
      </footer>
    </>
  )
```

- [ ] **Step 3: Verify the HUD renders correctly**

With `npm run dev` running, start a Classic game. Confirm:
- Two-row header: row 1 has mode tag + red target badge + timer; row 2 has Clicks cell + Undo dots + Path
- Timer is yellow; goes red if you wait until ≤30s
- Undo button in footer is red when tokens available, dark when spent
- On desktop (>640px) the dim ticker strip appears below row 2

- [ ] **Step 4: Commit**

```bash
git add src/components/GameHUD.jsx
git commit -m "feat: refactor GameHUD to two-row cockpit layout"
```

---

## Task 5: play/page.jsx — layout wrapper, shimmer bar, inline bounce toast

**Files:**
- Modify: `src/app/play/page.jsx`

Three small changes: (1) shimmer loading bar replaces single-pixel red bar, (2) bounce toast moves from fixed overlay to inline, (3) layout wrapper updated for white background + sidebar slot + correct top/bottom padding.

- [ ] **Step 1: Replace the loading bar JSX**

Find:
```jsx
{isLoading && <div className="fixed inset-x-0 top-0 z-50 h-1 bg-red" />}
```

Replace with:
```jsx
{isLoading && (
  <div
    className="fixed inset-x-0 top-0 z-50"
    style={{
      height: 3,
      background: 'linear-gradient(90deg, #e5241e 0%, #fbbf24 50%, #e5241e 100%)',
      backgroundSize: '200%',
      animation: 'shimmer 1s linear infinite',
    }}
  />
)}
```

The `shimmer` keyframe already exists in `globals.css` (line 92).

- [ ] **Step 2: Move the bounce toast from fixed overlay to inline**

Find:
```jsx
{bounceMessage && (
  <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 border-[3px] border-red bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-wide text-paper">
    ⛔ {bounceMessage}
  </div>
)}
```

Delete it. We'll re-add it inline in the next step.

- [ ] **Step 3: Replace the `<main>` wrapper and add sidebar + inline bounce toast**

Find:
```jsx
      <main className="mx-auto max-w-3xl px-5 pt-24 pb-24 sm:pt-20">
        <WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!win} />
      </main>
```

Replace with:
```jsx
      <div className="flex" style={{ paddingTop: 52, paddingBottom: 52, minHeight: '100vh', background: '#fff' }}>
        <WikiSidebar className="hidden sm:block" />
        <main className="flex-1 min-w-0 px-4 py-3" style={{ maxWidth: 780 }}>
          {bounceMessage && (
            <div
              className="mb-3 font-mono uppercase tracking-wide text-center"
              style={{
                border: '2px solid #e5241e',
                background: '#0e0e0e',
                color: '#f5f0e8',
                padding: '6px 16px',
                fontSize: 9,
              }}
            >
              ⛔ {bounceMessage}
            </div>
          )}
          <WikiArticle html={html} onNavigate={handleNavigate} disabled={isLoading || !!win} />
        </main>
      </div>
```

- [ ] **Step 4: Add the WikiSidebar import at the top of the file**

Find:
```jsx
import { RedButton } from '@/components/ui/primitives'
```

Add below it:
```jsx
import WikiSidebar from '@/components/WikiSidebar'
```

- [ ] **Step 5: Verify full layout**

With `npm run dev`, start a game. Confirm:
- Background is white throughout
- No gap or overlap between HUD and article (top padding ~52px)
- No gap or overlap between article and action bar (bottom padding ~52px)
- On desktop: Wikipedia sidebar visible on left, article to the right
- On mobile (resize browser to 375px): sidebar hidden, full-width article
- Trigger a hub page bounce — toast appears between HUD and article text, doesn't cover links
- Navigate to a new page — shimmer bar animates at top

- [ ] **Step 6: Commit**

```bash
git add src/app/play/page.jsx
git commit -m "feat: update play page layout — white bg, sidebar slot, shimmer bar, inline bounce toast"
```

---

## Task 6: Infobox class verification (inspect real Wikipedia HTML)

**Files:**
- Possibly modify: `src/app/globals.css`

The CSS in Task 1 targets `.infobox`, `.infobox-table`, `table.infobox`. Real Wikipedia HTML uses `class="infobox biography vcard"` etc. — confirm the selectors match the actual markup coming from the Wikipedia API.

- [ ] **Step 1: Inspect a real article's infobox class**

In the running game, open DevTools (F12), navigate to the Adolf Hitler article, and run:

```js
document.querySelector('.wiki table[class*="infobox"]')?.className
```

Expected output something like: `"infobox biography vcard"`

- [ ] **Step 2: Confirm the CSS selector hits it**

Run in DevTools console:
```js
document.querySelectorAll('.wiki .infobox, .wiki .infobox-table, .wiki table.infobox').length
```

Expected: `> 0` (at least one infobox found).

If it returns `0`, the class name differs. Check what class the table actually has and update `globals.css` to match. For example, if the class is `"infobox biography vcard"`, the selector `.wiki .infobox` already matches (it matches any element with `infobox` in the class list). But if Wikipedia uses a different root class entirely, add it.

- [ ] **Step 3: Verify mobile infobox layout**

Resize browser to 375px. The infobox should become a horizontal strip: square photo on the left (~70px), facts stacked to the right. Full text column below it.

If the infobox is still floating right on mobile, add a more specific override to `globals.css`:

```css
@media (max-width: 479px) {
  .wiki table[class*="infobox"] {
    float: none !important;
    width: 100% !important;
    display: flex !important;
    margin: 0 0 10px 0 !important;
  }
  .wiki table[class*="infobox"] td:first-child img {
    width: 70px !important;
    height: 70px !important;
    object-fit: cover;
  }
}
```

- [ ] **Step 4: Commit if `globals.css` changed**

```bash
git add src/app/globals.css
git commit -m "fix: adjust infobox CSS selectors to match real Wikipedia markup"
```

If no changes were needed, skip the commit.

---

## Task 7: End-to-end verification checklist

No code changes — this task is a structured manual walk-through of the spec's verification section.

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

Open http://localhost:3000 and start a Classic game (codename "Tester", target "Adolf Hitler", start from Brazil — or use any target that has an infobox).

- [ ] **Step 2: Article typography**

- [ ] h1 heading is serif (Linux Libertine / Georgia), NOT Anton uppercase
- [ ] h2 section headings are serif, NOT Anton uppercase
- [ ] Background is pure white (#fff), NOT warm cream (#f5f0e8)
- [ ] Body text is Georgia serif (unchanged)

- [ ] **Step 3: Wikipedia furniture**

- [ ] Infobox is visible on the page
- [ ] TOC box is visible (for articles with ≥4 sections)
- [ ] Hatnotes ("Main article: X") appear in italic with left border

- [ ] **Step 4: Links**

- [ ] Links are Wikipedia blue (#3366cc), NOT dark ink
- [ ] Hover a link — underline appears + faint red glow; NO red background flash

- [ ] **Step 5: HUD**

- [ ] Two-row header: row 1 shows mode tag + red target badge + yellow timer; row 2 shows Clicks + Undo dots + Path
- [ ] Undo dots: filled circles for available, hollow for spent
- [ ] Timer turns red when ≤30s remain (test with Speedrun mode)
- [ ] Desktop (>640px): dim ticker strip visible below row 2

- [ ] **Step 6: Desktop sidebar**

- [ ] Sidebar visible at desktop width with Navigation / Contribute / Languages sections
- [ ] Sidebar hidden at 375px mobile width

- [ ] **Step 7: Mobile infobox**

- [ ] At 375px: infobox is a horizontal strip (photo left, facts right), NOT floated right
- [ ] Full text column below infobox

- [ ] **Step 8: Loading and toasts**

- [ ] Clicking a link shows shimmer bar at top (red→yellow→red gradient, animating)
- [ ] Clicking a hub page shows the bounce toast inline between HUD and article (not a floating overlay covering links)

- [ ] **Step 9: Final commit if any fixes applied**

```bash
git add -p   # stage only the relevant hunks
git commit -m "fix: verification pass tweaks"
```

---

## Out of Scope (do not touch)

- `src/app/play/multi/page.jsx` — multiplayer page (apply after solo validated)
- `src/app/play/ranked/page.jsx` — ranked page (apply after solo validated)
- `src/components/win/WinReveal.jsx`, `WinScreen.jsx`, `ResultsScreen.jsx` — win/results screens
- `src/app/page.jsx` — home page
- Any file under `src/app/api/` or `src/lib/` — zero game logic changes
