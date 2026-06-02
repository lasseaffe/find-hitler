'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminFactChecker() {
  const router = useRouter()

  function sanitize(html) {
    if (typeof window === 'undefined') return html
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DOMPurify = require('dompurify')
    return DOMPurify.sanitize(html)
  }
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/fact-checker?status=${tab}`)
      .then(r => {
        if (r.status === 403) { router.push('/'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setArticles(d.articles ?? [])
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [tab, router])

  async function act(id, action) {
    const res = await fetch('/api/admin/fact-checker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      setArticles(prev => prev.filter(a => a.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e2e8f0] p-8 font-mono">
      <h1 className="text-2xl font-bold mb-6">Fact Checker — Admin Queue</h1>

      <div className="flex gap-4 mb-6">
        {['pending', 'approved', 'rejected'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm uppercase tracking-wider ${
              tab === t ? 'bg-[#2563eb] text-white' : 'bg-[#1e293b] text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-[#64748b]">Loading...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className="text-[#64748b]">No {tab} articles.</p>
      )}

      <div className="flex flex-col gap-6">
        {articles.map(a => (
          <div key={a.id} className="border border-[#334155] rounded p-6 bg-[#1e293b]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{a.subject}</h2>
                <p className="text-[#64748b] text-sm">
                  {a.category} · {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              {tab === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => act(a.id, 'approve')}
                    className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => act(a.id, 'reject')}
                    className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>

            <details className="mb-4">
              <summary className="cursor-pointer text-[#94a3b8] text-sm mb-2 hover:text-[#e2e8f0]">
                Show tampered article
              </summary>
              <div
                className="bg-[#0f172a] p-4 rounded text-sm leading-relaxed max-h-64 overflow-y-auto mt-2"
                dangerouslySetInnerHTML={{ __html: sanitize(a.tampered) }}
              />
            </details>

            <div>
              <p className="text-[#94a3b8] text-xs mb-3 uppercase tracking-wider">Planted mistakes</p>
              <div className="flex flex-col gap-2">
                {(a.mistakes ?? []).map((m, i) => (
                  <div key={i} className="p-3 bg-[#0f172a] rounded">
                    <p className="text-red-400 text-sm">
                      &ldquo;{m.span}&rdquo; → <span className="text-green-400">{m.correct}</span>
                    </p>
                    <p className="text-[#64748b] text-xs mt-1">{m.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
