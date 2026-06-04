/**
 * Pure function: given current session state + new article result,
 * return the Prisma update payload for StudySession.
 */
export function buildSessionUpdate(current, result, opts = {}) {
  const completed = current.articlesCompleted + 1
  const totalScore = current.totalScore + result.score
  const accuracy = result.correctCount / Math.max(1, result.correctCount + result.wrongCount)
  const avgAccuracy = (current.avgAccuracy * current.articlesCompleted + accuracy) / completed

  const update = {
    articlesCompleted: completed,
    totalScore,
    avgAccuracy,
    lastPlayedAt: new Date(),
  }
  if (opts.totalArticles && completed >= opts.totalArticles) {
    update.completedAt = new Date()
  }
  return update
}
