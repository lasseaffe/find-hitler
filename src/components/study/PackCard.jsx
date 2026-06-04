'use client'

const SUBJECT_LABELS = {
  BUSINESS_ECONOMICS: 'Business',
  BIOLOGY: 'Biology', CHEMISTRY: 'Chemistry', PHYSICS: 'Physics',
  HISTORY: 'History', GEOGRAPHY: 'Geography',
  PSYCHOLOGY: 'Psychology', SOCIOLOGY: 'Sociology',
  MATHEMATICS: 'Maths', LANGUAGES_LIT: 'Lit', TECHNOLOGY: 'Tech',
}

export default function PackCard({ pack, href }) {
  return (
    <a
      href={href ?? `/study/pack/${pack.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-red-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white leading-tight">{pack.name}</h3>
        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded shrink-0">
          {SUBJECT_LABELS[pack.subject] ?? pack.subject}
        </span>
      </div>
      {pack.description && (
        <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{pack.description}</p>
      )}
      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <span>{pack.grade?.replace('_', ' ')}</span>
        <div className="flex items-center gap-2">
          {pack._count?.articles != null && <span>{pack._count.articles} articles</span>}
          {pack.playCount > 0 && <span>{pack.playCount.toLocaleString()} plays</span>}
          {pack.avgRating && <span>★ {pack.avgRating.toFixed(1)}</span>}
        </div>
      </div>
    </a>
  )
}
