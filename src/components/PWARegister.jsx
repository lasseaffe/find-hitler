'use client'
import { useEffect } from 'react'

// Registers the service worker in production only (a SW fighting Turbopack HMR
// in dev causes stale-asset issues).
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
