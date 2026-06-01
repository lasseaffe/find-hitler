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
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117] text-gray-400 font-mono">
        Loading...
      </div>
    )
  }

  return <ResultsScreen results={results} />
}
