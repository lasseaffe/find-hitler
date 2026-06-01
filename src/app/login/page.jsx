'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import HitlerMark from '@/components/ui/HitlerMark'
import { RedButton } from '@/components/ui/primitives'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const verify = searchParams.get('verify')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const res = await signIn('nodemailer', { email, redirect: false })
    setLoading(false)
    if (res?.error) setError('Could not send magic link. Check your email address.')
  }

  if (verify) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm border-4 border-ink bg-paper px-8 py-10 text-center">
          <HitlerMark size={56} className="mx-auto" />
          <h1 className="mt-4 text-2xl">Check your email</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-ink/60">A magic link was sent. Click it to sign in — you can close this tab.</p>
          <a href="/" className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-red">← Back to home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm border-4 border-ink bg-paper">
        <div className="border-b-4 border-ink px-6 py-5 text-center">
          <HitlerMark size={48} className="mx-auto" />
          <h1 className="mt-3 text-3xl">Sign In</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">Magic link by email · no password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
            className="w-full border-[3px] border-ink bg-paper px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
          />
          {error && <p className="font-mono text-xs text-red">{error}</p>}
          <RedButton type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send Magic Link →'}</RedButton>
        </form>
        <a href="/" className="block border-t-4 border-ink py-3 text-center font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-red">← Back · play as guest</a>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <LoginForm />
    </Suspense>
  )
}
