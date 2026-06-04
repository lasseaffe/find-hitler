import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const { name, description, subject, grade, curriculum, status = 'draft' } = await request.json()

    if (!name || !subject || !grade) {
      return Response.json(
        { error: 'name, subject, and grade are required' },
        { status: 400 }
      )
    }

    const pack = await prisma.studyPack.create({
      data: {
        name,
        description,
        subject,
        grade,
        curriculum,
        authorId: session?.user?.id ?? null,
        status,
        source: 'ai',
      },
    })

    return Response.json(pack, { status: 201 })
  } catch (error) {
    console.error('POST /api/study/pack error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
