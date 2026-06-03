// scripts/six-degrees/c-fetch-sdow.mjs
// Discover + download the latest SDOW SQLite dump from the public GCS bucket,
// then gunzip it. The download (~4.3 GB) only runs when this script is invoked
// directly — it is GATED on explicit go-ahead.
//   node scripts/six-degrees/c-fetch-sdow.mjs --list      (just print latest date)
//   node scripts/six-degrees/c-fetch-sdow.mjs             (download + gunzip)
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const BUCKET = 'sdow-prod'
const LIST_URL = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=dumps/&delimiter=/`
const CACHE_DIR = '.cache/six-degrees'

// Pure: pick the max YYYYMMDD from a GCS JSON listing's `prefixes` array.
export function parseLatestDumpDate(listingJson) {
  const prefixes = (listingJson && listingJson.prefixes) || []
  const dates = prefixes
    .map((p) => (p.match(/dumps\/(\d{8})\//) || [])[1])
    .filter(Boolean)
    .sort()
  return dates.length ? dates[dates.length - 1] : null
}

async function fetchLatestDate() {
  const res = await fetch(LIST_URL)
  if (!res.ok) throw new Error(`GCS listing failed: ${res.status}`)
  const date = parseLatestDumpDate(await res.json())
  if (!date) throw new Error('No dated dump prefixes found; SDOW bucket layout may have changed.')
  return date
}

async function main() {
  const listOnly = process.argv.includes('--list')
  const date = await fetchLatestDate()
  console.log(`Latest SDOW dump: ${date}`)
  if (listOnly) return

  mkdirSync(CACHE_DIR, { recursive: true })
  const gzUrl = `https://storage.googleapis.com/${BUCKET}/dumps/${date}/sdow.sqlite.gz`
  const gzPath = `${CACHE_DIR}/sdow-${date}.sqlite.gz`
  const dbPath = `${CACHE_DIR}/sdow-${date}.sqlite`

  if (existsSync(dbPath)) {
    console.log(`Already present: ${dbPath} (${(statSync(dbPath).size / 1e9).toFixed(1)} GB)`)
    console.log(`Run: python scripts/six-degrees/c_distances.py --db ${dbPath} --dump-date ${date}`)
    return
  }

  if (!existsSync(gzPath)) {
    console.log(`Downloading ${gzUrl} -> ${gzPath} (~4.3 GB, this takes a while)...`)
    const res = await fetch(gzUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(gzPath))
    console.log(`Downloaded ${(statSync(gzPath).size / 1e9).toFixed(1)} GB.`)
  }

  console.log(`Gunzipping -> ${dbPath} ...`)
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(dbPath))
  console.log(`Done: ${dbPath} (${(statSync(dbPath).size / 1e9).toFixed(1)} GB)`)
  console.log(`Next: python scripts/six-degrees/c_distances.py --db ${dbPath} --dump-date ${date}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
