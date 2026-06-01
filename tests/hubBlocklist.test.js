import { describe, it, expect } from 'vitest'
import { isHubPage, HUB_PAGES } from '../src/lib/hubBlocklist.js'

describe('hubBlocklist', () => {
  it('has at least 150 entries', () => {
    expect(HUB_PAGES.size).toBeGreaterThanOrEqual(150)
  })

  it('isHubPage returns true for known hubs', () => {
    expect(isHubPage('United States')).toBe(true)
    expect(isHubPage('World War II')).toBe(true)
    expect(isHubPage('Germany')).toBe(true)
    expect(isHubPage('1945')).toBe(true)
    expect(isHubPage('English language')).toBe(true)
  })

  it('isHubPage is case-insensitive and trims whitespace', () => {
    expect(isHubPage('  united states  ')).toBe(true)
    expect(isHubPage('WORLD WAR II')).toBe(true)
  })

  it('isHubPage returns false for non-hub pages', () => {
    expect(isHubPage('Coffee production in Brazil')).toBe(false)
    expect(isHubPage('Quantum entanglement')).toBe(false)
  })
})
