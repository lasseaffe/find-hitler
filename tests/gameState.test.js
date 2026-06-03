import { describe, it, expect, beforeEach } from 'vitest'
import { createGame, getGame, getPlayer, updatePlayerMove, useUndoToken } from '../src/lib/gameState.js'

// Reset store between test runs by using a fresh module-level key
const TEST_STORE_KEY = `_gamesStore_${Math.random()}`

describe('game state', () => {
  let gameId, playerId

  beforeEach(() => {
    playerId = 'player-test-1'
    gameId = createGame({
      target: 'Adolf Hitler',
      mode: 'classic',
      playerId,
      playerName: 'Tester',
      startPage: 'Brazil',
      cleanHtml: '<p>Brazil</p>',
      validLinks: ['South_America', 'Argentina'],
    })
  })

  it('creates a game with correct initial player state', () => {
    const game = getGame(gameId)
    expect(game.target).toBe('Adolf Hitler')
    expect(game.mode).toBe('classic')

    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('Brazil')
    expect(player.clicks).toBe(0)
    expect(player.undoTokens).toBe(3)
    expect(player.history).toHaveLength(0)
    expect(player.allowedMoves).toContain('South_America')
  })

  it('getGame returns null for unknown id', () => {
    expect(getGame('nonexistent')).toBeNull()
  })

  it('getPlayer returns null for unknown player', () => {
    expect(getPlayer(gameId, 'nobody')).toBeNull()
  })

  it('updatePlayerMove increments clicks and stores history', () => {
    updatePlayerMove(gameId, playerId, {
      nextPage: 'South_America',
      cleanHtml: '<p>SA</p>',
      validLinks: ['Germany', 'France'],
    })
    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('South_America')
    expect(player.clicks).toBe(1)
    expect(player.allowedMoves).toContain('Germany')
    expect(player.history).toHaveLength(1)
    expect(player.history[0].page).toBe('Brazil')
    expect(player.history[0].html).toBe('<p>Brazil</p>')
  })

  it('useUndoToken restores previous page and decrements token', () => {
    updatePlayerMove(gameId, playerId, {
      nextPage: 'South_America',
      cleanHtml: '<p>SA</p>',
      validLinks: ['Germany'],
    })
    const result = useUndoToken(gameId, playerId)
    expect(result).not.toBeNull()
    expect(result.page).toBe('Brazil')
    expect(result.html).toBe('<p>Brazil</p>')

    const player = getPlayer(gameId, playerId)
    expect(player.currentPage).toBe('Brazil')
    expect(player.undoTokens).toBe(2)
    expect(player.history).toHaveLength(0)
  })

  it('useUndoToken returns null when no tokens remain', () => {
    // Use all 3 undo tokens
    for (let i = 0; i < 3; i++) {
      updatePlayerMove(gameId, playerId, { nextPage: `Page${i}`, cleanHtml: `<p>${i}</p>`, validLinks: [`Next${i}`] })
      useUndoToken(gameId, playerId)
    }
    const player = getPlayer(gameId, playerId)
    expect(player.undoTokens).toBe(0)
    // Now push one more page without undoing
    updatePlayerMove(gameId, playerId, { nextPage: 'FinalPage', cleanHtml: '<p>f</p>', validLinks: [] })
    expect(useUndoToken(gameId, playerId)).toBeNull()
  })

  it('useUndoToken returns null with empty history', () => {
    // No moves made — nothing to undo
    const result = useUndoToken(gameId, playerId)
    expect(result).toBeNull()
  })
})

describe('difficulty undoTokens', () => {
  it('starts with 0 undo tokens when undoTokens=0 (brutal difficulty)', () => {
    const gameId = createGame({
      target: 'Adolf Hitler',
      mode: 'classic',
      undoTokens: 0,
      playerId: 'p1',
      playerName: 'Test',
      startPage: 'Coffee',
      cleanHtml: '<p>test</p>',
      validLinks: [],
    })
    const player = getPlayer(gameId, 'p1')
    expect(player.undoTokens).toBe(0)
  })

  it('starts with 3 undo tokens by default (normal difficulty)', () => {
    const gameId = createGame({
      target: 'Jesus',
      mode: 'classic',
      playerId: 'p2',
      playerName: 'Test2',
      startPage: 'Coffee',
      cleanHtml: '<p>test</p>',
      validLinks: [],
    })
    const player = getPlayer(gameId, 'p2')
    expect(player.undoTokens).toBe(3)
  })

  it('stores hubPenalty and timeLimitSeconds on game object', () => {
    const gameId = createGame({
      target: 'Adolf Hitler',
      mode: 'classic',
      hubPenalty: true,
      timeLimitSeconds: 300,
      undoTokens: 1,
      playerId: 'p3',
      playerName: 'Test3',
      startPage: 'Coffee',
      cleanHtml: '<p>test</p>',
      validLinks: [],
    })
    const game = getGame(gameId)
    expect(game.hubPenalty).toBe(true)
    expect(game.timeLimitSeconds).toBe(300)
  })
})
