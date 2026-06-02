# Six Clicks — Growth & Retention Design
**Date:** 2026-06-02  
**Status:** Approved for implementation  
**Scope:** Two parallel workstreams — Fact Checker mode (content/growth) + Retention system (streaks, badges, ranked ladder, friend duels)

---

## Context

The game is feature-complete through Phase 5 (accounts, ELO, ranked duels). Core growth levers are missing: no daily reason to return, no social sharing hooks, no nerd-tier content challenge. This spec adds both.

Primary goal: grow daily active players. Secondary goal: lay groundwork for future monetization (achievement cosmetics, ladder prestige).

---

## Workstream A — Fact Checker Mode

### What it is

A new game mode where players read a real Wikipedia article that has been subtly tampered with by Claude. 3 facts have been changed. Players identify and accuse them in real time as they read. No side-by-side comparison — players must rely on their own knowledge.

### Article pool

- Curated pool of ~20 launch articles, expanding over time
- Articles chosen for nerd appeal: historical figures, wars, disasters, science, pop culture
- Each article stored in DB with: canonical text, tampered text, answer key (mistake spans + explanations)
- New articles go through a review queue before going live (admin-only page at `/admin/fact-checker`)
- Claude generates the tampered version + answer key; human approves before publish

### Mistake quality rules (encoded in Claude prompt)

**Allowed mistake types:**
- Date/year shift (off by a decade, or wrong century — plausible, not absurd)
- Rank/title swap (corporal → sergeant, chancellor → president — same domain, wrong specific)
- Place swap — a nearby or associated place (born in Linz vs Braunau am Inn)
- Subtle factual inversion (Iron Cross First Class → Second Class; won → lost a specific battle)
- Invented plausible detail (fake award, fake quote that sounds period-accurate)

**Forbidden mistake types:**
- Gender flips (he → she) — spotted by pattern recognition, not knowledge
- Absurd number changes (6M → 600M) — no knowledge needed
- Obvious party/ideology swaps (Nazi → Communist)
- Grammar/spelling errors — not fact-checking

**The quality rule:** "A curious generalist who has read about this topic should be genuinely unsure whether this is wrong." If a random person on the street spots it instantly, it's too easy. If only a PhD historian catches it, it's too hard.

### Difficulty system

| Difficulty | Selection mechanic | Pre-marked spans | Scoring |
|---|---|---|---|
| Easy | Click pre-marked spans only | ~15 spans | +100 correct / −30 wrong |
| Medium | Click pre-marked spans only | ~8 spans | +100 correct / −50 wrong |
| Hard | Free-text selection | None | +150 correct / −75 wrong |
| Hardcore | Free-text selection | None | +200 correct / −150 wrong |

Pre-marked spans are the factual claims Claude identified as accusable (dates, names, places, ranks, numbers). Difficulty controls how many are shown — Easy gives ~15 options to pick 3 from, Medium gives ~8, Hard/Hardcore require the player to select any text freely.

**Free-text leniency:** when a player selects text, normalize before matching: strip leading/trailing whitespace, strip leading articles ("the", "a", "an"), lowercase. `"the corporal"` → matches answer key span `"corporal"`.

### Game loop

