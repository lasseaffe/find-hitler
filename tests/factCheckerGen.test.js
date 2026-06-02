import { describe, it, expect } from 'vitest'
import { trimByDifficulty, htmlToPlainText } from '../src/lib/factCheckerGen.js'

const ARTICLE = `
<p>Lead paragraph one.</p>
<p>Lead paragraph two.</p>
<table class="infobox"><tr><td>Born 1889</td></tr></table>
<h2><span class="mw-headline">Early life</span></h2>
<p>Section one body.</p>
<h2><span class="mw-headline">Career</span></h2>
<p>Section two body.</p>
<h2><span class="mw-headline">Death</span></h2>
<p>Section three body.</p>
`

describe('trimByDifficulty', () => {
  it('always strips the infobox', () => {
    for (const d of ['easy', 'medium', 'hard', 'hardcore']) {
      expect(trimByDifficulty(ARTICLE, d)).not.toContain('infobox')
      expect(trimByDifficulty(ARTICLE, d)).not.toContain('Born 1889')
    }
  })
  it('easy = lead only (no section headings/bodies)', () => {
    const out = trimByDifficulty(ARTICLE, 'easy')
    expect(out).toContain('Lead paragraph one.')
    expect(out).not.toContain('Section one body.')
    expect(out).not.toContain('Career')
  })
  it('medium = lead + first sections (includes section one, not the last)', () => {
    const out = trimByDifficulty(ARTICLE, 'medium')
    expect(out).toContain('Lead paragraph one.')
    expect(out).toContain('Section one body.')
  })
  it('hard/hardcore = full article (all sections present)', () => {
    const out = trimByDifficulty(ARTICLE, 'hard')
    expect(out).toContain('Section one body.')
    expect(out).toContain('Section three body.')
  })
})

describe('htmlToPlainText', () => {
  it('returns visible text with collapsed whitespace, no tags', () => {
    const txt = htmlToPlainText('<p>Hello   <b>world</b></p>\n<p>Again</p>')
    expect(txt).not.toContain('<')
    expect(txt).toContain('Hello world')
    expect(txt).toContain('Again')
  })
})

import { wrapAndValidate } from '../src/lib/factCheckerGen.js'

