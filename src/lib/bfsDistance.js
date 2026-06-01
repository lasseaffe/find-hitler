const MAX_DEPTH = 6
const DAMAGE_PER_HOP = 500
const MAX_DAMAGE = 2500

async function defaultFetchLinks(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=links&pllimit=500&format=json&origin=*`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const pages = Object.values(data.query?.pages || {})
    if (!pages[0]?.links) return []
    return pages[0].links.map(l => l.title)
  } catch {
    return []
  }
}

export async function calculateHpDamage(currentPage, target, { fetchLinks = defaultFetchLinks } = {}) {
  function normTitle(t) {
    return t.replace(/_/g, ' ').trim().toLowerCase()
  }

  const normTarget = normTitle(target)
  const visited = new Set([normTitle(currentPage)])
  let frontier = [currentPage]

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const nextFrontier = []
    const linkPromises = frontier.map(page => fetchLinks(page))
    const results = await Promise.all(linkPromises)

    for (const links of results) {
      for (const link of links) {
        if (normTitle(link) === normTarget) return depth * DAMAGE_PER_HOP
        const norm = normTitle(link)
        if (!visited.has(norm)) {
          visited.add(norm)
          nextFrontier.push(link)
        }
      }
    }

    frontier = nextFrontier
    if (frontier.length === 0) return MAX_DAMAGE
  }

  return MAX_DAMAGE
}
