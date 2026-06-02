// src/app/api/game/start/route.js
import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'
import { getDailyPair } from '@/lib/dailyChallenge.js'
import { getSpeedrunHubs } from '@/lib/speedrunHubs.js'

const VALID_MODES = ['classic', 'speedrun', 'golf', 'jesus', 'daily', 'nohub']

export async function POST(request) {
  const { target, mode, playerName, hardcore = false, forcedStartPage } = await request.json()

  if (!mode || !playerName) {
    return NextResponse.json({ error: 'Missing mode or playerName' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
  }

  let resolvedTarget = target
  let startTitle

  // Challenge context: use the same start page as the challenger
  if (forcedStartPage) {
    if (!resolvedTarget) {
      return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    }
    startTitle = forcedStartPage
  } else if (mode === 'daily') {
    const pair = getDailyPair()
    resolvedTarget = pair.target
    startTitle = pair.start
  } else if (mode === 'jesus') {
    resolvedTarget = 'Jesus'
    startTitle = await getRandomWikiPage()
  } else if (mode === 'speedrun') {
    const hubs = getSpeedrunHubs(resolvedTarget)
    startTitle = hubs[Math.floor(Math.random() * hubs.length)]
  } else {
    // classic, golf, nohub — random start
    if (!resolvedTarget) {
      return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    }
    startTitle = await getRandomWikiPage()
  }

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
  const gameId = createGame({
    target: resolvedTarget,
    mode,
    hardcore,
    playerId,
    playerName,
    startPage: title,
    cleanHtml,
    validLinks,
  })

  const timeLimitSeconds = mode === 'golf' ? 300
    : (mode === 'classic' && hardcore) ? 300
    : (mode === 'speedrun' && hardcore) ? 150
    : null

  return NextResponse.json({
    gameId,
    playerId,
    html: cleanHtml,
    title,
    target: resolvedTarget,
    clicks: 0,
    undoTokens: hardcore ? 0 : 3,
    timeLimitSeconds,
    jesusRound: mode === 'jesus' ? 1 : null,
  })
}
