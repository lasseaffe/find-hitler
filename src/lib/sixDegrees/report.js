// src/lib/sixDegrees/report.js

// Pure aggregation over PageDistance-like rows: { startTitle, minClicks, status }.
export function buildReport(rows, { withinThreshold = 6, violationThreshold = 7 } = {}) {
  const exact = rows.filter(r => r.status === 'exact' && typeof r.minClicks === 'number')
  const clicks = exact.map(r => r.minClicks).sort((a, b) => a - b)

  const histogram = {}
  for (const c of clicks) histogram[c] = (histogram[c] || 0) + 1

  const within = clicks.filter(c => c <= withinThreshold).length
  const pctWithinSix = clicks.length ? Math.round((within / clicks.length) * 1000) / 10 : 0

  const sum = clicks.reduce((a, b) => a + b, 0)
  const mean = clicks.length ? Math.round((sum / clicks.length) * 100) / 100 : 0
  const median = clicks.length
    ? (clicks.length % 2
        ? clicks[(clicks.length - 1) / 2]
        : (clicks[clicks.length / 2 - 1] + clicks[clicks.length / 2]) / 2)
    : 0
  const max = clicks.length ? clicks[clicks.length - 1] : 0

  const violations = rows
    .filter(r => r.status !== 'exact' || r.minClicks >= violationThreshold)
    .map(r => ({ startTitle: r.startTitle, minClicks: r.minClicks, status: r.status }))
    .sort((a, b) => (b.minClicks || Infinity) - (a.minClicks || Infinity))

  return { total: rows.length, exactCount: exact.length, histogram, pctWithinSix, mean, median, max, violations }
}

// Render a markdown report from a buildReport() result.
export function renderMarkdown(report, { sampleSize, target, cap, date }) {
  const hist = Object.keys(report.histogram)
    .map(Number).sort((a, b) => a - b)
    .map(c => `| ${c} | ${report.histogram[c]} |`).join('\n')
  const viol = report.violations
    .map(v => `- ${v.startTitle} — ${v.status === 'exact' ? `${v.minClicks} clicks` : v.status}`)
    .join('\n')
  return `# Six Degrees Baseline — ${date}

**Target:** ${target}  **Sample:** ${sampleSize}  **Cap:** ${cap}

## Headline
**${report.pctWithinSix}%** of measured pages reach the target in **≤ 6 clicks** (of ${report.exactCount} exactly-measured pages).

Median: ${report.median} · Mean: ${report.mean} · Max observed: ${report.max}

## Distribution
| clicks | pages |
|---|---|
${hist}

## Six-clicks violators (≥ 7 clicks, capped, or unreachable)
${viol || '_none_'}

## Method
Distances measured over the real body-link graph (the links the live game lets players click), via meet-in-the-middle BFS with a depth cap of ${cap}. "Capped" = minimum exceeds the cap. Wikipedia is a moving snapshot; results reflect the crawl date.
`
}
