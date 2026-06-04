import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_, { params }) {
  try {
    const pack = await prisma.studyPack.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarEmoji: true,
            avatarColor: true,
          },
        },
        articles: {
          orderBy: { order: 'asc' },
          include: {
            article: {
              select: {
                id: true,
                title: true,
                difficulty: true,
                subject: true,
                grade: true,
                generatedFrom: true,
              },
            },
          },
        },
        ratings: {
          select: {
            rating: true,
            comment: true,
            user: { select: { name: true } },
          },
        },
        _count: { select: { sessions: true } },
      },
    })

    if (!pack) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return Response.json(pack)
  } catch (error) {
    console.error('GET /api/study/pack/[id] error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await auth()

    const pack = await prisma.studyPack.findUnique({
      where: { id: params.id },
    })

    if (!pack) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    // Only allow the author to update their pack
    if (pack.authorId && pack.authorId !== session?.user?.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const allowed = ['name', 'description', 'subject', 'grade', 'curriculum', 'status']
    const update = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    )

    const updated = await prisma.studyPack.update({
      where: { id: params.id },
      data: update,
    })

    return Response.json(updated)
  } catch (error) {
    console.error('PATCH /api/study/pack/[id] error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
