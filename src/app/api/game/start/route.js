import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const mode = body.mode ?? 'classic'
    const target = body.target ?? 'Adolf Hitler'
    const playerId = body.playerId ?? `player-${Math.random().toString(36).slice(2, 8)}`
    const playerName = body.playerName ?? 'Anonymous'

    const startTitle = await getRandomWikiPage()
    const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

    const gameId = createGame({
      target,
      mode,
      playerId,
      playerName,
      startPage: title,
      cleanHtml,
      validLinks,
    })

    return NextResponse.json({
      gameId,
      playerId,
      title,
      cleanHtml,
      validLinks,
      clicks: 0,
      undoTokens: 3,
      target,
      mode,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
