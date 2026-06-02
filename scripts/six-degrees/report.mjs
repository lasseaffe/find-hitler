// scripts/six-degrees/report.mjs
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { buildReport, renderMarkdown } from '../../src/lib/sixDegrees/report.js'

const prisma = new PrismaClient()

export async function writeReport({ target = 'Adolf Hitler', cap = 8 } = {}) {
  const rows = await prisma.pageDistance.findMany({ where: { target, source: 'baseline' } })
  const report = buildReport(rows)
  const date = new Date().toISOString().slice(0, 10)
  mkdirSync('docs/six-degrees', { recursive: true })
  const md = renderMarkdown(report, { sampleSize: rows.length, target, cap, date })
  writeFileSync(`docs/six-degrees/baseline-${date}.md`, md)
  writeFileSync(`docs/six-degrees/baseline-${date}.json`, JSON.stringify(report, null, 2))
  console.log(`Report written: docs/six-degrees/baseline-${date}.md (${rows.length} pages, ${report.pctWithinSix}% within 6)`)
  return report
}

// Allow direct invocation: node scripts/six-degrees/report.mjs
// (pathToFileURL handles Windows drive paths; a bare `file://${argv}` would not match here)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeReport().then(() => prisma.$disconnect())
}
