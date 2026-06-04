import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(request) {
  try {
    const session = await auth()
    const { name, description, subject, grade, curriculum, status = 'draft' } = await request.json()

    if (!name || !subject || !grade) {
      return NextResponse.json(
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

    return NextResponse.json(pack, { status: 201 })
  } catch (error) {
    console.error('POST /api/study/pack error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
