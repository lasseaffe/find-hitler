import { NextResponse } from 'next/server'
import { fetchAndSanitizeWiki, getRandomWikiPage, findStartPageAtDistance } from '@/lib/wikipedia.js'
import { createGame } from '@/lib/gameState.js'
import { getDailyPair } from '@/lib/dailyChallenge.js'
import { getSpeedrunHubs } from '@/lib/speedrunHubs.js'

const VALID_MODES = ['classic', 'speedrun', 'golf', 'jesus', 'daily', 'nohub']

const DIFFICULTY = {
  easy:   { undoTokens: 5, timeLimitSeconds: null,  hubPenalty: false, minHops: 1, maxHops: 2 },
  normal: { undoTokens: 3, timeLimitSeconds: null,  hubPenalty: false, minHops: 3, maxHops: 4 },
  hard:   { undoTokens: 1, timeLimitSeconds: 300,   hubPenalty: false, minHops: 5, maxHops: 6 },
  brutal: { undoTokens: 0, timeLimitSeconds: 300,   hubPenalty: true,  minHops: 6, maxHops: 99 },
}

export async function POST(request) {
  const { target, mode, playerName, difficulty = 'normal', forcedStartPage } = await request.json()

  if (!mode || !playerName) {
    return NextResponse.json({ error: 'Missing mode or playerName' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
  }

  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal
  // nohub mode always has hub penalty regardless of difficulty
  const hubPenalty = diff.hubPenalty || mode === 'nohub'

  let resolvedTarget = target
  let startTitle

  if (forcedStartPage) {
    if (!resolvedTarget) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
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
    if (!resolvedTarget) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
    startTitle = await findStartPageAtDistance(resolvedTarget, diff.minHops, diff.maxHops)
  }

  const { cleanHtml, validLinks, title } = await fetchAndSanitizeWiki(startTitle)

  const playerId = Math.random().toString(36).slice(2, 10)
  const gameId = createGame({
    target: resolvedTarget,
    mode,
    hubPenalty,
    undoTokens: diff.undoTokens,
    timeLimitSeconds: diff.timeLimitSeconds,
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
    target: resolvedTarget,
    clicks: 0,
    undoTokens: diff.undoTokens,
    timeLimitSeconds: diff.timeLimitSeconds,
    jesusRound: mode === 'jesus' ? 1 : null,
  })
}
