import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki } from '@/lib/wikipedia.js'
import { getGame, getPlayer, updatePlayerMove } from '@/lib/gameState.js'
import { calculateScore } from '@/lib/scoring.js'

function normTitle(title) {
  return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase()
}

export async function POST(request) {
  try {
    const { gameId, playerId, target: moveTarget } = await request.json()

    const game = getGame(gameId)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const player = getPlayer(gameId, playerId)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Anti-cheat: verify the requested page is in the player's allowed moves
    const allowed = player.allowedMoves.map(normTitle)
    if (!allowed.includes(normTitle(moveTarget))) {
      return NextResponse.json({ error: 'Move not allowed — link was not on the page' }, { status: 403 })
    }

    const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(moveTarget)

    // Update state before checking win so clicks reflect this move
    updatePlayerMove(gameId, playerId, {
      nextPage: title,
      cleanHtml,
      validLinks,
    })

    const updatedPlayer = getPlayer(gameId, playerId)

    // Win condition check
    const won = normTitle(title) === normTitle(game.target)

    if (won) {
      const seconds = Math.floor((Date.now() - game.startTime) / 1000)
      const score = calculateScore({ mode: game.mode, clicks: updatedPlayer.clicks, seconds })
      return NextResponse.json({
        status: 'WIN',
        score,
        clicks: updatedPlayer.clicks,
        time: seconds,
        path: [...updatedPlayer.history.map(h => h.page), title],
      })
    }

    return NextResponse.json({
      status: 'CONTINUE',
      html: cleanHtml,
      title,
      clicks: updatedPlayer.clicks,
      undoTokens: updatedPlayer.undoTokens,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
