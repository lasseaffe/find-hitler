# Game Loop Polish — Design Spec
**Date:** 2026-06-01  
**Status:** Approved for implementation

---

## Context

The core game loop works but feels unfinished. The HUD is hard to read, there's no social layer during multiplayer races, damage in HP duels has no visual feedback, the mode selector treats all modes equally despite Classic being the main event, and there's no match history on profiles. This spec covers the full polish pass to make the game feel complete and alive.

---

## 1. HUD Redesign

**File:** `src/components/GameHUD.jsx`

Replace the current two-thin-row layout with a three-zone cockpit:

```
┌─────────────────────────────────────────────────────────┐
│  CLICKS │      TARGET: ADOLF HITLER          │ TIME  UNDO │
│    38px │   Navigate Wikipedia to find him   │ 28px  ●●●  │
│  label  │                                    │       16px │
│  11px   │                                    │  path below│
└─────────────────────────────────────────────────────────┘
│ Golf mode · fewest clicks wins                           │
└─────────────────────────────────────────────────────────┘
```

**Sizing (locked from mockup iterations):**
- Clicks number: **38px**, label: **11px**, left column pad: **28px**
- Centre: "TARGET" label **9px**, name badge **24px** on red bg, hint text **13px**
- Right column: timer **28px** yellow + undo label **10px** + dots **16px** side-by-side, path **8px** below
- Overall row height: **80px min**, mode strip below: **7px**

**Timer behaviour (no change from current logic):**
- Countdown (yellow) when `timeLimitSeconds` set; elapsed (gray) otherwise
- `danger` state (red + shudder) at ≤30s remaining
- Double-frequency shake animation at ≤10s (new `@keyframes fh-shudder-fast` — same ±2px but 0.15s duration)

**Padding fix:** `paddingTop` on the play page wrapper already updated to 88px — verify it still clears the taller HUD (may need 96px).

---

## 2. Mode Card Hierarchy

**File:** `src/app/page.jsx`

Replace the flat 6-cell mode grid with a **hero + secondary row** layout:

- **Hero card** (full width, red border, ~90px tall): HitlerMark SVG (56px) + "Classic · Find Hitler" title (22px) + description "Navigate Wikipedia from a random page to Adolf Hitler. Fewest clicks wins." (11px) + "★ Main mode" badge. Clicking selects Classic mode (existing behaviour).
- **"Variants" label** (8px mono, dimmed) above a 5-column compact grid: Speedrun, Golf, 5-Clicks, Daily, No-Hub — each showing name (9px) + one-line description (7px). Same selection behaviour as today.
- Hardcore toggle and bot slider remain below, unchanged.

---

## 3. Lobby Chat + Event Feed

**New file:** `src/components/LobbyChat.jsx`  
**Socket events to add in** `src/lib/socketHandlers.js`

### Component layout
Fixed panel, shown in the race sidebar alongside LiveFeed (desktop) or as a drawer toggle on mobile:

```
┌─ CHAT ──────────── 3 players ─┐
│ 💀 🔥 😭 👏 ⚡ 🤡              │  ← emote bar
├───────────────────────────────┤
│ [system] Race started         │
│ Alice: gl hf everyone         │
│ 🔥  Alice                     │  ← emote broadcast
│ [system] Bob → World War II   │
│ [system] Alice found Hitler!  │
│           4 clicks · 22s 🏆   │
│ Bob: gg no way                │
│ [system] Carol last undo used │
├───────────────────────────────┤
│ [input field]     [SEND]      │
└───────────────────────────────┘
```

### Message types
| Type | Style | Example |
|------|-------|---------|
| `system` | italic, `#555`, actor in `#888`, win in `#e5241e` | "Alice found Hitler — 4cl · 22s 🏆" |
| `chat` | name in `#fbbf24`, text in `#888` | "Alice: gl hf" |
| `emote` | 16px emoji + 8px sender name | 🔥 Alice |

### Auto-generated system events (server → all via socket)
- Race started
- Player X reached [hub page] *(red text for hub pages)*
- **Player X found Hitler — N clicks · Ns 🏆** 
- Player X used their last undo
- Player X has been eliminated *(HP duels only)*
- Player X disconnected

### Socket events
- **Client emits** `chat:message` `{ roomCode, text }` (max 120 chars, stripped of HTML)  
- **Client emits** `chat:emote` `{ roomCode, emote }` (one of the 6 allowed emojis)  
- **Server broadcasts** `chat:message` and `chat:emote` to room  
- **Server broadcasts** `chat:event` for all system events (already knows these moments — hook into existing finish/undo/disconnect paths in `socketHandlers.js`)

### Placement
- Desktop: replaces or sits below LiveFeed in the right rail (`lg:` breakpoint). LiveFeed player list moves into a compact strip at top of the chat panel.
- Mobile: floating toggle button (bottom-right, above the bottom HUD bar) opens a drawer.

---

## 4. Damage Effects — Chromatic Aberration + Red Wash

**New file:** `src/components/DamageOverlay.jsx`  
**Used in:** `src/app/play/ranked/page.jsx`, `src/app/play/multi/page.jsx`

