import { NextResponse } from 'next/server'
import { getGame, getPlayer, useUndoToken } from '@/lib/gameState.js'

export async function POST(request) {
  try {
    const { gameId, playerId } = await request.json()

    const game = getGame(gameId)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const player = getPlayer(gameId, playerId)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const result = useUndoToken(gameId, playerId)
    if (!result) {
      return NextResponse.json(
        { error: player.undoTokens <= 0 ? 'No undo tokens remaining' : 'Nothing to undo' },
        { status: 400 }
      )
    }

    // After undo, re-read the updated player to get fresh undoTokens count
    const updated = getPlayer(gameId, playerId)

    return NextResponse.json({
      title: result.page,
      cleanHtml: result.html,
      clicks: updated.clicks,
      undoTokens: updated.undoTokens,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
