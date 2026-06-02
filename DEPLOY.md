# Deploying Find Hitler

The app is a Next.js 16 app with a **custom Socket.io server** (`server.js`) — it needs a
**persistent host that supports WebSockets** (not serverless). It's containerized
(`Dockerfile`) and binds `$PORT`, so it runs on any container host.

It **boots without a database** — solo + multiplayer work with no setup. Auth, ranked, and
profile need a Postgres `DATABASE_URL` (optional; they degrade gracefully without one).

## Reality check on "free" (2026)

| Host | Cost | Always-on? | Notes |
|---|---|---|---|
| **Render (free)** | **$0** | No — sleeps after 15 min idle, ~1 min cold start | Best $0 option. No active game is interrupted (it only sleeps when nobody's playing). |
| **Fly.io** | ~$2/mo | Yes (set `min_machines_running = 1`) | Cheapest always-on. ~$5 trial credit for new accounts. |
| **Railway** | ~$5–10/mo | Paid only | Sleeps on free; not recommended for websockets. |

## Option A — Render (free, recommended for $0)

1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → pick the repo. It reads `render.yaml`
   (docker runtime, free plan, health check `/`).
3. Deploy. Your app is at `https://<name>.onrender.com`.
4. (Optional) For auth/ranked/profile, add env vars in the Render service:
   - `DATABASE_URL` — a free Postgres (Neon / Supabase / Render Postgres)
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_URL` — your Render URL
   - email vars for the magic-link login (`EMAIL_SERVER`, `EMAIL_FROM`) if used

First request after idle takes ~30–60s to wake — expected on the free plan.

## Option B — Fly.io (~$2/mo, always-on)

```bash
# one-time
curl -L https://fly.io/install.sh | sh   # or: brew install flyctl
fly auth signup                            # or: fly auth login

# from the project dir
fly launch --no-deploy --copy-config       # uses fly.toml (edit primary_region first)
fly deploy
```

Optional secrets (same as above):
```bash
fly secrets set DATABASE_URL="postgres://..." AUTH_SECRET="$(openssl rand -base64 32)" AUTH_URL="https://find-hitler.fly.dev"
```

## Local container sanity check

```bash
docker build -t find-hitler .
docker run -p 3004:3004 find-hitler
# open http://localhost:3004
```

## Notes
- WebSockets: both Render and Fly proxy WS automatically; the client connects same-origin
  (`io({ path: '/socket.io' })`), so no extra config.
- In-memory game/room/duel/queue state lives in the single server process — fine for one
  instance. Do **not** scale to multiple instances without moving that state to a shared
  store (the deferred Supabase Realtime migration).
- Build needs ~512MB+; Render free build env is sufficient.

## Fact Checker generation

The Fact Checker mode tampers real Wikipedia articles with Claude. Set:

- `ANTHROPIC_API_KEY` — required by the admin "Generate" button and the batch script.

Batch-generate pending articles (reviewed in /admin/fact-checker before they go live):

    node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty medium --category history
    node --env-file=.env.local scripts/generate-fact-checker.mjs --subjects subjects.txt --difficulty hard
