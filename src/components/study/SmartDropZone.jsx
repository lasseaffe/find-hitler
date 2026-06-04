'use client'
import { useState, useRef } from 'react'

export default function SmartDropZone({ packId, isPrivate = true, onArticleAdded }) {
  const [mode, setMode] = useState('text')  // 'text' | 'paste'
  const [input, setInput] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [status, setStatus] = useState(null)  // null | 'loading' | 'done' | 'error'
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function submit(formData) {
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/study/ingest', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ingestion failed')
      setStatus('done')
      setInput('')
      onArticleAdded?.(data)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  function handleSubmitText(e) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('text', input)
    fd.set('grade', grade)
    fd.set('subject', subject)
    fd.set('difficulty', difficulty)
    fd.set('isPrivate', String(isPrivate))
    if (packId) fd.set('packId', packId)
    submit(fd)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    fd.set('grade', grade)
    fd.set('subject', subject)
    fd.set('difficulty', difficulty)
    fd.set('isPrivate', String(isPrivate))
    if (packId) fd.set('packId', packId)
    submit(fd)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('text')}
          className={`text-xs px-3 py-1 rounded ${mode === 'text' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
        >
          Topic / URL / Wikipedia
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`text-xs px-3 py-1 rounded ${mode === 'paste' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
        >
          📋 Paste text
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
        >
          📄 Upload file
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFile} />
      </div>

      <form onSubmit={handleSubmitText} className="flex flex-col gap-3">
        {mode === 'text' ? (
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-full"
            placeholder="Topic (e.g. Porter's Five Forces), Wikipedia URL, or any URL…"
            value={input}
            onChange={e => setInput(e.target.value)}
            required
          />
        ) : (
          <textarea
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white w-full min-h-28 resize-y"
            placeholder="Paste your study text here (lecture notes, AI-generated summary, etc.)…"
            value={input}
            onChange={e => setInput(e.target.value)}
            required
          />
        )}

        <div className="flex gap-2 flex-wrap">
          <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white" value={grade} onChange={e => setGrade(e.target.value)}>
            <option value="">Grade (optional)</option>
            {['K1','K2','K3','K4','K5','K6','G7','G8','G9','G10','G11','G12','UNI_Y1','UNI_Y2','UNI_Y3','UNI_Y4','UNI_POSTGRAD'].map(g =>
              <option key={g} value={g}>{g.replace('_', ' ')}</option>
            )}
          </select>
          <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white" value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">Subject (optional)</option>
            {[['BUSINESS_ECONOMICS','Business'],['BIOLOGY','Biology'],['CHEMISTRY','Chemistry'],['PHYSICS','Physics'],['HISTORY','History'],['GEOGRAPHY','Geography'],['PSYCHOLOGY','Psychology'],['MATHEMATICS','Maths'],['TECHNOLOGY','Tech']].map(([v,l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
          <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="hardcore">Hardcore</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded font-medium"
        >
          {status === 'loading' ? 'Generating…' : 'Add to pack →'}
        </button>
      </form>

      {status === 'done' && (
        <p className="text-green-400 text-xs mt-2">✓ Article added successfully</p>
      )}
      {status === 'error' && (
        <p className="text-red-400 text-xs mt-2">✗ {error}</p>
      )}
    </div>
  )
}
