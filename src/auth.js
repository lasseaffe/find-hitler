import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Nodemailer from 'next-auth/providers/nodemailer'
import { prisma } from '@/lib/db'

function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function createFriendCodeIfMissing(userId) {
  const existing = await prisma.friendCode.findUnique({ where: { userId } })
  if (existing) return
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.friendCode.create({ data: { userId, code: generateFriendCode() } })
      return
    } catch (e) {
      if (!e.message?.includes('Unique constraint')) throw e
    }
  }
}

// Render's free tier blocks outbound SMTP (ports 25/465/587), so we send the magic
// link via Brevo's transactional HTTPS API (port 443) instead of an SMTP transport.
// Set BREVO_API_KEY (an `xkeysib-…` key from Brevo → SMTP & API → API Keys).
// The sender (EMAIL_FROM address) must be a verified sender in Brevo.
async function sendVerificationRequest({ identifier: email, url, provider }) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not set — cannot send the magic-link email.')
  }
  const from = provider.from || process.env.EMAIL_FROM || ''
  const m = from.match(/<([^>]+)>/)
  const senderEmail = (m ? m[1] : from).trim()
  const senderName = (m ? from.slice(0, m.index).trim() : '') || 'Six Clicks'
  const { host } = new URL(url)

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject: `Sign in to ${host}`,
      htmlContent:
        `<div style="font-family:ui-sans-serif,system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0e0e0e">
           <h2 style="font-family:Impact,'Arial Black',sans-serif;text-transform:uppercase">Sign in</h2>
           <p>Click the button below to sign in. The link expires shortly and can be used once.</p>
           <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;text-decoration:none;font-weight:bold">Sign in →</a></p>
           <p style="color:#666;font-size:12px;word-break:break-all">Or paste this URL into your browser: ${url}</p>
         </div>`,
      textContent: `Sign in: ${url}`,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brevo API error ${res.status}: ${body}`)
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      // `server` is unused (we fully override sendVerificationRequest with the HTTP
      // API), but the provider type requires the field to be present.
      server: { host: 'localhost', port: 587, auth: { user: '', pass: '' } },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (user) session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=true',
  },
  events: {
    async createUser({ user }) {
      if (user.id) await createFriendCodeIfMissing(user.id)
    },
    async signIn({ user }) {
      if (user.id) await createFriendCodeIfMissing(user.id)
    },
  },
})
