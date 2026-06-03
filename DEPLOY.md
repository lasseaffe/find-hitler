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

The Fact Checker mode tampers real Wikipedia articles with an LLM via any OpenAI-compatible
chat endpoint. **Defaults to a free local Ollama model — no API key, no cost.**

Config (all optional; defaults shown):

- `FC_LLM_BASE_URL` — default `http://localhost:11434/v1` (local Ollama).
  For OpenRouter use `https://openrouter.ai/api/v1`.
- `FC_LLM_MODEL` — default `llama3.1:8b`. Higher quality locally: `qwen3:14b`.
  OpenRouter free example: `meta-llama/llama-3.3-70b-instruct:free`.
- `FC_LLM_API_KEY` — only needed for hosted providers (e.g. OpenRouter). Ignored by Ollama.
  (Falls back to `OPENROUTER_API_KEY` if set.)

Local setup (free): install Ollama, then `ollama pull llama3.1:8b`.

Batch-generate pending articles (reviewed in /admin/fact-checker before they go live):

    node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty medium --category history
    node --env-file=.env.local scripts/generate-fact-checker.mjs --subjects subjects.txt --difficulty hard

The admin "Generate" button uses the same configured LLM. Set these vars in `.env.local`
(or the deploy environment) so the Next.js server process sees them.
