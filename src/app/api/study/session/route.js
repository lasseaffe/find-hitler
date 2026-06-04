import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthenticated' }, { status: 401 })
  const { packId, difficulty = 'medium' } = await request.json()
  const pack = await prisma.studyPack.findUnique({ where: { id: packId } })
  if (!pack) return Response.json({ error: 'Pack not found' }, { status: 404 })

  const studySession = await prisma.studySession.create({
    data: { userId: session.user.id, packId, difficulty },
  })
  // Bump play count
  await prisma.studyPack.update({ where: { id: packId }, data: { playCount: { increment: 1 } } })
  return Response.json(studySession, { status: 201 })
}
