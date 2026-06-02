// tests/sixDegrees.report.test.js
import { describe, it, expect } from 'vitest'
import { buildReport } from '../src/lib/sixDegrees/report.js'

const rows = [
  { startTitle: 'Coffee', minClicks: 2, status: 'exact' },
  { startTitle: 'Penguin', minClicks: 3, status: 'exact' },
  { startTitle: 'Jazz', minClicks: 6, status: 'exact' },
  { startTitle: 'Obscure Stub', minClicks: 7, status: 'exact' },
  { startTitle: 'Island Page', minClicks: null, status: 'capped' },
]

describe('buildReport', () => {
  it('counts the histogram by click count', () => {
    const r = buildReport(rows)
    expect(r.histogram[2]).toBe(1)
    expect(r.histogram[3]).toBe(1)
    expect(r.histogram[6]).toBe(1)
    expect(r.histogram[7]).toBe(1)
  })

  it('computes percent reachable within six clicks (exact rows only)', () => {
    const r = buildReport(rows)
    // exact rows: 2,3,6,7 -> within six = 3 of 4 = 75%
    expect(r.pctWithinSix).toBe(75)
    expect(r.exactCount).toBe(4)
  })

  it('lists violations (minClicks >= 7 or capped/unreachable)', () => {
    const r = buildReport(rows)
    const titles = r.violations.map(v => v.startTitle)
    expect(titles).toContain('Obscure Stub')
    expect(titles).toContain('Island Page')
    expect(titles).not.toContain('Jazz')
  })

  it('reports median, mean, and max over exact rows', () => {
    const r = buildReport(rows)
    expect(r.max).toBe(7)
    expect(r.median).toBe(4.5) // median of [2,3,6,7]
    expect(r.mean).toBe(4.5)   // (2+3+6+7)/4
  })
})
