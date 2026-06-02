import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

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
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response')
  const obj = JSON.parse(raw.slice(start, end + 1))
  return { mistakes: obj.mistakes ?? [], decoys: obj.decoys ?? [] }
}

// Thin network wrapper. Not unit-tested (verified live later). Reads ANTHROPIC_API_KEY from env.
export async function callTamperLLM(plain, mistakeCount, decoyCount) {
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: TAMPER_SYSTEM,
    messages: [{ role: 'user', content: buildTamperPrompt(plain, mistakeCount, decoyCount) }],
  })
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  return parseTamperJson(text)
}
