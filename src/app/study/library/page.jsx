'use client'
import { useState, useEffect } from 'react'
import PackCard from '@/components/study/PackCard'

const GRADES = ['K1','K2','K3','K4','K5','K6','G7','G8','G9','G10','G11','G12','UNI_Y1','UNI_Y2','UNI_Y3','UNI_Y4','UNI_POSTGRAD']
const SUBJECTS = ['BUSINESS_ECONOMICS','BIOLOGY','CHEMISTRY','PHYSICS','HISTORY','GEOGRAPHY','PSYCHOLOGY','SOCIOLOGY','MATHEMATICS','LANGUAGES_LIT','TECHNOLOGY']
const SUBJECT_LABELS = { BUSINESS_ECONOMICS:'Business',BIOLOGY:'Biology',CHEMISTRY:'Chemistry',PHYSICS:'Physics',HISTORY:'History',GEOGRAPHY:'Geography',PSYCHOLOGY:'Psychology',SOCIOLOGY:'Sociology',MATHEMATICS:'Maths',LANGUAGES_LIT:'Lit',TECHNOLOGY:'Tech' }

export default function LibraryPage() {
  const [packs, setPacks] = useState([])
  const [total, setTotal] = useState(0)
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (grade)   params.set('grade',   grade)
    if (subject) params.set('subject', subject)
    if (q)       params.set('q',       q)
    fetch(`/api/study/library?${params}`)
      .then(r => r.json())
      .then(d => { setPacks(d.packs ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [grade, subject, q])

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="/study" className="text-zinc-500 hover:text-white text-sm">← Study</a>
        <h1 className="text-xl font-bold">Study Library</h1>
        <span className="text-zinc-500 text-sm ml-auto">{total} packs</span>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-40"
          placeholder="Search packs…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={grade} onChange={e => setGrade(e.target.value)}
        >
          <option value="">All grades</option>
          {GRADES.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
        </select>
        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={subject} onChange={e => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
        </select>
        {(grade || subject || q) && (
          <button
            className="text-zinc-500 hover:text-white text-sm"
            onClick={() => { setGrade(''); setSubject(''); setQ('') }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-zinc-600 text-sm">Loading…</div>
      ) : packs.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-lg mb-2">No packs found</p>
          <a href="/study/build" className="text-red-500 text-sm hover:underline">Build one →</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map(p => <PackCard key={p.id} pack={p} />)}
        </div>
      )}
    </div>
  )
}
