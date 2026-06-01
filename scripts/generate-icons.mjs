// Generate PWA icons from the Hitler mark (ink bg, paper mark). $0, no design tool.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
mkdirSync(pub, { recursive: true })

const HAIR = 'M 36 96 C 28 52, 62 22, 108 22 C 152 22, 174 50, 170 92 C 162 74, 146 66, 130 70 C 128 56, 120 50, 108 50 C 92 50, 78 60, 70 74 C 60 80, 46 86, 36 96 Z'

// mark scaled into a `size` canvas; `scale` ~ how big the 200-unit mark is relative to canvas
function svg(size, scale, bg = '#0e0e0e', fg = '#f5f0e8') {
  const marked = 200 * scale
  const off = (size - marked) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    <g transform="translate(${off},${off}) scale(${scale})">
      <path d="${HAIR}" fill="${fg}"/>
      <rect x="89" y="114" width="22" height="26" fill="${fg}"/>
    </g>
  </svg>`
}

async function png(name, size, scale) {
  await sharp(Buffer.from(svg(size, scale))).png().toFile(join(pub, name))
  console.log('wrote', name)
}

await png('icon-192.png', 192, 192 / 200 * 0.66)
await png('icon-512.png', 512, 512 / 200 * 0.66)
// maskable: mark kept inside the ~80% safe zone (smaller scale + full-bleed ink bg)
await png('icon-maskable-512.png', 512, 512 / 200 * 0.5)
// apple-touch (iOS adds its own rounded mask; no transparency)
await png('apple-icon.png', 180, 180 / 200 * 0.66)
console.log('done')
