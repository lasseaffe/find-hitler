// scripts/six-degrees/run-baseline.mjs
// Usage: node scripts/six-degrees/run-baseline.mjs --sample 1000 --cap 8 --backward-depth 3 --concurrency 4
import { PrismaClient } from '@prisma/client'
import { getRandomWikiPage } from '../../src/lib/wikipedia.js'
import { createDiskCache, getBodyLinks } from '../../src/lib/sixDegrees/bodyLinkCache.js'
import { precomputeReverseLayers, measureDistance } from '../../src/lib/sixDegrees/distanceEngine.js'
import { canonicalize } from '../../src/lib/sixDegrees/titleCanon.js'
import { writeReport } from './report.mjs'

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

const SAMPLE = Number(arg('sample', 1000))
const TARGET = arg('target', 'Adolf Hitler')
const CAP = Number(arg('cap', 8))
const BACKWARD = Number(arg('backward-depth', 3))
const CONCURRENCY = Number(arg('concurrency', 4))
const CACHE_FILE = '.cache/six-degrees/bodylinks.ndjson'

const prisma = new PrismaClient()
const cache = createDiskCache(CACHE_FILE)
const links = (title) => getBodyLinks(title, { cache })

// Simple polite throttle: bounded concurrency over a task list.
async function mapLimit(items, limit, fn) {
  const results = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const cur = idx++
      results[cur] = await fn(items[cur], cur)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function main() {
  console.log(`Precomputing reverse layers for "${TARGET}" (depth ${BACKWARD})...`)
  const reverseLayers = await precomputeReverseLayers(TARGET, BACKWARD, { getLinks: links })
  console.log(`Reverse map size: ${reverseLayers.size}`)

  // Draw a deduped random sample (skip pages already measured).
  const titles = new Set()
  while (titles.size < SAMPLE) {
    const t = canonicalize(await getRandomWikiPage())
    if (titles.has(t)) continue
    const existing = await prisma.pageDistance.findUnique({
      where: { startTitle_target: { startTitle: t, target: TARGET } },
    })
    if (existing) continue
    titles.add(t)
  }

  let done = 0
  await mapLimit([...titles], CONCURRENCY, async (start) => {
    const { minClicks, path, status } = await measureDistance(start, TARGET, {
      cap: CAP, backwardDepth: BACKWARD, reverseLayers, getLinks: links,
    })
    await prisma.pageDistance.upsert({
      where: { startTitle_target: { startTitle: start, target: TARGET } },
      update: { minClicks, shortestPath: path, status, source: 'baseline', measuredAt: new Date() },
      create: { startTitle: start, target: TARGET, minClicks, shortestPath: path, status, source: 'baseline' },
    })
    done++
    if (done % 25 === 0) console.log(`  measured ${done}/${titles.size}`)
  })

  console.log(`Measured ${done} pages. Writing report...`)
  await writeReport({ target: TARGET, cap: CAP })
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
