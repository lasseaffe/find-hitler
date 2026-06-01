export function calculateScore({ mode, clicks, seconds }) {
  if (mode === 'speedrun') {
    return Math.max(0, 10000 - seconds * 100 - clicks * 50)
  }
  return Math.max(0, 10000 - clicks * 500 - seconds * 10)
}
