// src/components/NodeGraph.jsx
'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const WIDTH = 600
const HEIGHT = 400
const NODE_R = 18

export default function NodeGraph({ nodes, links }) {
  const [positions, setPositions] = useState({})
  const simRef = useRef(null)

  useEffect(() => {
    if (!nodes.length) return

    // Deep-clone so D3 can mutate x/y without touching React state objects
    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = links.map(l => ({ ...l }))

    simRef.current?.stop()
    simRef.current = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(90).strength(1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collision', d3.forceCollide(NODE_R + 8))
      .on('tick', () => {
        const pos = {}
        simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
        setPositions({ ...pos })
      })

    return () => simRef.current?.stop()
  }, [nodes, links])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full border border-yellow-400/20 rounded-xl bg-[#0d1117]"
      style={{ maxHeight: 400 }}
    >
      {/* Links */}
      {links.map((link, i) => {
        const s = positions[link.source]
        const t = positions[link.target]
        if (!s || !t) return null
        const isWinner = link.finishIndex === 0
        return (
          <line
            key={i}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={link.color}
            strokeWidth={isWinner ? 3 : 1.5}
            strokeOpacity={isWinner ? 0.9 : 0.6}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions[node.id]
        if (!pos) return null
        const fill = node.isTarget ? '#c0392b' : '#1a1a2e'
        const stroke = node.isStart ? '#f1c40f' : node.isTarget ? '#c0392b' : '#4a5568'
        const strokeW = node.isStart || node.isTarget ? 3 : 1.5
        return (
          <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
            <title>{node.fullTitle}</title>
            <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={strokeW} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill={node.isTarget ? '#fff' : '#e2e8f0'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
