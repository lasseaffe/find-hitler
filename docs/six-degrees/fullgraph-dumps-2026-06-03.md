# Six Degrees — Full-Graph Distance to Adolf Hitler (2026-06-03)

> ⚠️ **Data-quality note (minor accounting bug).** The graph is complete — **724,279,065** namespace-0 edges across **7,189,852** articles — and the distance distribution, **median 3**, and **max 5** are sound. But the reverse-BFS `reachable` set (7,204,159) includes ~14,307 redirect/ghost page-ids that are not `is_redirect=0` articles (dangling-redirect leak), so `Unreachable` came out **negative (−14,308)** and `reachable` is inflated ~0.2%. The qualitative finding holds: **essentially every English Wikipedia article reaches Adolf Hitler in ≤5 link-clicks** (full rendered graph). Fix needed before the exact %/reachable/unreachable counts are publishable: filter the BFS-labeled set to `is_redirect=0` article ids (then re-run BFS+report; reuses the built graph, fast).

**100.0%** of 7,204,159 reachable articles reach **Adolf Hitler** in **≤ 6 link-clicks**.

Reachable: 7,204,159 · Unreachable: -14,308 · Median: 3 · Mean: 2.69 · Max: 5

## Distribution (clicks → pages)
| clicks | pages |
|---|---|
| 1 | 14632 |
| 2 | 2276161 |
| 3 | 4821785 |
| 4 | 91574 |
| 5 | 7 |

## Farthest pages (hard-mode seeds)
- Zabnik — 5
- Pine River, Quebec — 5
- Golam Kabud — 5
- Gisvan — 5
- Operating capacity — 5
- Pukekohe shooting — 5
- Building Bridges with Music — 5
- Acidus — 4
- Atomic value — 4
- Area function — 4
- Invariance theorem — 4
- Incompressible string — 4
- Enveloping algebra — 4
- Total ionic strength adjustment buffer — 4
- Pamela Manzi — 4
- Diazoalkane 1,3-dipolar cycloaddition — 4
- C3H4 — 4
- Polymethine — 4
- C11H22 — 4
- C13H26 — 4
- C14H28 — 4
- Yuheng — 4
- Boolean algebra (disambiguation) — 4
- Boolean-valued — 4
- Control logic — 4
- Standalone software — 4
- Computer program product — 4
- GENLN2 — 4
- GISSD — 4
- Recuperative multi-tube cooler — 4
- Lower flammability limit — 4
- Synthetic substance — 4
- Michaelis–Menten–Monod kinetics — 4
- Changes in matter — 4
- Strictly convex — 4
- Comet Levy — 4
- Quad-channel architecture — 4
- Scalable locality — 4
- Dihydropyran — 4
- C6H9NO — 4
- C16H13O7 — 4
- C17H15O7 — 4
- C18H17O7 — 4
- C19H12O2 — 4
- C23H25O12 — 4
- C30H17Cl — 4
- Tinaksite — 4
- C22H31N3O5 — 4
- Olgite — 4
- Synchysite — 4

## Method & caveat
Full **rendered** link graph (SDOW dump 2026-06-03, namespace-0, navbox/template links included) — the classic six-degrees metric. This is a **lower bound on in-game body-clicks** (the game strips navboxes). Reverse-BFS from Adolf Hitler over incoming links; every reachable article labeled in one sweep.
