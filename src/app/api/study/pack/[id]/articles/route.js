import { prisma } from '@/lib/db'

// PATCH: Reorder articles in a pack
// Body: { order: ['articleId1', 'articleId2', ...] }
export async function PATCH(request, { params }) {
  try {
    const { order } = await request.json()

    if (!Array.isArray(order)) {
      return Response.json(
        { error: 'order must be an array' },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      order.map((articleId, i) =>
        prisma.studyPackArticle.update({
          where: { packId_articleId: { packId: params.id, articleId } },
          data: { order: i },
        })
      )
    )

    return Response.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/study/pack/[id]/articles error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Remove an article from a pack
// Body: { articleId }
export async function DELETE(request, { params }) {
  try {
    const { articleId } = await request.json()

    await prisma.studyPackArticle.delete({
      where: { packId_articleId: { packId: params.id, articleId } },
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/study/pack/[id]/articles error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
