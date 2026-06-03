# Start Page Redesign — Six Clicks

**Date:** 2026-06-03
**Branch:** feat/six-degrees-phase1
**Scope:** Full redesign (UI + all backend wiring in one PR)

---

## 1. Page Structure

Overall layout — Structure B (sticky configurator):

1. **Masthead** — SIX CLICKS brand mark (HitlerMark SVG ~56px) + title + nav links
2. **Sticky summary bar** — `YOUR RACE → [TARGET] · [MODE] · [DIFFICULTY]` + Start button always in view
3. **Solo / Multiplayer tab**
4. **Codename input**
5. **Target section** — category carousels
6. **Mode section** — Find Target hero card + variants carousel
7. **Difficulty section** — 4-stage grid
8. **Multiplayer section** — friends list + invites + bots (shown only when Multiplayer tab active)
9. **Full-width Start CTA** at bottom

File: `src/app/page.jsx` (full rewrite).

**Renamed:** app title `FIND HITLER` → `SIX CLICKS` throughout (masthead, page `<title>`, manifest, any h1).

---

## 2. Target Carousels

### Categories

| Label | Targets |
|---|---|
| POLITICAL FIGURES | Hitler (preselected, shows HitlerMark icon), Stalin, Mao, Churchill, Napoleon, Trump |
| RELIGION | Jesus, Muhammad, Pope Francis, Buddha |
| POP CULTURE | Taylor Swift, Minecraft, 9/11 attacks, Black hole |
| CONTROVERSIAL | Holocaust, Osama bin Laden, Jeffrey Epstein |
| CUSTOM | `+ OWN TARGET` card |

- Hitler card: renders `<HitlerMark size={36} />` above the name label. `currentColor` fill so it inverts on selection (white-on-black when selected).
- Cards: `min-width: 110px`, padding `14px 12px`, `font-size: 16px` for name, `10px` for category label.
- Each category row is a horizontal scroll carousel with a `CAT-LABEL` above it.

### Locking rules
- `daily` and `jesus` modes → target carousel grayed out (`opacity-40 pointer-events-none`) + `TARGET SET BY MODE` label in red mono.

### Custom target
- `+ OWN TARGET` card opens an inline `<input>` below its carousel row.
- Debounced 400ms — calls `GET /api/wikipedia/validate?title=X`.
- Three states: `CHECKING…`, `✓ VALID — [canonicalTitle]` (enables Start), `✗ NOT FOUND` (disables Start).
- The **canonical title** returned by the API (not raw user input) is sent to `game/start`.

### New API endpoint: `GET /api/wikipedia/validate`
```
Query: ?title=string
Response 200: { valid: true,  canonicalTitle: string, extract: string }
Response 200: { valid: false }
```
Implementation: `https://en.wikipedia.org/api/rest_v1/page/summary/{encodeURIComponent(title)}` — if HTTP 200 → valid, else invalid. Return `canonicalTitle` from `titles.normalized` or `title` field.

---

## 3. Mode Section

### Find Target hero card
- Full-width, selected by default.
- Left: `<HitlerMark size={52} />` (fill inverts on selection).
- Name: `FIND TARGET` (replaces "Classic · Find Hitler").
- Desc: `Navigate from a random Wikipedia page to your chosen target. Fewest clicks wins.`
- Badge: `★ MAIN MODE`.

### Variants carousel
Horizontal scroll, `min-width: 130px` per card, larger text than today (`font-size: 18px` name, `11px` subdesc).

| value | Label | Short desc | Description |
|---|---|---|---|
| `speedrun` | SPEEDRUN | FASTEST TIME | Curated start, race the clock |
| `golf` | GOLF | 5-MIN CAP | Lowest clicks inside 5 minutes |
| `jesus` | 5-CLICKS | TO JESUS | 5 rounds, target locked to Jesus, par = 5 |
| `daily` | DAILY | ONE SHOT | Same seed for everyone, one attempt |
| `nohub` | NO-HUB | HUB PENALTY | Hub pages cost an undo |
| `fact-checker` | FACT CHECK | SPOT THE LIE | Find planted inaccuracies in a tampered article |

### Fact Checker behaviour
- Difficulty selector hidden when `fact-checker` active.
- Start page sends player to `/play/fact-checker?difficulty=medium` (normal) or `?difficulty=hard` (brutal equivalent) via URL param — same path as today. The new `difficulty` field is NOT sent for fact-checker; the existing `?difficulty=` URL param is the only control.

---

## 4. Difficulty Stages

