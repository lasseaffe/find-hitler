# Six Degrees Pipeline — Deferred Integration Steps

**Status:** Phase 1 code is complete on branch `feat/six-degrees-impl` (developed in worktree `C:\Users\lasse\Desktop\fh-six-degrees`). All library code, scripts, schema model, and unit tests are done and green (166 passed / 1 pre-existing unrelated `wikipedia.test.js` infobox failure).

Three external-effect steps were **intentionally deferred** because a concurrent fact-checker session was simultaneously modifying `prisma/schema.prisma` (it changed `FactCheckArticle`: added `difficulty`, `decoys`, `sourceTitle`, `sourceUrl`; removed `spans`). Running `prisma db push` / `prisma generate` from this branch's (older) `FactCheckArticle` definition would have clobbered that work on the shared live Render Postgres. So the schema model was added and validated, but **not pushed**, and the live crawl was **not run**.

Run the steps below **on `master`, after both this branch and the fact-checker branch are merged**, so the schema is reconciled first.

## Prerequisite — reconcile the schema

After merging, confirm `prisma/schema.prisma` on `master` contains **both**:
- the `PageDistance` model (this branch), and
- the updated `FactCheckArticle` (fact-checker branch: `difficulty`, `decoys`, `sourceTitle`, `sourceUrl`; no `spans`).

A clean three-way merge should keep both since the changes are in different models. Verify by eye before pushing — `prisma db push` is declarative and will try to make the DB match the file exactly.

## Steps (run on master, with `.env.local` present)

1. **Generate the client** (additive — adds `prisma.pageDistance`, keeps all existing models):
   ```
   npx prisma generate
   ```

2. **Push the schema to the DB.** First inspect what it intends to do:
   ```
   npx prisma db push
   ```
   The printed plan must only **ADD** the `PageDistance` table (and reconcile `FactCheckArticle` to the merged shape). If it proposes to **drop** `FactCheckArticle` columns or the table, STOP — the schema was not reconciled; fix `schema.prisma` and retry. Never pass `--accept-data-loss` blindly here.

3. **Sanity check the client has the model:**
   ```
   node -e "const {PrismaClient}=require('@prisma/client'); console.log(typeof new PrismaClient().pageDistance.findMany)"
   ```
   Expected: `function`.

4. **Run the baseline crawl** (polite, resumable, long-running — start small if you like, e.g. `--sample 50`, before a full run):
   ```
   npm run six:baseline -- --sample 1000 --cap 8 --backward-depth 3 --concurrency 4
   ```
   This precomputes Hitler's reverse body-link layers once, draws ~1000 random article-namespace pages (skipping any already measured), measures each via meet-in-the-middle BFS, upserts `PageDistance` rows, and writes the report.

5. **Read the report:** `docs/six-degrees/baseline-<date>.md` (and `.json`). The headline is "**X% of pages reach the target in ≤ 6 clicks**", with the median/mean/max and the list of ≥7-click / capped "violators" — the hard-mode seeds.

## Notes
- The body-link cache lives at `.cache/six-degrees/bodylinks.ndjson` (gitignored, fully regenerable). It amortizes across runs — re-running is cheaper.
- The crawl makes live Wikipedia API calls; politeness is built in (descriptive User-Agent, bounded concurrency, resilient `defaultFetchHtml` that returns `null` instead of throwing on transient errors).
- A bigger sample (e.g. `--sample 5000`) gives a more credible distribution for the "is six clicks real?" claim, at the cost of a longer crawl.
- This is Phase 1 only. Phases 2–4 (game-start tracking queue, user path submissions + records, in-app insights page + hard-mode tiering) and Phase N (full body-graph census) are in the design spec at `docs/superpowers/specs/2026-06-02-six-degrees-pipeline-design.md`.
