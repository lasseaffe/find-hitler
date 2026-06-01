// tests/pathGraph.test.js
import { describe, it, expect } from 'vitest'
import { buildGraph } from '../src/lib/pathGraph.js'

describe('buildGraph', () => {
  it('returns empty nodes and links for empty finishers', () => {
    const { nodes, links } = buildGraph([])
    expect(nodes).toEqual([])
    expect(links).toEqual([])
  })

  it('builds nodes from a single finisher path', () => {
    const finishers = [{ name: 'Alice', path: ['Brazil', 'Coffee', 'Adolf Hitler'], clicks: 2, isMe: true, isBot: false }]
    const { nodes, links } = buildGraph(finishers)
    expect(nodes.map(n => n.fullTitle)).toEqual(['Brazil', 'Coffee', 'Adolf Hitler'])
    expect(links).toHaveLength(2)
  })

  it('merges shared nodes across two finishers', () => {
    const finishers = [
      { name: 'Alice', path: ['Brazil', 'Coffee', 'Adolf Hitler'], clicks: 2, isMe: true, isBot: false },
      { name: 'Bob',   path: ['Brazil', 'Germany', 'Adolf Hitler'], clicks: 2, isMe: false, isBot: false },
    ]
    const { nodes } = buildGraph(finishers)
    const titles = nodes.map(n => n.fullTitle)
    expect(titles.filter(t => t === 'Brazil')).toHaveLength(1)
    expect(titles.filter(t => t === 'Adolf Hitler')).toHaveLength(1)
    expect(titles).toHaveLength(4) // Brazil, Coffee, Germany, Adolf Hitler
  })

  it('marks first node as isStart and last node of first finisher as isTarget', () => {
    const finishers = [{ name: 'Alice', path: ['Brazil', 'Adolf Hitler'], clicks: 1, isMe: true, isBot: false }]
    const { nodes } = buildGraph(finishers)
    expect(nodes.find(n => n.fullTitle === 'Brazil').isStart).toBe(true)
    expect(nodes.find(n => n.fullTitle === 'Adolf Hitler').isTarget).toBe(true)
  })

  it('truncates long node labels to 20 chars', () => {
    const long = 'A'.repeat(30)
    const finishers = [{ name: 'Alice', path: [long, 'End'], clicks: 1, isMe: true, isBot: false }]
    const { nodes } = buildGraph(finishers)
    const node = nodes.find(n => n.fullTitle === long)
    expect(node.label.length).toBeLessThanOrEqual(20)
  })

  it('assigns color from finisher index to each link', () => {
    const finishers = [
      { name: 'Alice', path: ['A', 'B'], clicks: 1, isMe: true, isBot: false },
      { name: 'Bob',   path: ['A', 'C'], clicks: 1, isMe: false, isBot: false },
    ]
    const { links } = buildGraph(finishers)
    const aliceLink = links.find(l => l.targetTitle === 'B')
    const bobLink   = links.find(l => l.targetTitle === 'C')
    expect(aliceLink.color).toBe('#2ecc71')
    expect(bobLink.color).toBe('#e74c3c')
  })
})
