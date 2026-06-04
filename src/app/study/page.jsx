import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import PackCard from '@/components/study/PackCard'

const GRADES = ['K1','K2','K3','K4','K5','K6','G7','G8','G9','G10','G11','G12','UNI_Y1','UNI_Y2','UNI_Y3','UNI_Y4','UNI_POSTGRAD']
const SUBJECTS = [['BUSINESS_ECONOMICS','Business'],['BIOLOGY','Biology'],['CHEMISTRY','Chemistry'],['PHYSICS','Physics'],['HISTORY','History'],['GEOGRAPHY','Geography'],['PSYCHOLOGY','Psychology'],['MATHEMATICS','Maths'],['TECHNOLOGY','Tech']]

export default async function StudyPage({ searchParams }) {
  // Guided setup submit: redirect to library with filters
  if (searchParams.grade || searchParams.subject) {
    const params = new URLSearchParams()
    if (searchParams.grade)   params.set('grade',   searchParams.grade)
    if (searchParams.subject) params.set('subject', searchParams.subject)
    redirect(`/study/library?${params}`)
  }

  const popular = await prisma.studyPack.findMany({
    where: { status: { in: ['published', 'community'] } },
    orderBy: { playCount: 'desc' },
    take: 6,
    include: { _count: { select: { articles: true } } },
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-zinc-500 hover:text-white text-sm">← Home</Link>
        <h1 className="text-2xl font-bold">Study Mode</h1>
        <Link href="/study/me" className="ml-auto text-sm text-zinc-400 hover:text-white">My Library →</Link>
      </div>

      {/* AI Intake hero */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-6">
        <p className="text-xs text-red-500 uppercase tracking-widest mb-2">⚡ AI Generate</p>
        <form action="/study/build" method="get" className="flex flex-col gap-3">
          <input
            name="topic"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white w-full"
            placeholder="Describe what you're studying — e.g. Porter's Five Forces, BCG Matrix, value chain, Uni Year 2 Business"
          />
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer bg-zinc-800 border border-dashed border-zinc-600 text-zinc-400 text-xs px-3 py-2 rounded hover:border-zinc-400">
              📄 Upload PDF / DOCX
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={() => {}} />
            </label>
            <span className="text-zinc-600 text-xs self-center">or paste a URL</span>
          </div>
          <button type="submit" className="bg-red-600 hover:bg-red-500 text-white text-sm px-6 py-2.5 rounded-lg font-medium w-fit">
            Generate Study Pack →
          </button>
        </form>
      </div>

      {/* Guided quick bar */}
      <form method="get" className="flex gap-2 mb-8 flex-wrap">
        <select name="grade" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white flex-1 min-w-32">
          <option value="">Grade</option>
          {GRADES.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
        </select>
        <select name="subject" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white flex-1 min-w-32">
          <option value="">Subject</option>
          {SUBJECTS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-5 py-2 rounded">
          Browse →
        </button>
      </form>

      {/* Popular strip */}
      {popular.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400">Popular this week</h2>
            <Link href="/study/library" className="text-xs text-red-500 hover:underline">Browse all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {popular.map(p => <PackCard key={p.id} pack={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}
