// src/app/results/page.jsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ResultsScreen from '@/components/ResultsScreen'

export default function ResultsPage() {
  const router = useRouter()
  const [results, setResults] = useState(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('gameResults')
    if (!raw) { router.push('/'); return }
    sessionStorage.removeItem('gameResults')
    setResults(JSON.parse(raw))
  }, [router])

  if (!results) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-widest text-ink/60">
        Loading…
      </div>
    )
  }

  return <ResultsScreen results={results} />
}
