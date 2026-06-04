import { Agent } from 'undici'

// LLM tampering via any OpenAI-compatible chat endpoint — defaults to a LOCAL Ollama
// model (zero cost, no key). Override with env to use OpenRouter or another provider:
//   FC_LLM_BASE_URL    default http://localhost:11434/v1   (Ollama; OpenRouter: https://openrouter.ai/api/v1)
//   FC_LLM_MODEL       default llama3.1:8b                  (e.g. qwen3:14b locally, or an OpenRouter ":free" model)
//   FC_LLM_API_KEY     optional                             (required by OpenRouter; ignored by Ollama)
//   FC_LLM_TIMEOUT_MS  default 600000 (10 min)              (local models are slow; raises undici's 300s cap)
//   FC_LLM_MAX_TOKENS  default 4000                         (generous for thinking models; output JSON is small)
//
// Fallback provider (used when primary returns an unrecoverable error like daily quota):
//   FC_LLM_FALLBACK_BASE_URL  e.g. https://openrouter.ai/api/v1
//   FC_LLM_FALLBACK_MODEL     e.g. meta-llama/llama-3.3-70b-instruct:free
//   FC_LLM_FALLBACK_API_KEY   OpenRouter key (required by OpenRouter)
const BASE_URL  = process.env.FC_LLM_BASE_URL  || 'http://localhost:11434/v1'
const MODEL     = process.env.FC_LLM_MODEL     || 'llama3.1:8b'
const API_KEY   = process.env.FC_LLM_API_KEY   || process.env.OPENROUTER_API_KEY || ''
const TIMEOUT_MS = Number(process.env.FC_LLM_TIMEOUT_MS) || 600000
const MAX_TOKENS = Number(process.env.FC_LLM_MAX_TOKENS) || 4000

const FALLBACK_BASE_URL = process.env.FC_LLM_FALLBACK_BASE_URL || ''
const FALLBACK_MODEL    = process.env.FC_LLM_FALLBACK_MODEL    || 'meta-llama/llama-3.3-70b-instruct:free'
const FALLBACK_API_KEY  = process.env.FC_LLM_FALLBACK_API_KEY  || process.env.OPENROUTER_API_KEY || ''

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

// Thrown when the provider reports an unrecoverable quota limit (daily, not per-minute).
// Callers can catch this specifically to try a fallback provider without wasting quota.
export class QuotaExhaustedError extends Error {
  constructor(baseUrl, msg) { super(`Daily quota exhausted at ${baseUrl}: ${msg}`); this.name = 'QuotaExhaustedError' }
}

function isUnrecoverable(status, body) {
  // Gemini: RESOURCE_EXHAUSTED + PerDay quota = daily limit; do not retry.
  if (status === 429) {
    try {
      const d = JSON.parse(body)
      const quotaId = JSON.stringify(d).match(/"quotaId"\s*:\s*"([^"]+)"/)?.[1] ?? ''
      const geminiStatus = JSON.stringify(d).match(/"status"\s*:\s*"([^"]+)"/)?.[1] ?? ''
      if (quotaId.toLowerCase().includes('perday') || geminiStatus === 'RESOURCE_EXHAUSTED') return true
    } catch {}
  }
  return false
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Call one specific endpoint. Returns parsed JSON or throws QuotaExhaustedError / Error.
async function callEndpoint(baseUrl, model, apiKey, plain, mistakeCount, decoyCount) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const body = JSON.stringify({
    model, max_tokens: MAX_TOKENS, temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TAMPER_SYSTEM },
      { role: 'user', content: buildTamperPrompt(plain, mistakeCount, decoyCount) },
    ],
  })

  let delay = 6000
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, body,
      dispatcher: llmDispatcher,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      if (isUnrecoverable(res.status, txt)) throw new QuotaExhaustedError(baseUrl, txt.slice(0, 150))
      // Per-minute throttle or transient 5xx → backoff and retry.
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(delay); delay *= 2; continue
      }
      throw new Error(`LLM request failed (${res.status}) at ${baseUrl}: ${txt.slice(0, 200)}`)
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return parseTamperJson(text)
  }
  throw new Error(`LLM rate-limited at ${baseUrl} after retries`)
}

// Thin orchestration wrapper. Tries the primary provider; on QuotaExhaustedError tries the
// fallback provider if configured. Not unit-tested (verified live).
export async function callTamperLLM(plain, mistakeCount, decoyCount) {
  try {
    return await callEndpoint(BASE_URL, MODEL, API_KEY, plain, mistakeCount, decoyCount)
  } catch (err) {
    if (err instanceof QuotaExhaustedError && FALLBACK_BASE_URL) {
      console.warn(`  [llm] primary quota exhausted — falling back to ${FALLBACK_BASE_URL} (${FALLBACK_MODEL})`)
      return await callEndpoint(FALLBACK_BASE_URL, FALLBACK_MODEL, FALLBACK_API_KEY, plain, mistakeCount, decoyCount)
    }
    throw err
  }
}

/**
 * General-purpose text generation using the same LLM endpoint as tampering.
 * Returns plain text (not JSON). Uses the same BASE_URL / MODEL / API_KEY env vars.
 */
export async function callGenerateLLM(prompt, deps = {}) {
  const baseUrl = deps.baseUrl ?? BASE_URL
  const model   = deps.model   ?? MODEL
  const apiKey  = deps.apiKey  ?? API_KEY
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const body = JSON.stringify({
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST', headers, body,
    dispatcher: llmDispatcher,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`callGenerateLLM failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}
