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