Replaces the binary `hardcore` boolean toggle.

| Stage | BFS hops | Undos | Time cap | Hub penalty |
|---|---|---|---|---|
| `easy` | ~2 | 5 | none | no |
| `normal` | 3–4 | 3 | none | no |
| `hard` | 5–6 | 1 | 5 min | no |
| `brutal` | 6+ | 0 | 5 min | yes |

### UI
- 4-card grid, full section width.
- Each card shows: stage name (Impact 17px), hop range (mono 10px), undo count + timer (mono 10px).
- `normal` selected by default.

### Backend changes — `src/app/api/game/start/route.js`
- New field accepted: `difficulty: 'easy' | 'normal' | 'hard' | 'brutal'` (replaces `hardcore`).
- `hardcore` field retired (old clients sending it are ignored).
- Difficulty → game params mapping:

```js
const DIFF = {
  easy:   { undoTokens: 5, timeLimitSeconds: null, hubPenalty: false, minHops: 1, maxHops: 2 },
  normal: { undoTokens: 3, timeLimitSeconds: null, hubPenalty: false, minHops: 3, maxHops: 4 },
  hard:   { undoTokens: 1, timeLimitSeconds: 300,  hubPenalty: false, minHops: 5, maxHops: 6 },
  brutal: { undoTokens: 0, timeLimitSeconds: 300,  hubPenalty: true,  minHops: 6, maxHops: 99 },
}
```

