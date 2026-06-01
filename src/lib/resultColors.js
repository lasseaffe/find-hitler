// src/lib/resultColors.js
const COLORS = ['#2ecc71', '#e74c3c', '#e67e22', '#3498db']
const FALLBACK = '#95a5a6'

export function getColor(finishIndex) {
  return COLORS[finishIndex] ?? FALLBACK
}
