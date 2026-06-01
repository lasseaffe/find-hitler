import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'

export async function POST(request) {
  const { target, mode, playerName } = await request.json()

  if (!target || !mode || !playerName) {
    return NextResponse.json({ error: 'Missing target, mode, or playerName' }, { status: 400 })
  }

  const startTitle = await getRandomWikiPage()
  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
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
    html: cleanHtml,
    title,
    clicks: 0,
    undoTokens: 3,
  })
}
