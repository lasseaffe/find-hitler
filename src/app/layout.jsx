import './globals.css'
import { Anton, Space_Mono } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import PWARegister from '@/components/PWARegister'
import { auth } from '@/auth'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-anton',
})

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-mono',
})

export const metadata = {
  title: 'FIND HITLER — WikiRace',
  description: 'A Wikipedia navigation race. Find the target in the fewest clicks.',
  applicationName: 'Find Hitler',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Find Hitler' },
  icons: { icon: '/icon-192.png', apple: '/apple-icon.png' },
}

export const viewport = {
  themeColor: '#0E0E0E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }) {
  const session = await auth()
  const uid = session?.user?.id ?? ''
  return (
    <html lang="en" className={`${anton.variable} ${spaceMono.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased" data-uid={uid}>
        <PWARegister />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
