'use client'
import { useRef } from 'react'

// Strip characters that could break out of an HTML attribute or tag context.
// The html prop is server-generated game content (not user input), so full
// DOMPurify is unnecessary. We only need to guard the data-span attribute
// value, which is derived from the spans array (also server-generated).
function safeAttr(str) {
  return str.replace(/[<>"'`]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]))
}

// Renders the tampered Wikipedia article with accusation mechanic.
// Easy/Medium: clickable pre-marked span buttons injected into HTML.
// Hard/Hardcore: free-text mouse selection fires accusation.
export default function FactCheckerArticle({ html, spans, difficulty, onAccuse, accused }) {
  const articleRef = useRef(null)
  const isHard = difficulty === 'hard' || difficulty === 'hardcore'

  // Free-text handler for hard/hardcore
  function handleMouseUp() {
    if (!isHard) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (text.length < 2) return
    onAccuse(text)
    sel.removeAllRanges()
  }

  // Inject clickable buttons for pre-marked spans (easy/medium)
  function buildSpanHtml() {
    if (!spans || spans.length === 0) return html
    let result = html
    for (const { text } of spans) {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, '')
      const isAccused = accused.some(a => a.text.toLowerCase() === text.toLowerCase())
      const accusedClass = isAccused ? 'fc-span-accused' : ''
      result = result.replace(
        regex,
        `<button class="fc-span ${accusedClass}" data-span="${safeAttr(text)}">$1</button>`
      )
    }
    return result
  }

  function handleClick(e) {
    if (isHard) return
    const btn = e.target.closest('.fc-span')
    if (!btn) return
    onAccuse(btn.dataset.span)
  }

  return (
    <>
      <style>{`
        .fc-span {
          background: transparent;
          border: none;
          padding: 1px 2px;
          border-radius: 2px;
          cursor: pointer;
          border-bottom: 1px dotted #94a3b8;
          font: inherit;
          color: inherit;
        }
        .fc-span:hover { background: #fef9c3; color: #1a1a1a; }
        .fc-span-accused { background: #fef08a !important; color: #1a1a1a !important; border-bottom: 2px solid #eab308 !important; }
      `}</style>
      <div
        ref={articleRef}
        className="wiki-article px-4 py-4 text-[14px] leading-relaxed"
        style={{ fontFamily: 'Georgia, "Linux Libertine", serif', background: '#fff', color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: isHard ? html : buildSpanHtml() }}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      />
    </>
  )
}
