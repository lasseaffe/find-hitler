'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SmartDropZone from '@/components/study/SmartDropZone'

export default function BuildPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const existingPackId = searchParams.get('packId')

  const [packId, setPackId] = useState(existingPackId)
  const [articles, setArticles] = useState([])
  const [packName, setPackName] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)

  // Load existing pack if editing
  useEffect(() => {
    if (!existingPackId) return
    fetch(`/api/study/pack/${existingPackId}`)
      .then(r => r.json())
      .then(data => {
        setPackName(data.name ?? '')
        setGrade(data.grade ?? '')
        setSubject(data.subject ?? '')
        setArticles(data.articles?.map(a => ({ ...a.article, order: a.order })) ?? [])
      })
  }, [existingPackId])

  function handleArticleAdded(data) {
    setArticles(prev => [...prev, { id: data.articleId, title: data.title, generatedFrom: data.type }])
  }

  async function ensurePack() {
    if (packId) return packId
    const res = await fetch('/api/study/pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: packName || 'My Pack', subject: subject || 'OTHER', grade: grade || 'UNI_Y1' }),
    })
    const data = await res.json()
    setPackId(data.id)
    return data.id
  }

  async function handlePublish(status) {
    setSaving(true)
    const id = await ensurePack()
    await fetch(`/api/study/pack/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: packName, grade, subject, status }),
    })
    router.push(`/study/pack/${id}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="/study" className="text-zinc-500 hover:text-white text-sm">← Study</a>
        <h1 className="text-xl font-bold">{existingPackId ? 'Edit Pack' : 'Build Pack'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: metadata + drop zone */}
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-300">Pack details</h2>
            <input
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              placeholder="Pack name…"
              value={packName}
              onChange={e => setPackName(e.target.value)}
            />
            <div className="flex gap-2">
              <select className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white" value={grade} onChange={e => setGrade(e.target.value)}>
                <option value="">Grade</option>
                {['K1','K2','K3','K4','K5','K6','G7','G8','G9','G10','G11','G12','UNI_Y1','UNI_Y2','UNI_Y3','UNI_Y4','UNI_POSTGRAD'].map(g =>
                  <option key={g} value={g}>{g.replace('_', ' ')}</option>
                )}
              </select>
              <select className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white" value={subject} onChange={e => setSubject(e.target.value)}>
                <option value="">Subject</option>
                {[['BUSINESS_ECONOMICS','Business'],['BIOLOGY','Biology'],['CHEMISTRY','Chemistry'],['PHYSICS','Physics'],['HISTORY','History'],['GEOGRAPHY','Geography'],['PSYCHOLOGY','Psychology'],['MATHEMATICS','Maths'],['TECHNOLOGY','Tech']].map(([v,l]) =>
                  <option key={v} value={v}>{l}</option>
                )}
              </select>
            </div>
          </div>

          <SmartDropZone
            packId={packId}
            isPrivate={true}
            onArticleAdded={handleArticleAdded}
          />
        </div>

        {/* Right: pack article list */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-zinc-300">Pack ({articles.length} articles)</h2>
          </div>

          {articles.length === 0 ? (
            <div className="text-zinc-600 text-sm py-8 text-center">
              Add articles using the form on the left
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {articles.map((a, i) => (
                <div key={a.id} className="bg-zinc-800 border border-zinc-700 rounded p-3 flex items-center gap-3">
                  <span className="text-zinc-600 text-xs">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{a.title}</p>
                    <p className="text-xs text-zinc-500">{a.generatedFrom}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="flex gap-2 mt-auto pt-3 border-t border-zinc-800">
              <button
                onClick={() => handlePublish('published')}
                disabled={saving}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 rounded"
              >
                Save private
              </button>
              <button
                onClick={() => handlePublish('community')}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded"
              >
                Publish to community →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
