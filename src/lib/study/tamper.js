import { callTamperLLM } from '../llm.js'
import { wrapAndValidate, MISTAKE_COUNTS } from '../factCheckerGen.js'

/**
 * Takes raw plain text and returns { tampered, mistakes, decoys } with planted errors.
 * Mirrors the tamper loop in generateTamperedArticle() but skips the Wikipedia fetch.
 *
 * @param {string} plainText
 * @param {{ difficulty?: string }} opts
 * @param {{ callLLM?: Function }} deps   injectable for tests
 */
export async function tamperPlainText(plainText, { difficulty = 'medium' } = {}, deps = {}) {
  const callLLM = deps.callLLM ?? callTamperLLM
  const required   = MISTAKE_COUNTS[difficulty] ?? MISTAKE_COUNTS.medium
  const decoyCount = Math.round(required * 1.5)

  const html = plainText
    .split(/\n\n+/)
    .map(p => `<p>${p.trim()}</p>`)
    .join('\n')

  let best = { tampered: html, mistakes: [], decoys: [] }
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const llm = await callLLM(plainText, required, decoyCount)
      const result = wrapAndValidate(html, llm)
      if (result.mistakes.length > best.mistakes.length) best = result
      if (best.mistakes.length >= required) break
    } catch (err) {
      lastErr = err
    }
  }
  if (best.mistakes.length < 1) {
    throw new Error(
      `Could not plant locatable mistakes after 3 attempts${lastErr ? `: ${lastErr.message}` : ''}`
    )
  }
  return best
}
