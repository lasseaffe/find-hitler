// PWA manifest — served by Next at /manifest.webmanifest (auto-linked in <head>).
export default function manifest() {
  return {
    name: 'Six Clicks',
    short_name: 'Six Clicks',
    description: 'A Wikipedia navigation race. Find the target in the fewest clicks.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f0e8',
    theme_color: '#0e0e0e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
