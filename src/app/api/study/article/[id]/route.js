import { prisma } from '@/lib/db'
import { stripTruthForClient } from '@/lib/factCheckerGen'

// Returns the article's tampered HTML with truth stripped for the browser.
// Only serves articles with status 'approved'.
export async function GET(_, { params }) {
  const article = await prisma.factCheckArticle.findUnique({
    where: { id: params.id, status: 'approved' },
    select: { id: true, title: true, difficulty: true, tampered: true, mistakes: true, decoys: true },
  })
  if (!article) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({
    ...article,
    tampered: stripTruthForClient(article.tampered, article.difficulty),
  })
}
