import { describe, it, expect, vi } from 'vitest'
import { tamperPlainText } from '../src/lib/study/tamper.js'

const SAMPLE = `Porter's Five Forces is a framework developed by Michael Porter in 1979. The model identifies five competitive forces that shape every industry: threat of new entrants, bargaining power of suppliers, bargaining power of buyers, threat of substitutes, and competitive rivalry. Porter published the framework in the Harvard Business Review. Companies use it to understand their competitive landscape and develop strategy.`

const mockLLM = (mistakes, decoys = []) =>
  vi.fn().mockResolvedValue({ mistakes, decoys })

describe('tamperPlainText', () => {
  it('wraps a found mistake into tampered HTML', async () => {
    const llm = mockLLM([
      { find: '1979', replacement: '1985', explanation: 'Published in 1979, not 1985.' },
    ])
    const result = await tamperPlainText(SAMPLE, { difficulty: 'easy' }, { callLLM: llm })
    expect(result.mistakes).toHaveLength(1)
    expect(result.mistakes[0].correct).toBe('1979')
    expect(result.mistakes[0].span).toBe('1985')
    expect(result.tampered).toContain('data-fc-id')
    expect(result.tampered).toContain('data-fc-mistake="true"')
  })

  it('retries 3 times when LLM returns no locatable text', async () => {
    const llm = mockLLM([{ find: 'NOTFOUND', replacement: 'x', explanation: 'test' }])
    await expect(tamperPlainText(SAMPLE, { difficulty: 'easy' }, { callLLM: llm }))
      .rejects.toThrow('Could not plant locatable mistakes')
    expect(llm).toHaveBeenCalledTimes(3)
  })

  it('keeps the best partial result across retries', async () => {
    let n = 0
    const llm = vi.fn().mockImplementation(() => {
      n++
      return Promise.resolve({
        mistakes: [
          { find: '1979', replacement: '1985', explanation: 'year' },
          n === 2
            ? { find: 'Porter', replacement: 'Smith', explanation: 'name' }
            : { find: 'NOTFOUND', replacement: 'x', explanation: 'none' },
        ],
        decoys: [],
      })
    })
    const result = await tamperPlainText(SAMPLE, { difficulty: 'medium' }, { callLLM: llm })
    expect(result.mistakes.length).toBeGreaterThanOrEqual(1)
  })

  it('wraps plain text into paragraph HTML before tampering', async () => {
    const llm = mockLLM([
      { find: '1979', replacement: '1985', explanation: 'year' },
    ])
    const result = await tamperPlainText(SAMPLE, { difficulty: 'easy' }, { callLLM: llm })
    expect(result.tampered).toMatch(/<p>/)
  })
})
