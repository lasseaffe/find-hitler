import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ArticleResultRow from '@/components/study/ArticleResultRow'

export default async function SessionResultsPage({ params }) {
  const authSession = await auth()
  const session = await prisma.studySession.findUnique({
    where: { id: params.id },
    include: {
      pack: { select: { id: true, name: true, subject: true, grade: true } },
      results: { orderBy: { completedAt: 'asc' } },
    },
  })
  if (!session || session.userId !== authSession?.user?.id) notFound()

  const articleIds = session.results.map(r => r.articleId)
  const articles = await prisma.factCheckArticle.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, title: true, mistakes: true },
  })
  const articleMap = Object.fromEntries(articles.map(a => [a.id, a]))

  const pct = Math.round(session.avgAccuracy * 100)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-2xl mx-auto">
      <Link href={`/study/pack/${session.packId}`} className="text-zinc-500 hover:text-white text-sm block mb-6">
        ← {session.pack.name}
      </Link>

      {/* Summary */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-6 text-center">
        <p className="text-4xl font-bold text-white mb-1">{session.totalScore.toLocaleString()}</p>
        <p className="text-sm text-zinc-400 mb-4">total score</p>
        <div className="flex justify-center gap-8 text-sm">
          <div>
            <p className={`text-2xl font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {pct}%
            </p>
            <p className="text-zinc-500 text-xs">accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{session.articlesCompleted}</p>
            <p className="text-zinc-500 text-xs">articles</p>
          </div>
        </div>
      </div>

      {/* Per-article breakdown */}
      <h2 className="text-sm font-semibold text-zinc-400 mb-3">Article breakdown</h2>
      <div className="flex flex-col gap-2 mb-8">
        {session.results.map(r => (
          <ArticleResultRow key={r.id} result={r} article={articleMap[r.articleId]} />
        ))}
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <Link
          href={`/study/pack/${session.packId}/play?difficulty=${session.difficulty}`}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-3 rounded-lg text-center font-medium"
        >
          Play again
        </Link>
        <Link
          href="/study/library"
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-3 rounded-lg text-center"
        >
          Find another pack
        </Link>
      </div>
    </div>
  )
}
