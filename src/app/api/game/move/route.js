// src/app/api/game/move/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki } from '@/lib/wikipedia.js'
import { getGame, getPlayer, updatePlayerMove } from '@/lib/gameState.js'
import { calculateScore, calculateGolfScore, calculateParGrade } from '@/lib/scoring.js'
import { isHubPage } from '@/lib/hubBlocklist.js'

function normTitle(title) {
  return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase()
}

const TIME_LIMITS = {
  golf: 300,
  'golf-hardcore': 150,
  'classic-hardcore': 300,
  'speedrun-hardcore': 150,
}

export async function POST(request) {
  try {
    const { gameId, playerId, target: moveTarget } = await request.json()

    const game = getGame(gameId)
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    const player = getPlayer(gameId, playerId)
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Time cap enforcement
    const timeLimitKey = game.hardcore ? `${game.mode}-hardcore` : game.mode
    const limitSeconds = TIME_LIMITS[timeLimitKey]
    if (limitSeconds) {
      const elapsed = (Date.now() - game.startTime) / 1000
      if (elapsed > limitSeconds) {
        return NextResponse.json({ status: 'TIME_UP', clicks: player.clicks }, { status: 200 })
      }
    }

    // Anti-cheat: link must have been on the page
    const allowed = player.allowedMoves.map(normTitle)
    if (!allowed.includes(normTitle(moveTarget))) {
      return NextResponse.json({ error: 'Move not allowed — link was not on the page' }, { status: 403 })
    }

    // No-Hub rejection: bounce player back, deduct 1 undo token
    if (game.mode === 'nohub' && isHubPage(moveTarget)) {
      if (player.undoTokens > 0) player.undoTokens--
      return NextResponse.json({
        status: 'HUB_BOUNCE',
        html: player._currentHtml,
        title: player.currentPage,
        clicks: player.clicks,
        undoTokens: player.undoTokens,
        hubPage: moveTarget,
      })
    }

    const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(moveTarget)
    updatePlayerMove(gameId, playerId, { nextPage: title, cleanHtml, validLinks })
    const updatedPlayer = getPlayer(gameId, playerId)

    const won = normTitle(title) === normTitle(game.target)
    const seconds = Math.floor((Date.now() - game.startTime) / 1000)

    if (won) {
      let score, extra = {}
      if (game.mode === 'golf') {
        score = calculateGolfScore({ clicks: updatedPlayer.clicks })
      } else if (game.mode === 'jesus') {
        const parResult = calculateParGrade(updatedPlayer.clicks)
        score = updatedPlayer.clicks
        extra = { parGrade: parResult.grade, parDelta: parResult.delta }
      } else {
        score = calculateScore({ mode: game.mode, clicks: updatedPlayer.clicks, seconds })
      }

      // Per-node arrival times: seconds since game start for each page visited
      const nodeTimes = updatedPlayer.history.map(h =>
        h.timestamp ? Math.floor((h.timestamp - game.startTime) / 1000) : null
      )
      nodeTimes.push(seconds) // final page (target) arrived at `seconds`

      return NextResponse.json({
        status: 'WIN',
        score,
        clicks: updatedPlayer.clicks,
        time: seconds,
        path: [...updatedPlayer.history.map(h => h.page), title],
        nodeTimes,
        ...extra,
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
