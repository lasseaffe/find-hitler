import { prisma } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const grade   = searchParams.get('grade')
  const subject = searchParams.get('subject')
  const q       = searchParams.get('q')
  const page    = parseInt(searchParams.get('page') ?? '1', 10)
  const take    = 20

  const where = {
    status: { in: ['published', 'community'] },
    ...(grade   ? { grade }   : {}),
    ...(subject ? { subject } : {}),
    ...(q       ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }

  const [packs, total] = await Promise.all([
    prisma.studyPack.findMany({
      where,
      orderBy: { playCount: 'desc' },
      skip: (page - 1) * take,
      take,
      include: {
        author: { select: { name: true, avatarEmoji: true } },
        _count: { select: { articles: true } },
      },
    }),
    prisma.studyPack.count({ where }),
  ])
  return Response.json({ packs, total, page, pages: Math.ceil(total / take) })
}
