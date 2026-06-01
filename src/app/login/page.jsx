'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const verify = searchParams.get('verify')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const res = await signIn('nodemailer', { email, redirect: false })
    setLoading(false)
    if (res?.error) setError('Could not send magic link. Check your email address.')
  }

  if (verify) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h1 className="text-2xl font-black text-yellow-400">Check your email</h1>
          <p className="text-gray-400 font-mono text-sm">
            A magic link was sent. Click it to sign in. You can close this tab.
          </p>
          <a href="/" className="block text-yellow-400/60 hover:text-yellow-400 font-mono text-xs uppercase tracking-widest mt-4">
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-yellow-400 tracking-tight">Sign In</h1>
          <p className="text-gray-400 font-mono text-sm mt-2">Get a magic link by email. No password needed.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[#1a1a2e] border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-yellow-400"
            required
          />
          {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-black rounded-xl uppercase tracking-widest text-sm transition-colors"
          >
            {loading ? 'Sending...' : 'Send Magic Link →'}
          </button>
        </form>
        <a href="/" className="block text-center text-gray-500 hover:text-gray-300 font-mono text-xs uppercase tracking-widest">
          ← Back · play as guest
        </a>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117]" />}>
      <LoginForm />
    </Suspense>
  )
}
