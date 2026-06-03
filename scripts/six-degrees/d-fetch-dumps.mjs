// scripts/six-degrees/d-fetch-dumps.mjs
// Download the 4 enwiki SQL dumps needed to build the link graph (~11 GB total).
// Gated: the download only runs on direct invocation. Skip-if-present.
//   node scripts/six-degrees/d-fetch-dumps.mjs --list   (print the files, no download)
//   node scripts/six-degrees/d-fetch-dumps.mjs          (download all four)
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const BASE = 'https://dumps.wikimedia.org/enwiki/latest'
const CACHE_DIR = '.cache/six-degrees/dumps'

// Pure: the four dump files we need (table -> file + url).
export function dumpFileSpecs() {
  return ['page', 'redirect', 'linktarget', 'pagelinks'].map((table) => {
    const file = `enwiki-latest-${table}.sql.gz`
    return { table, file, url: `${BASE}/${file}` }
  })
}

async function main() {
  const listOnly = process.argv.includes('--list')
  const specs = dumpFileSpecs()
  if (listOnly) {
    for (const s of specs) console.log(`${s.table}\t${s.url}`)
    return
  }
  mkdirSync(CACHE_DIR, { recursive: true })
  for (const s of specs) {
    const dest = `${CACHE_DIR}/${s.file}`
    if (existsSync(dest)) {
      console.log(`Already present: ${dest} (${(statSync(dest).size / 1e9).toFixed(2)} GB)`)
      continue
    }
    console.log(`Downloading ${s.url} -> ${dest} ...`)
    const res = await fetch(s.url)
    if (!res.ok) throw new Error(`Download failed (${s.table}): ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
    console.log(`  done (${(statSync(dest).size / 1e9).toFixed(2)} GB)`)
  }
  console.log('All dumps present. Next:')
  console.log('  python scripts/six-degrees/d_parse_dumps.py')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
