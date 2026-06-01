# In-Game Page Redesign — Design Spec

**Date:** 2026-06-01
**Status:** Approved by user

---

## Context

The Find Hitler in-game page (solo and multiplayer) uses a custom brutalist aesthetic that diverges significantly from real Wikipedia. The HUD uses Anton (all-caps display font), the background is warm cream (#f5f0e8), headings are uppercase, infoboxes and TOC boxes are absent, and links turn red on hover. The result feels like a news-template game rather than "you are literally navigating Wikipedia."

The goal of this redesign is to make the article body indistinguishable from real Wikipedia while giving the game chrome (HUD + action bar) a cockpit/instrument-panel aesthetic that sits clearly above the article without polluting it.

---

## Design Direction: B — Retro Frame

Wikipedia-authentic article body + two-row cockpit HUD above + thin action bar below. The article and the game UI are visually distinct systems — ink-on-black HUD, white Wikipedia article.

---

## 1. HUD — Two-Row Cockpit

**Structure:**

```
┌─────────────────────────────────────────────────────────┐
│ CLASSIC   [Adolf Hitler]                         3:42   │  ← row 1 (top)
├──────────────────────────────────────────────────────────│
│ CLICKS  5  │  UNDO  ●●○  │  PATH  Brazil › … › Germany │  ← row 2 (bottom)
└──────────────────────────────────────────────────────────┘
            3px solid #e5241e border-bottom
```

**Row 1 — Target + Timer:**
- Left: mode tag in dim monospace (e.g. `CLASSIC`, `SPEEDRUN`, `GOLF`)
- Center-left: target name in a red pill badge (`background: #e5241e; color: #fff; padding: 2px 9px`)
- Right: countdown timer in yellow (`#fbbf24`), bold, 14px. Pulses/turns red at ≤30s.

**Row 2 — Stats:**
- `CLICKS` stat cell (label + value)
- `UNDO` stat cell (label + three dots: filled `●` = available, hollow `○` = spent)
- `PATH` breadcrumb — scrolls/truncates, showing `Start › … › Current`

**Shared HUD styling:**
- Background: `#0e0e0e`
- Bottom border: `3px solid #e5241e`
- Row divider: `1px solid #181818`
- Cell dividers: `1px solid #181818`
- Font: `ui-monospace, 'Courier New', monospace`
- Labels: 6.5–7px, `#3a3a3a`, uppercase, letter-spacing
- Values: 11–14px, `#f5f0e8`

**Desktop additions:**
- Row 1 gains a `MODE` cell on the far left and a full `PATH` cell in the middle showing the complete breadcrumb with the current page highlighted in `#f5f0e8`
- A dim ticker strip below row 2: `background:#111; color:#383838; font-size:7.5px` showing mode, start, target, and rule reminders

**Component:** `GameHUD.jsx` — refactor to this two-row structure. The timer `useEffect` logic stays untouched; only the JSX layout changes.

---

## 2. Article Body — Wikipedia Authentic

The `WikiArticle.jsx` component renders raw Wikipedia HTML from the API. The redesign is entirely CSS — no component logic changes needed.

### Typography

| Element | Current | New |
|---|---|---|
| `h1` | Anton, uppercase, 1.6rem | `'Linux Libertine', Georgia, 'Times New Roman', serif` — normal weight, ~1.6em |
| `h2`, `h3` | Anton, uppercase | `'Linux Libertine', Georgia, serif` — normal weight |
| Body | Georgia serif | Georgia serif (unchanged) |
| Background | `#f5f0e8` (cream) | `#ffffff` |

Remove `text-transform: uppercase` and `font-family: var(--font-display)` from `h1, h2, h3` inside `.wiki`. Add the Linux Libertine stack scoped to `.wiki h1, .wiki h2, .wiki h3`.

### Link hover

```css
.wiki a {
  color: #3366cc;                /* Wikipedia blue — replaces current ink color */
  text-decoration: none;
}
.wiki a:hover,
.wiki a:focus-visible {
  text-decoration: underline;
  text-shadow: 0 0 8px rgba(229, 36, 30, 0.35);  /* subtle red glow */
  outline: none;
}
```

This replaces the current `color: var(--color-red); background: #e5241e1a` hover which is too prominent.

### Infobox — responsive switch

Wikipedia's markup includes `.infobox` / `.infobox-table` classes on the right-floated biographical table. Add CSS to `globals.css`:

```css
/* Mobile: compact strip — image left, facts right */
.wiki .infobox,
.wiki .infobox-table {
  float: none !important;
  width: 100% !important;
  display: flex;
  margin: 0 0 10px 0;
  clear: both;
}
.wiki .infobox .ib-img-cell,
.wiki .infobox td:first-child img { /* the photo cell */
  width: 70px;
  height: 70px;
  object-fit: cover;
  flex-shrink: 0;
}

/* Desktop: standard Wikipedia float-right */
@media (min-width: 480px) {
  .wiki .infobox,
  .wiki .infobox-table {
    float: right !important;
    width: 22em !important;     /* Wikipedia default */
    display: table !important;
    margin: 0 0 1em 1em !important;
  }
}
```

> **Implementation note:** Wikipedia infobox HTML uses `<table class="infobox ...">`. The selector must target the actual class names coming from the Wikipedia API — inspect a live article to confirm. The responsive switch logic above is the right approach; class names may need adjustment.

### TOC box

Wikipedia articles include `<div id="toc">` or `<div class="toc">` in the raw HTML. These render automatically once the cream background and serif headings are fixed. No additional markup needed — just ensure `.wiki .toc` is not reset by Tailwind's prose styles.

Remove any Tailwind `prose` class overrides that flatten TOC styling.

### Hatnotes & categories

These are already present in raw Wikipedia HTML (`.hatnote`, `.catlinks`). Ensure they are not hidden by any global CSS reset. Add:

```css
.wiki .hatnote {
  font-style: italic;
  color: #54595d;
  border-left: 2px solid #a2a9b1;
  padding-left: 0.5em;
  margin-bottom: 0.5em;
  font-family: sans-serif;
  font-size: 0.875em;
  clear: right; /* don't overlap infobox */
}
```

---

## 3. Action Bar (bottom)

Replaces the current footer which is `bg-paper` (cream). New:

```
┌──────────────────────────────────────────────────────┐
│  [↶ UNDO (2)]          Brazil › Food › Adolf Hitler  │
└──────────────────────────────────────────────────────┘
       3px solid #e5241e border-top
```

- Background: `#0e0e0e`
- Top border: `3px solid #e5241e`
- Undo button: `background:#e5241e; color:#fff; font-family:monospace; padding:5px 14px; uppercase`
- Disabled state: `background:#252525; color:#3a3a3a`
- Path: right-aligned, `#2a2a2a`, 7.5px monospace, truncates with ellipsis

---

## 4. Desktop Sidebar

On `sm:` breakpoint and above, render a 150px left sidebar styled as Wikipedia's standard left navigation:

```
Navigation
  Main page
  Random article
  Contents
Contribute
  Help
  About Wikipedia
Languages
  Deutsch  Français  Español
```

- All links are `href="#"` no-ops during gameplay (clicking them should not navigate)
- Font: sans-serif, 10px, `#3366cc` links
- Section headers: 9px, bold, `#555`, uppercase, with `border-bottom: 1px solid #a2a9b1`
- Width: 150px, `border-right: 1px solid #a2a9b1`, white background
- Hidden on mobile (`display:none` below `sm:`)

This is a static render — no Wikipedia API calls needed.

---

## 5. Loading State

Replace the current single-pixel red top bar with a shimmer bar:

```css
background: linear-gradient(90deg, #e5241e 0%, #fbbf24 50%, #e5241e 100%);
background-size: 200%;
animation: shimmer 1s linear infinite;
height: 3px;
```

This replaces `className="fixed inset-x-0 top-0 z-50 h-1 bg-red"` in `play/page.jsx`. The shimmer bar stays in `play/page.jsx` (not moved into `GameHUD`), positioned as the very first child of the page wrapper so it sits above the fixed HUD.

---

## 6. Hub Bounce Toast

Current: fixed overlay (`fixed left-1/2 top-24 z-50`) that can cover links.

New: inline banner between HUD and article:

```jsx
{bounceMessage && (
  <div className="mx-3 mb-2 border-2 border-red bg-ink px-4 py-2 font-mono text-[9px] uppercase tracking-wide text-paper text-center">
    ⛔ {bounceMessage}
  </div>
)}
```

Positioned in the document flow, not fixed — so it pushes article content down rather than covering links.

---

## 7. Page-level layout (`play/page.jsx`)

Current `<main>` padding accounts for fixed HUD (top) and fixed footer (bottom):
```jsx
<main className="mx-auto max-w-3xl px-5 pt-24 pb-24 sm:pt-20">
```

After redesign:
- HUD height increases from ~44px to ~52px (two rows) — adjust `pt-` accordingly
- Action bar height stays ~52px — `pb-` stays similar
- On desktop, add sidebar: wrap `<main>` and sidebar in a flex container

```jsx
<div className="flex min-h-screen flex-col bg-white">
  <GameHUD ... />
  <div className="flex flex-1 pt-[52px] pb-[52px]"> {/* HUD + bar height */}
    <WikiSidebar className="hidden sm:block" />  {/* new static component */}
    <main className="flex-1 min-w-0 px-4 py-3 max-w-3xl">
      <WikiArticle ... />
    </main>
  </div>
  {/* action bar is fixed bottom, rendered inside GameHUD */}
</div>
```

---

## 8. Files to Change

| File | Change |
|---|---|
| `src/app/globals.css` | Remove cream bg + display-font h1–h3 defaults; add `.wiki` infobox responsive CSS, hatnote styles, link hover with red glow; update background to `#fff` |
| `src/components/GameHUD.jsx` | Rewrite JSX to two-row cockpit layout; timer logic unchanged |
| `src/components/WikiArticle.jsx` | Remove `prose-headings:font-display prose-headings:uppercase` Tailwind classes; add `bg-white` if needed |
| `src/app/play/page.jsx` | Update layout wrapper; swap loading bar to shimmer; move bounce toast to inline |
| `src/components/WikiSidebar.jsx` | **New file** — static Wikipedia left nav, shown `sm:` and above |

---

## 9. Out of Scope

- Multiplayer (`play/multi/page.jsx`) and ranked (`play/ranked/page.jsx`) pages — same HUD + article system, apply after solo is validated
- Win/results screens — not touched
- Home page — not touched
- Any game logic, API routes, scoring — zero changes

---

## 10. Verification

1. Run `npm run dev`, start a Classic game from Brazil
2. Confirm article heading is serif, not Anton uppercase
3. Confirm background is white, not cream
4. Confirm infobox appears on the page (float right on desktop, strip on mobile)
5. Confirm TOC box renders without being reset
6. Confirm links are blue; hover shows underline + faint red glow (no red background flash)
7. Confirm HUD is two rows with cockpit cell layout
8. Confirm Wikipedia left sidebar appears on desktop, hidden on mobile
9. Narrow browser to 375px — confirm infobox becomes a horizontal strip, full text column
10. Trigger a hub page — confirm bounce toast is inline (below HUD), not a floating overlay
11. Navigate to a new page — confirm shimmer loading bar at top