### New helper: `findStartPageAtDistance(target, minHops, maxHops)` in `src/lib/wikipedia.js`
- Samples random Wikipedia pages via existing `getRandomWikiPage()`.
- BFS-checks distance using existing `bfsDistance` engine.
- Returns first page whose distance falls in `[minHops, maxHops]`.
- Hard timeout: if no match found within **3 seconds**, falls back to `getRandomWikiPage()` (same as today's classic mode).
- `easy` / `normal` use this helper. `hard` / `brutal` too — brutal additionally sets `hubPenalty: true` in game state.

### `hubPenalty` in game state
- `src/lib/gameState.js`: add `hubPenalty` boolean field to game object.
- `src/app/api/game/move/route.js`: if `hubPenalty` is true and the clicked page is in `hubBlocklist`, deduct one undo token (same logic as no-hub mode today — extract into shared `applyHubPenalty(game, page)` helper).
- **`nohub` mode + difficulty:** when mode=`nohub` the difficulty selector is hidden on the start page. Hub penalty is always active for nohub regardless of difficulty; the chosen difficulty still controls undos/timer. The `hubPenalty` flag is set to `true` for both `brutal` difficulty AND `nohub` mode.

---

## 5. Multiplayer & Friends System

### 5a. Prisma schema additions

```prisma
model Friendship {
  id          String   @id @default(cuid())
  requesterId String
  addresseeId String
  status      String   @default("PENDING")   // PENDING | ACCEPTED | DECLINED
  createdAt   DateTime @default(now())
  requester   User     @relation("FriendRequests", fields: [requesterId], references: [id])
  addressee   User     @relation("FriendAddressees", fields: [addresseeId], references: [id])
  @@unique([requesterId, addresseeId])
}

model FriendCode {
  id        String   @id @default(cuid())
  userId    String   @unique
  code      String   @unique
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

model LobbyInvite {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  lobbyCode  String
  status     String   @default("PENDING")   // PENDING | ACCEPTED | DECLINED | EXPIRED
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  from       User     @relation("InvitesSent",     fields: [fromUserId], references: [id])
  to         User     @relation("InvitesReceived", fields: [toUserId],   references: [id])
}
```

Add corresponding `User` relation fields for all three models.

### 5b. Friend code generation
- Auto-generated on first NextAuth login via a `signIn` event callback in `src/auth.js`.
- 6-character alphanumeric, uppercase, unique — retry on collision.
- `GET /api/friends/code` — returns the current user's `FriendCode.code`.
- `GET /api/friends/add/[code]` — looks up `FriendCode` by code, creates a `Friendship` row (`status: PENDING`), redirects to `/profile`.

### 5c. Friend request API routes
```
GET  /api/friends              → list accepted friends (id, name, elo, rank, online)
GET  /api/friends/requests     → list pending incoming requests
POST /api/friends/accept       body: { friendshipId }
POST /api/friends/decline      body: { friendshipId }
GET  /api/friends/recent       → recent opponents from Match.opponentIds + ChallengeResponse (max 10, deduped, excludes existing friends)
```

### 5d. Online presence
- `src/lib/socketHandlers.js`: maintain a `Map<userId, Set<socketId>>` (`onlineUsers`).
- On `connect` with authenticated session: add to map. On `disconnect`: remove. Expose `isOnline(userId)` helper.
- `/api/friends` endpoint calls `isOnline(friend.id)` for each friend.

### 5e. Lobby invite flow
**Sending (start page — Multiplayer section):**
- Friends list shows each accepted friend: avatar, name, ELO, green/gray online dot, `INVITE` button.
- `INVITE` button: calls `POST /api/lobby/invite` with `{ toUserId, lobbyCode }`.
  - Creates `LobbyInvite` row (`expiresAt = now + 10 min`).
  - If friend is online: emits `lobby:invite` socket event to their socket(s).
- Invite link row always shown: `sixclicks.gg/join/[code]` + copy button.
- Bots slider: unchanged (0–3).

**New route: `POST /api/lobby/invite`**
```
Body: { toUserId: string, lobbyCode: string }
Auth: required
Response: { ok: true }
```
Socket emit: route accesses the Socket.IO server via `globalThis._io` (same pattern used by `server.js`). After DB write, emits `lobby:invite` to all sockets in `onlineUsers.get(toUserId)`.

**Receiving — `<InviteToast />` global component:**
- Mounted in `src/app/layout.jsx`.
- Subscribes to socket event `lobby:invite` → shows dismissible overlay: `[Name] invited you · [TARGET] · [MODE]` + `JOIN` and `DISMISS` buttons.
- `JOIN` → `router.push('/join/[lobbyCode]')`.
- On app load (if logged in): `GET /api/lobby/invites/pending` → stacked toasts for any `PENDING` invites not yet expired.

**New route: `GET /api/lobby/invites/pending`**
```
Auth: required
Response: { invites: [{ id, fromUser: { name }, lobbyCode, createdAt }] }
```

**Socket event `lobby:invite` payload:**
```js
{ fromName: string, lobbyCode: string, target: string, mode: string }
```
Emitted by `POST /api/lobby/invite` route after DB write, using `onlineUsers` map.

### 5f. Add-friend page `/friends/add/[code]`
- Logged-in: shows "Add [Name] as friend?" confirm button → creates Friendship row.
- Not logged-in: redirects to `/login?callbackUrl=/friends/add/[code]`.

---

## 6. Misc UI details

- **Text sizes:** all mono labels `11px` (up from `10px`), section headings `font-display` at least `16px`, mode/target card names `16–26px`, CTA button `26px`.
- **Codename field** moved above Target (same position as today — stays section 4).
- **Summary bar** updates reactively on every state change (target, mode, difficulty).
- **Mobile:** summary bar sticks to top. Carousels scroll horizontally. Multiplayer section full-width stack.
- **`src/app/manifest.js`**: update `name` and `short_name` to `Six Clicks`.

---

## 7. Files changed / created

### Modified
- `src/app/page.jsx` — full rewrite
- `src/app/layout.jsx` — mount `<InviteToast />`
- `src/app/manifest.js` — rename to Six Clicks
- `src/app/api/game/start/route.js` — accept `difficulty`, retire `hardcore`, call `findStartPageAtDistance`
- `src/app/api/game/move/route.js` — extract `applyHubPenalty`, apply if `hubPenalty` flag set
- `src/lib/wikipedia.js` — add `findStartPageAtDistance(target, minHops, maxHops)` and `validateWikiTitle(title) → { valid, canonicalTitle, extract }`
- `src/lib/gameState.js` — add `hubPenalty` field
- `src/auth.js` — auto-generate `FriendCode` on first sign-in
- `prisma/schema.prisma` — add `Friendship`, `FriendCode`, `LobbyInvite` models + User relations
- `src/lib/socketHandlers.js` — add `onlineUsers` Map, `isOnline()` helper

### Created
- `src/app/api/wikipedia/validate/route.js`
- `src/app/api/friends/route.js`
- `src/app/api/friends/requests/route.js`
- `src/app/api/friends/accept/route.js`
- `src/app/api/friends/decline/route.js`
- `src/app/api/friends/recent/route.js`
- `src/app/api/friends/code/route.js`
- `src/app/api/friends/add/[code]/route.js`
- `src/app/api/lobby/invite/route.js`
- `src/app/api/lobby/invites/pending/route.js`
- `src/app/friends/add/[code]/page.jsx`
- `src/components/InviteToast.jsx`

### DB migration
- `prisma migrate dev --name start-page-redesign`