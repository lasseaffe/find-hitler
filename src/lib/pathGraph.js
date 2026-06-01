// src/lib/pathGraph.js
import { getColor } from './resultColors.js'

function nodeId(title) {
  return title.trim().toLowerCase().replace(/\s+/g, '_')
}

function truncate(title) {
  return title.length > 20 ? title.slice(0, 19) + '…' : title
}

export function buildGraph(finishers) {
  if (!finishers.length) return { nodes: [], links: [] }

  const nodeMap = new Map()
  const links = []

  finishers.forEach((finisher, finishIndex) => {
    const color = getColor(finishIndex)
    finisher.path.forEach((title, i) => {
      const id = nodeId(title)
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: truncate(title),
          fullTitle: title,
          isStart: false,
          isTarget: false,
        })
      }
      if (i > 0) {
        links.push({
          source: nodeId(finisher.path[i - 1]),
          target: id,
          targetTitle: title,
          color,
          finishIndex,
        })
      }
    })
  })

  const nodes = Array.from(nodeMap.values())

  const firstPath = finishers[0].path
  if (firstPath.length > 0) {
    const startNode = nodeMap.get(nodeId(firstPath[0]))
    if (startNode) startNode.isStart = true
    const targetNode = nodeMap.get(nodeId(firstPath[firstPath.length - 1]))
    if (targetNode) targetNode.isTarget = true
  }

  return { nodes, links }
}