1. Player selects Fact Checker from home screen, picks difficulty
2. Random article from pool loads (full width, Wikipedia-authentic rendering)
3. HUD shows: article title + difficulty + `0/3 found` counter + running score
4. Chips bar below HUD shows all accusations so far (scrolls horizontally)
5. HUD top-right shows the latest accusation chip inline
6. Player clicks/selects text → immediate feedback:
   - Correct: green highlight + `+N` score flash + found counter increments
   - Wrong: red dashed underline + `−N` score penalty
   - Uncertain (pre-marked span that isn't tampered): yellow highlight, resolved post-game
7. Game ends when all 3 mistakes found, or player taps "Give Up"
8. Post-game screen: reveals all 3 mistakes with correct facts + explanations, final score, share card

### New DB table

```prisma
model FactCheckArticle {
  id           String   @id @default(cuid())
  title        String
  subject      String   // e.g. "Adolf Hitler", "Chernobyl disaster"
  category     String   // "history" | "science" | "pop_culture" | "religion" | "disaster"
  canonical    String   @db.Text   // clean Wikipedia text
  tampered     String   @db.Text   // Claude-modified text
  mistakes     Json     // [{span: string, correct: string, explanation: string}]
  spans        Json     // [{text: string, isMistake: boolean}] — pre-marked spans for easy/medium
  difficulty   String   @default("medium")
  status       String   @default("pending")  // "pending" | "approved" | "rejected"
  createdAt    DateTime @default(now())
  approvedAt   DateTime?
}
```

### Admin review queue

`/admin/fact-checker` (auth-gated, admin email only):
- Lists pending articles with subject + category + date
- Click to open: shows tampered article with mistakes highlighted, answer key, explanation
- Approve / Reject / Edit buttons
- Only approved articles appear in the game pool

### New API routes

- `GET /api/fact-checker/article` — returns random approved article (strips answer key from response)
- `POST /api/fact-checker/accuse` — validates an accusation, returns correct/wrong + updated score
- `POST /api/fact-checker/complete` — records completed game, saves to Match table with `mode: "fact-checker"`

### Files to create/modify

- `src/app/play/fact-checker/page.jsx` — new game page
- `src/components/FactCheckerHUD.jsx` — two-row HUD + chips bar
- `src/components/FactCheckerArticle.jsx` — article renderer with accusation mechanic (wraps WikiArticle.jsx patterns)
- `src/app/api/fact-checker/[article|accuse|complete]/route.js` — 3 new API routes
- `src/app/admin/fact-checker/page.jsx` — admin review queue (auth guard: check `session.user.email === process.env.ADMIN_EMAIL`, redirect to `/` otherwise)
- `src/app/page.jsx` — add Fact Checker to mode selector
- `prisma/schema.prisma` — add FactCheckArticle model

---

## Workstream B — Retention System

### B1 — Ranked ladder (LoL-style divisions)

Replace the current 4-tier flat system (`elo.js` RANKS) with 6 tiers × 5 divisions + Challenger.

**Tier/division structure:**

| Tier | Divisions | ELO range |
|---|---|---|
| Bronze | 5 → 1 | 0 – 999 (200 ELO per division) |
| Silver | 5 → 1 | 1000 – 1999 |
| Gold | 5 → 1 | 2000 – 2999 |
| Platinum | 5 → 1 | 3000 – 3999 |
| Diamond | 5 → 1 | 4000 – 4999 |
| Challenger | (none) | Top 50 players by ELO |

Division within tier: `Math.floor((elo % 1000) / 200)` → 0=div5, 4=div1. Display as "Gold 3", "Silver 1", etc.

Challenger is recomputed dynamically (not ELO-threshold-based) — top 50 by ELO get the Challenger badge regardless of raw ELO. `getTopChallengers(prisma)` is called in `/api/match/record` after each ranked match update, and cached for 5 minutes to avoid per-request DB hits. The ranked page and public profile page both display the Challenger badge if the user is in the current top 50.

**Schema changes:**
- `User.rank` (String) stays — change values from `"BRONZE"` to `"BRONZE_3"` format
- `User.division` (Int) — new field, 1–5 within tier (1 = highest)
- `Match.rank` (Int) — already exists, repurpose as ELO snapshot instead of position

**Files to modify:**
- `src/lib/elo.js` — rewrite RANKS, add `getRankLabel(elo)` returning `"Gold 3"`, add `getTopChallengers(prisma)` query
- `src/components/RankBadge.jsx` — update to show tier icon + division number
- `prisma/schema.prisma` — add `division Int @default(5)` to User

### B2 — Daily streak + personal bests

**Streak:** A streak increments when the player completes at least one game per calendar day (UTC). Stored on `User`.

Schema additions to User:
```
streak        Int      @default(0)
longestStreak Int      @default(0)
lastPlayedAt  DateTime?
```

On every game completion (`/api/match/record`): compare `lastPlayedAt` date to today. Same day = no change. Yesterday = increment streak. Older = reset to 1.

**Personal bests:** Stored per mode as a JSON field on User, or as a separate `PersonalBest` table. Simpler: JSON field `User.bests` — `{ classic: {clicks, seconds, score}, speedrun: {seconds}, golf: {clicks}, ... }`.

Display on home screen: small stat card under the mode selector showing your best for the selected mode. Update logic: only overwrite a personal best if the new value is strictly better (lower clicks for Classic/Golf, lower seconds for Speedrun, higher score for Fact Checker).

### B3 — Achievement badges

20 launch badges. Stored as `String[]` on User (`badges String[] @default([])`). Awarded server-side in `/api/match/record` after each game.

| Badge | Trigger |
|---|---|
| `first_blood` | First win ever |
| `three_clicks` | Win Classic in ≤3 clicks |
| `speed_demon` | Finish Speedrun in <60s |
| `hole_in_one` | 5 Clicks to Jesus: Hole-in-One grade |
| `no_undo` | Win Classic with 0 undos used |
| `daily_7` | 7-day streak |
| `daily_30` | 30-day streak |
| `ranked_win` | First ranked duel win |
| `gold_rank` | Reach Gold division |
| `challenger` | Enter Challenger (top 50) |
| `fact_ace` | Finish Fact Checker with 0 wrong accusations |
| `hardcore_clear` | Win any mode with Hardcore modifier |
| `century` | Play 100 total games |
| `nerd` | Win using only 1 undo total across 10 games |
| `globetrotter` | Win with 5 different targets |
| `veteran` | Play 365 total games |
| `speed_run_1` | Finish Speedrun in <30s |
| `no_hub_clear` | Win No-Hub mode |
| `golf_eagle` | Golf mode: Eagle grade or better |
| `fact_historian` | Complete 10 Fact Checker games |

Badges are shown on `/profile` and `/profile/[userId]` as icon grid. Locked badges shown as greyed-out silhouettes.

### B4 — Friend duel challenges

Async duel: Player A sets a seed (start page + target + mode), plays it, gets a score. The result generates a challenge link `/challenge/[token]`. Player B opens the link, plays the exact same seed, results compared side by side.

**No account required for Player B** — they can play as a guest. If they sign in, the result is recorded to their match history.

**Schema:**
```prisma
model Challenge {
  id         String   @id @default(cuid())
  creatorId  String?  // nullable — guest challenges have no creator
  target     String
  mode       String
  startPage  String
  creatorScore Int
  creatorPath  String[]
  creatorClicks Int
  creatorSeconds Int
  challengeToken String @unique @default(cuid())
  responses  ChallengeResponse[]
  createdAt  DateTime @default(now())
  expiresAt  DateTime // 7 days
}

model ChallengeResponse {
  id          String   @id @default(cuid())
  challengeId String
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  responderId String?  // nullable — guest
  responderName String
  score       Int
  path        String[]
  clicks      Int
  seconds     Int
  won         Boolean  // beat the creator's score?
  playedAt    DateTime @default(now())
}
```

**API routes:**
- `POST /api/challenge/create` — saves challenge, returns token
- `GET /api/challenge/[token]` — returns challenge data (seed, creator score) for the respondent
- `POST /api/challenge/respond` — saves response, returns comparison

**Share flow:** After any solo/ranked game, results screen shows "Challenge a friend →" button. Generates challenge token from that game's seed, copies link to clipboard.

**Results comparison:** `/challenge/[token]/result` — side-by-side: creator path vs respondent path, winner highlighted.

### B5 — Global vs friends leaderboard

Two tabs on `/leaderboard`: **Global** (top 50 by score, existing) + **Friends** (people you've dueled via challenge links).

Friends list is implicit — no explicit "add friend" flow. Anyone who has responded to one of your challenges (or whose challenge you responded to) appears in your Friends tab.

---

## Verification

1. **Fact Checker:** Start a game at `/play/fact-checker`, accuse a correct span → green + score increments. Accuse a wrong span → red dashed + score decrements. Find all 3 → post-game reveal screen.
2. **Admin queue:** Sign in as admin email, visit `/admin/fact-checker`, approve a pending article — it appears in the pool.
3. **Rank ladder:** Win a ranked duel, check `/profile` — rank shows tier + division (e.g. "Bronze 4"). Win enough to cross a division threshold → division updates.
4. **Streak:** Play a game on day 1, come back day 2 and play — streak shows 2. Skip day 3 — streak resets to 1 on day 4.
5. **Badges:** Win Classic in ≤3 clicks → `three_clicks` badge appears on profile.
6. **Friend duel:** Complete a solo game, click "Challenge a friend", send link to another browser tab — same start page loads. Finish → `/challenge/[token]/result` shows side-by-side.
7. **Friends leaderboard:** After completing a challenge, open `/leaderboard` → Friends tab shows the respondent.
