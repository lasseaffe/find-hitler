import { Agent } from 'undici'

// LLM tampering via any OpenAI-compatible chat endpoint — defaults to a LOCAL Ollama
// model (zero cost, no key). Override with env to use OpenRouter or another provider:
//   FC_LLM_BASE_URL   default http://localhost:11434/v1  (Ollama; OpenRouter: https://openrouter.ai/api/v1)
//   FC_LLM_MODEL      default llama3.1:8b                 (e.g. qwen3:14b locally, or an OpenRouter ":free" model)
//   FC_LLM_API_KEY    optional                            (required by OpenRouter; ignored by Ollama)
//   FC_LLM_TIMEOUT_MS default 600000 (10 min)             (local models can be slow; raise undici's 300s cap)
const BASE_URL = process.env.FC_LLM_BASE_URL || 'http://localhost:11434/v1'
const MODEL = process.env.FC_LLM_MODEL || 'llama3.1:8b'
const API_KEY = process.env.FC_LLM_API_KEY || process.env.OPENROUTER_API_KEY || ''
const TIMEOUT_MS = Number(process.env.FC_LLM_TIMEOUT_MS) || 600000
// Generous so "thinking" models (e.g. Gemini 2.5, qwen3) have room for reasoning tokens
// AND the JSON answer; the output JSON itself is small.
const MAX_TOKENS = Number(process.env.FC_LLM_MAX_TOKENS) || 4000

// Ollama buffers the whole non-streamed completion before sending headers, so a slow local
// generation trips undici's default 300s headersTimeout. Raise both timeouts for this call.
const llmDispatcher = new Agent({ headersTimeout: TIMEOUT_MS, bodyTimeout: TIMEOUT_MS })

export const TAMPER_SYSTEM =
  'You corrupt factual reference text for a "spot the lie" game. You receive the plain text ' +
  'of a real encyclopedia article and return STRICT JSON only. You never add commentary.'

export function buildTamperPrompt(plain, mistakeCount, decoyCount) {
  return [
    `From the article text below, choose ${mistakeCount} factual claims to falsify and ${decoyCount} ` +
    `true claims that merely LOOK suspicious (decoys).`,
    '',
    'Rules:',
    `- For each mistake: "find" MUST be an EXACT substring copied verbatim from the text (a date, name,`,
    `  place, number, or short phrase). "replacement" MUST be an UNAMBIGUOUSLY false but plausible value`,
    `  of the same kind (a different real date/place/number). Never opinion; never anything possibly true.`,
    '- For each decoy: "find" MUST be an EXACT substring copied verbatim. Decoys are NOT changed.',
    '- Prefer short, distinctive "find" phrases that occur once.',
    '',
    'Return ONLY JSON of this exact shape:',
    '{"mistakes":[{"find":"...","replacement":"...","explanation":"why the real value is correct"}],',
    ' "decoys":[{"find":"..."}]}',
    '',
    'ARTICLE TEXT:',
    plain,
  ].join('\n')
}

export function parseTamperJson(text) {
  // Strip <think>…</think> reasoning that local models (e.g. qwen3) may emit before the JSON.
  const cleaned = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '')
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : cleaned
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response')
  const obj = JSON.parse(raw.slice(start, end + 1))
  return { mistakes: obj.mistakes ?? [], decoys: obj.decoys ?? [] }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Thin network wrapper over an OpenAI-compatible /chat/completions endpoint.
// Not unit-tested (verified live). Free by default (local Ollama). Retries with exponential
// backoff on rate-limit / overload (429/503/5xx) — important for free cloud tiers like Gemini.
export async function callTamperLLM(plain, mistakeCount, decoyCount) {
  const headers = { 'Content-Type': 'application/json' }
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TAMPER_SYSTEM },
      { role: 'user', content: buildTamperPrompt(plain, mistakeCount, decoyCount) },
    ],
  })

  let delay = 6000
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST', headers, body,
      dispatcher: llmDispatcher,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    // Rate-limited / overloaded → wait and retry (free tiers throttle hard).
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`LLM request failed (${res.status}) at ${BASE_URL}: ${txt.slice(0, 200)}`)
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return parseTamperJson(text)
  }
  throw new Error(`LLM rate-limited at ${BASE_URL} after retries`)
}