describe('wrapAndValidate', () => {
  const HTML = '<p>Born in 1889 in Braunau. Served as a corporal.</p>'

  it('wraps located mistakes with data-fc-id + data-fc-mistake=true and substitutes the lie', () => {
    const { tampered, mistakes } = wrapAndValidate(HTML, {
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'Born 1889.' }],
      decoys: [],
    })
    expect(tampered).toContain('data-fc-mistake="true"')
    expect(tampered).toContain('1879')        // lie rendered
    expect(tampered).not.toContain('1889')    // truth replaced in the body
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0].span).toBe('1879')     // rendered false text (for hard matching)
    expect(mistakes[0].correct).toBe('1889')  // truth (for reveal)
    expect(mistakes[0].fcId).toBeTruthy()
  })

  it('wraps decoys with data-fc-mistake=false and leaves their text unchanged', () => {
    const { tampered, decoys } = wrapAndValidate(HTML, {
      mistakes: [],
      decoys: [{ find: 'Braunau' }],
    })
    expect(tampered).toContain('data-fc-mistake="false"')
    expect(tampered).toContain('Braunau')
    expect(decoys).toHaveLength(1)
    expect(decoys[0].span).toBe('Braunau')
  })

  it('DISCARDS items whose `find` is not present in the text (reachability guarantee)', () => {
    const { mistakes } = wrapAndValidate(HTML, {
      mistakes: [
        { find: '1889', replacement: '1879', explanation: 'ok' },
        { find: 'NOT_IN_TEXT', replacement: 'x', explanation: 'hallucinated' },
      ],
      decoys: [],
    })
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0].correct).toBe('1889')
  })

  it('assigns a unique fcId per wrapped region', () => {
    const { mistakes, decoys } = wrapAndValidate(HTML, {
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'ok' }],
      decoys: [{ find: 'corporal' }],
    })
    const ids = [...mistakes, ...decoys].map(x => x.fcId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

import { stripTruthForClient } from '../src/lib/factCheckerGen.js'

const STORED = '<p>Born in <span data-fc-id="a1" data-fc-mistake="true">1879</span> in ' +
               '<span data-fc-id="d1" data-fc-mistake="false">Braunau</span>.</p>'

describe('stripTruthForClient', () => {
  it('easy/medium: keeps data-fc-id, removes data-fc-mistake (no answer leak)', () => {
    const out = stripTruthForClient(STORED, 'medium')
    expect(out).toContain('data-fc-id="a1"')
    expect(out).toContain('data-fc-id="d1"')
    expect(out).not.toContain('data-fc-mistake')
    expect(out).toContain('1879')
    expect(out).toContain('Braunau')
  })
  it('hard/hardcore: removes ALL fc wrappers, keeps the visible text (no candidate-set tell)', () => {
    const out = stripTruthForClient(STORED, 'hard')
    expect(out).not.toContain('data-fc-id')
    expect(out).not.toContain('data-fc-mistake')
    expect(out).toContain('1879')
    expect(out).toContain('Braunau')
  })
})

import { buildTamperPrompt, parseTamperJson } from '../src/lib/llm.js'

import { generateTamperedArticle, MISTAKE_COUNTS } from '../src/lib/factCheckerGen.js'

const FAKE_WIKI = async () => ({
  cleanHtml: '<p>Born in 1889 in Braunau. Served as a corporal in the army.</p>',
  title: 'Adolf Hitler',
  validLinks: [],
})

describe('MISTAKE_COUNTS', () => {
  it('defines the per-difficulty mistake budget', () => {
    expect(MISTAKE_COUNTS).toMatchObject({ easy: 3, medium: 4, hard: 5, hardcore: 6 })
  })
})

describe('generateTamperedArticle', () => {
  it('produces a pending article with wrapped mistakes + source attribution', async () => {
    const fakeLLM = async () => ({
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'Born 1889.' }],
      decoys: [{ find: 'Braunau' }],
    })
    const out = await generateTamperedArticle('Adolf Hitler', 'easy', 'history', {
      fetchWiki: FAKE_WIKI, callLLM: fakeLLM,
    })
    expect(out.status).toBe('pending')
    expect(out.difficulty).toBe('easy')
    expect(out.category).toBe('history')
    expect(out.subject).toBe('Adolf Hitler')
    expect(out.mistakes.length).toBeGreaterThanOrEqual(1)
    expect(out.mistakes[0]).toMatchObject({ span: '1879', correct: '1889' })
    expect(out.tampered).toContain('data-fc-mistake="true"')
    expect(out.sourceUrl).toContain('Adolf_Hitler')
  })

  it('throws when ZERO locatable mistakes survive after retries', async () => {
    const badLLM = async () => ({
      mistakes: [{ find: 'NOT_IN_TEXT', replacement: 'x', explanation: 'hallucinated' }],
      decoys: [],
    })
    await expect(
      generateTamperedArticle('Adolf Hitler', 'easy', 'history', { fetchWiki: FAKE_WIKI, callLLM: badLLM })
    ).rejects.toThrow(/locatable mistakes/i)
  })

  it('uses getRandomWikiPage when no subject is given', async () => {
    const pickRandom = async () => 'Adolf Hitler'
    const fakeLLM = async () => ({ mistakes: [{ find: '1889', replacement: '1879', explanation: 'e' }], decoys: [] })
    const out = await generateTamperedArticle(null, 'easy', 'history', {
      fetchWiki: FAKE_WIKI, callLLM: fakeLLM, pickRandom,
    })
    expect(out.subject).toBe('Adolf Hitler')
  })
})

describe('buildTamperPrompt', () => {
  it('states the required mistake + decoy counts and the unambiguous-falsehood rule', () => {
    const p = buildTamperPrompt('Some article text.', 5, 8)
    expect(p).toContain('5')
    expect(p).toContain('8')
    expect(p.toLowerCase()).toContain('exact')
    expect(p.toLowerCase()).toContain('unambiguous')
    expect(p).toContain('Some article text.')
  })
})

describe('parseTamperJson', () => {
  it('parses a fenced JSON block', () => {
    const out = parseTamperJson('```json\n{"mistakes":[{"find":"1889","replacement":"1879","explanation":"e"}],"decoys":[{"find":"Braunau"}]}\n```')
    expect(out.mistakes[0].find).toBe('1889')
    expect(out.decoys[0].find).toBe('Braunau')
  })
  it('parses raw JSON', () => {
    const out = parseTamperJson('{"mistakes":[],"decoys":[]}')
    expect(out.mistakes).toEqual([])
  })
  it('throws on non-JSON', () => {
    expect(() => parseTamperJson('I cannot help with that.')).toThrow()
  })
})
