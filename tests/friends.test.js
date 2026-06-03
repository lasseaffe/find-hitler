import { describe, it, expect } from 'vitest'

function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

describe('generateFriendCode', () => {
  it('returns a 6-character string', () => {
    expect(generateFriendCode()).toHaveLength(6)
  })
  it('uses only unambiguous chars', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateFriendCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })
  it('produces different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, generateFriendCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})
