import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import PackCard from '@/components/study/PackCard'

export default async function MyLibraryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/study/me')

  const [myPacks, recentSessions] = await Promise.all([
    prisma.studyPack.findMany({
      where: { authorId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { articles: true, sessions: true } } },
    }),
    prisma.studySession.findMany({
      where: { userId: session.user.id },
      orderBy: { lastPlayedAt: 'desc' },
      take: 10,
      include: {
        pack: { select: { id: true, name: true, subject: true, grade: true } },
      },
    }),
  ])

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/study" className="text-zinc-500 hover:text-white text-sm">← Study</Link>
        <h1 className="text-xl font-bold">My Library</h1>
        <Link href="/study/build" className="ml-auto bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded">
          + New pack
        </Link>
      </div>

      {/* My packs */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">My packs ({myPacks.length})</h2>
        {myPacks.length === 0 ? (
          <div className="text-center py-10 text-zinc-600">
            <p className="mb-2">No packs yet</p>
            <Link href="/study/build" className="text-red-500 text-sm hover:underline">Build your first pack →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myPacks.map(p => (
              <div key={p.id} className="relative">
                <PackCard pack={p} />
                <Link
                  href={`/study/build?packId=${p.id}`}
                  className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-300 text-xs"
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Recent sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="text-zinc-600 text-sm">No sessions yet — play a pack to see your history here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map(s => (
              <Link
                key={s.id}
                href={`/study/session/${s.id}/results`}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-lg p-3 flex items-center gap-4 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.pack.name}</p>
                  <p className="text-xs text-zinc-500">{s.difficulty} · {s.articlesCompleted} articles · {new Date(s.lastPlayedAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{s.totalScore.toLocaleString()} pts</p>
                  <p className="text-xs text-zinc-500">{Math.round(s.avgAccuracy * 100)}% accuracy</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
