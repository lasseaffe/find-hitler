import { describe, it, expect, vi } from 'vitest'
import {
  detectIngestType,
  ingestWiki,
  ingestPaste,
  ingestAiGen,
  ingestUrl,
} from '../src/lib/study/ingest.js'

describe('detectIngestType', () => {
  it('returns existing when articleId present', () => {
    expect(detectIngestType({ articleId: 'abc' })).toBe('existing')
  })
  it('returns file when file object present', () => {
    expect(detectIngestType({ file: {} })).toBe('file')
  })
  it('returns wiki for en.wikipedia.org URLs', () => {
    expect(detectIngestType({ text: 'https://en.wikipedia.org/wiki/Porter%27s_five_forces_analysis' })).toBe('wiki')
  })
  it('returns url for other http URLs', () => {
    expect(detectIngestType({ text: 'https://example.com/article' })).toBe('url')
  })
  it('returns paste for long plain text (>80 chars)', () => {
    expect(detectIngestType({ text: 'a'.repeat(81) })).toBe('paste')
  })
  it('returns ai-gen for short plain text (≤80 chars)', () => {
    expect(detectIngestType({ text: 'Porter Five Forces' })).toBe('ai-gen')
  })
  it('throws when no input provided', () => {
    expect(() => detectIngestType({})).toThrow('No input provided')
  })
})

describe('ingestPaste', () => {
  it('returns trimmed text and a title', () => {
    const text = 'x'.repeat(100)
    const result = ingestPaste(text)
    expect(result.text).toBe(text)
    expect(result.title).toHaveLength(60)
  })
  it('throws when text is too short', () => {
    expect(() => ingestPaste('short')).toThrow('too short')
  })
})

describe('ingestWiki', () => {
  it('fetches via Wikipedia title extracted from URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      cleanHtml: '<p>Porter published in <b>1979</b>.</p>',
    })
    const result = await ingestWiki(
      'https://en.wikipedia.org/wiki/Porter%27s_five_forces_analysis',
      { fetchWiki: mockFetch }
    )
    expect(mockFetch).toHaveBeenCalledWith("Porter's_five_forces_analysis")
    expect(result.text).toContain('1979')
    expect(result.title).toBe("Porter's_five_forces_analysis")
  })

  it('throws on invalid Wikipedia URL', async () => {
    await expect(ingestWiki('https://en.wikipedia.org/')).rejects.toThrow('Invalid Wikipedia URL')
  })
})

describe('ingestAiGen', () => {
  it('calls LLM with a prompt containing the topic', async () => {
    const mockLLM = vi.fn().mockResolvedValue('A study article about Porter.')
    const result = await ingestAiGen('Porter Five Forces', 'UNI_Y2', 'BUSINESS_ECONOMICS', { callLLM: mockLLM })
    expect(mockLLM).toHaveBeenCalledOnce()
    const [prompt] = mockLLM.mock.calls[0]
    expect(prompt).toContain('Porter Five Forces')
    expect(prompt).toContain('UNI_Y2')
    expect(result.text).toBe('A study article about Porter.')
    expect(result.title).toBe('Porter Five Forces')
  })
})

describe('ingestUrl', () => {
  it('scrapes content and generates an article via LLM', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><main><article>Long enough content about a topic that we want to study in school this semester. This article contains important information about historical events, key figures, and their contributions to society. Students need to understand these concepts to grasp the broader context of the subject matter being covered in this educational resource.</article></main></html>'),
    })
    const mockLLM = vi.fn().mockResolvedValue('Clean study article text.')
    const result = await ingestUrl('https://example.com/article', { fetch: mockFetch, callLLM: mockLLM })
    expect(mockLLM).toHaveBeenCalledOnce()
    expect(result.text).toBe('Clean study article text.')
  })

  it('throws when fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    await expect(ingestUrl('https://example.com/404', { fetch: mockFetch, callLLM: vi.fn() }))
      .rejects.toThrow('404')
  })
})
