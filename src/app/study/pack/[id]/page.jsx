import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function PackDetailPage({ params }) {
  const pack = await prisma.studyPack.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { name: true, avatarEmoji: true } },
      articles: {
        orderBy: { order: 'asc' },
        include: { article: { select: { id: true, title: true, difficulty: true, generatedFrom: true } } },
      },
      _count: { select: { sessions: true } },
    },
  })
  if (!pack) notFound()

  const SOURCE_BADGE = { wiki: '🌐', ai: '🤖', upload: '📄', paste: '📋', url: '🔗' }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/study/library" className="text-zinc-500 hover:text-white text-sm">← Library</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{pack.name}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{pack.grade?.replace('_', ' ')}</span>
          <span>·</span>
          <span>{pack.subject?.replace('_', ' ')}</span>
          {pack.author && <><span>·</span><span>by {pack.author.avatarEmoji} {pack.author.name}</span></>}
          <span>·</span>
          <span>{pack._count.sessions} sessions played</span>
        </div>
        {pack.description && <p className="text-sm text-zinc-400 mt-2">{pack.description}</p>}
      </div>

      {/* Article list */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">{pack.articles.length} articles</h2>
        <div className="flex flex-col gap-2">
          {pack.articles.map((pa, i) => (
            <div key={pa.articleId} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
              <span className="text-zinc-600 text-xs w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{pa.article.title}</p>
                <p className="text-xs text-zinc-500">{pa.article.difficulty} · {SOURCE_BADGE[pa.article.generatedFrom] ?? '📝'} {pa.article.generatedFrom}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Play CTAs */}
      <div className="flex gap-3 flex-wrap">
        {['easy','medium','hard','hardcore'].map(d => (
          <Link
            key={d}
            href={`/study/pack/${params.id}/play?difficulty=${d}`}
            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg text-sm font-medium capitalize"
          >
            Play {d}
          </Link>
        ))}
        <Link
          href={`/study/build?packId=${params.id}`}
          className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-lg text-sm"
        >
          Edit pack
        </Link>
      </div>
    </div>
  )
}