### On HP damage (ranked duel `duel:round-end`)
Fixed overlay div covering the full viewport, pointer-events none, z-index 39 (HUD is z-40 — overlay sits below it so the HUD stays readable during the flash):

```
Layer stack (bottom → top):
  wiki content
  DamageOverlay (z-39, pointer-events:none)
  GameHUD / HpDuelHUD (z-40)
```

**Animation sequence (total ~600ms):**
1. **Red wash** — `rgba(200,0,0,0.35)` floods the screen, fades out over 600ms
2. **Chromatic R bleed** — `rgba(255,0,0,0.12)` div offset `+3px X`, fades 500ms  
3. **Chromatic B bleed** — `rgba(0,0,255,0.08)` div offset `-3px X`, fades 500ms  
4. **Screenshake** — `@keyframes fh-chroma-shake` on the wiki content wrapper (not the whole page, so HUD stays steady):
   ```css
   @keyframes fh-chroma-shake {
     0%   { transform: translate(0,0); }
     15%  { transform: translate(-6px,-3px) rotate(-0.3deg); }
     30%  { transform: translate(6px,3px) rotate(0.3deg); }
     50%  { transform: translate(-3px,2px); }
     70%  { transform: translate(3px,-1px); }
     100% { transform: translate(0,0); }
   }
   /* duration: 0.5s */
   ```

**HP threshold escalation:**
- > 50% HP: normal intensity (values above)
- 25–50% HP: red wash opacity → 0.5, shake amplitude → 8px
- < 25% HP: red wash → 0.65, shake → 12px, blur filter added (`filter: blur(1px)` at peak)

### On clock stress (applies to all timed modes, existing `danger` state)
- ≤30s: timer already turns red + `fh-shudder` — no change
- ≤10s: add `fh-shudder-fast` (0.15s interval instead of 0.3s) + a subtle screen pulse every 2s (`rgba(229,36,30,0.06)` wash)

### Component API
```jsx
<DamageOverlay trigger={damageEvent} hp={currentHp} maxHp={5000} />
// damageEvent: { damage, timestamp } — new object reference triggers effect
// hp: used to scale intensity
```

Internally uses a `useEffect` on `trigger` identity change to fire the animation, then auto-clears after 700ms.

---

## 5. Match History on Profile

**File:** `src/app/profile/page.jsx`  
**Data source:** `/api/profile` route (currently returns match history array)

### Row layout
Each match history entry renders as a compact row:

```
Jun 1 2026 | Classic | Adolf Hitler | 4 clicks · 22s | A › B › C › Hitler | #1 of 3
                                                                          [Alice] [Bob]
```

**Fields per row:**
- Date (locale short format)
- Mode badge (colored tag: Classic=red, Speedrun=yellow, Golf=green, etc.)
- Target name
- Clicks + time
- Path: compact node chain `A › B › C › Hitler` (truncated to 4 nodes + ellipsis if longer, full path on hover/expand)
- Rank: `#1 of N players` for multiplayer; omitted for solo
- **Other players**: small clickable name chips → navigate to `/profile/[userId]` for each player in the lobby
- **Ranked only**: LP delta badge (`+18 LP` green / `-12 LP` red) + ELO snapshot (`1420 → 1438`)

### Sort & filter
- Default: newest first
- Filter tabs: All | Ranked | Classic | Other
- Show 20 per page, load-more button

### Data requirements
`/api/profile` needs to return per-match: `{ date, mode, target, clicks, time, path, rank, totalPlayers, opponents: [{ userId, name }], eloChange?, eloBefore?, eloAfter? }`. The ranked fields already exist in the DB schema — opponents array requires a join that may not exist yet; add it to the match record query.

---

## 6. Wikipedia Page Title

**File:** `src/app/play/page.jsx` and `src/app/play/multi/page.jsx`

The current page title is passed as `startPage` to GameHUD but only shown truncated in the path breadcrumb. Show it prominently above the article:

Add a `<div>` just above `<WikiArticle>` inside the play page main column:
```jsx
<div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.12em', paddingBottom: 4, borderBottom: '1px solid #e8e4dc', marginBottom: 8 }}>
  {currentPageTitle}
</div>
```

Track `currentPageTitle` as state, updated on each navigation response alongside `html`.

---

## Implementation Order

1. **HUD redesign** — standalone, no dependencies
2. **Mode card hierarchy** — standalone, home page only
3. **Wikipedia page title strip** — tiny, play pages only
4. **DamageOverlay component** — new file + wire into ranked + add CSS keyframes
5. **Match history** — profile page + API query update
6. **LobbyChat** — largest piece: new component + socket events + server-side hooks

---

## Verification

- HUD: start a Classic solo game, confirm all three zones render at correct sizes, timer counts up, undo dots decrease on use
- Mode cards: home page shows hero card selected by default, clicking a variant selects it and deselects hero
- Page title: navigate to a new Wikipedia page, confirm title strip updates
- Damage overlay: in ranked mode, lose a round — red wash + chromatic aberration + shake should fire; replay at <25% HP to confirm escalation
- Chat: start a multiplayer lobby, send a message and emote from two browser tabs, confirm both appear in the feed; finish a race and confirm the system event fires
- Match history: play 3 games in different modes, open profile, confirm all rows appear with correct fields; for a ranked match confirm LP delta shows
