import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'node:fs'
import { generateTamperedArticle } from '../src/lib/factCheckerGen.js'

if (!process.env.DATABASE_URL) {
  console.error('Run with --env-file=.env.local (DATABASE_URL required).')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required for tampering.')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const count = parseInt(arg('count', '5'), 10)
const difficulty = arg('difficulty', 'medium')
const category = arg('category', 'history')
const subjectsFile = arg('subjects', null)

const subjects = subjectsFile
  ? readFileSync(subjectsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : Array.from({ length: count }, () => null) // null → random per article

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

let created = 0, failed = 0
for (const subject of subjects.slice(0, subjectsFile ? subjects.length : count)) {
  try {
    const draft = await generateTamperedArticle(subject, difficulty, category)
    await db.factCheckArticle.create({ data: draft })
    created += 1
    console.log(`✓ ${draft.subject} (${draft.mistakes.length} mistakes, ${draft.decoys.length} decoys) → pending`)
  } catch (err) {
    failed += 1
    console.warn(`✗ ${subject ?? '(random)'}: ${err.message}`)
  }
}
console.log(`\nDone: ${created} created (pending), ${failed} failed.`)
await db.$disconnect()
