import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { buildSessionUpdate } from '@/lib/study/sessionHelpers'

export async function GET(_, { params }) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthenticated' }, { status: 401 })
  const s = await prisma.studySession.findUnique({
    where: { id: params.id },
    include: {
      pack: { include: { articles: { orderBy: { order: 'asc' } } } },
      results: { orderBy: { completedAt: 'asc' } },
    },
  })
  if (!s || s.userId !== session.user.id) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(s)
}

// Called after each article: body = { articleId, score, correctCount, wrongCount, timeTaken, missedMistakes }
export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthenticated' }, { status: 401 })

  const s = await prisma.studySession.findUnique({
    where: { id: params.id },
    include: { pack: { include: { _count: { select: { articles: true } } } } },
  })
  if (!s || s.userId !== session.user.id) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  await prisma.studyResult.create({
    data: {
      sessionId:    params.id,
      articleId:    body.articleId,
      score:        body.score,
      correctCount: body.correctCount,
      wrongCount:   body.wrongCount,
      timeTaken:    body.timeTaken,
    },
  })

  const updateData = buildSessionUpdate(s, body, { totalArticles: s.pack._count.articles })
  const updated = await prisma.studySession.update({
    where: { id: params.id },
    data: updateData,
  })
  return Response.json(updated)
}
