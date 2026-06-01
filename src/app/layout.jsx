import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata = { title: 'Find Hitler — WikiRace' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa] text-[#202122]">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
