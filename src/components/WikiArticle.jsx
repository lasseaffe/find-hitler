'use client'
import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_ATTR: ['href', 'data-wiki-target', 'class', 'id', 'src', 'alt'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
}

export default function WikiArticle({ html, onNavigate, disabled }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const block = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') e.preventDefault()
    }
    window.addEventListener('keydown', block)
    return () => window.removeEventListener('keydown', block)
  }, [])

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [html])

  const handleClick = (e) => {
    e.preventDefault()
    if (disabled) return
    const anchor = e.target.closest('a[data-wiki-target]')
    if (!anchor) return
    onNavigate(anchor.getAttribute('data-wiki-target'))
  }

  const safeHtml = DOMPurify.sanitize(html, PURIFY_CONFIG)

  // `wiki` enables the brutalist link styling from globals.css (underline -> red on hover).
  // serif prose for Wikipedia readability; display font for headings.
  return (
    <div ref={containerRef}>
      <div
        className="wiki prose prose-neutral max-w-none font-serif text-ink
                   prose-headings:text-ink
                   text-base sm:text-lg leading-relaxed"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  )
}
