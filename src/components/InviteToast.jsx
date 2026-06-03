'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function InviteToast() {
  const router = useRouter()
  const [toasts, setToasts] = useState([])

  // Fetch any pending invites on mount (for users who were offline)
  useEffect(() => {
    fetch('/api/lobby/invites/pending')
      .then(r => r.json())
      .then(({ invites }) => {
        if (invites?.length) {
          setToasts(prev => [
            ...prev,
            ...invites.map(i => ({ id: i.id, fromName: i.fromName, lobbyCode: i.lobbyCode, target: '', mode: '' })),
          ])
        }
      })
      .catch(() => {})
  }, [])

  useSocket({
    'lobby:invite': (data) => {
      setToasts(prev => [...prev, { id: Date.now().toString(), ...data }])
    },
  })

  if (toasts.length === 0) return null

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function join(lobbyCode, id) {
    dismiss(id)
    router.push(`/join/${lobbyCode}`)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-xs w-full">
      {toasts.map(t => (
        <div key={t.id} className="border-4 border-ink bg-paper p-4 shadow-lg">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 mb-1">Lobby Invite</p>
          <p className="font-display text-lg uppercase leading-none mb-1">{t.fromName}</p>
          {t.target && (
            <p className="font-mono text-[11px] text-ink/60">
              → {t.target.toUpperCase()} · {t.mode.toUpperCase()}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => join(t.lobbyCode, t.id)}
              className="flex-1 bg-red text-paper font-display uppercase text-sm py-2 tracking-[0.06em]"
            >
              JOIN
            </button>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-1 border-[3px] border-ink font-display uppercase text-sm py-2 tracking-[0.06em]"
            >
              DISMISS
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
