'use client'
import { useRef } from 'react'

// `html` is already prepared by the server per difficulty:
//   easy/medium → contains <span data-fc-id> (no truth flag) → clickable chips
//   hard/hardcore → no wrappers at all → free drag-select
export default function FactCheckerArticle({ html, difficulty, onAccuse, accused = [] }) {
  const articleRef = useRef(null)
  const isHard = difficulty === 'hard' || difficulty === 'hardcore'
  const accusedIds = new Set(accused.filter(a => a.fcId).map(a => a.fcId))

  function handleClick(e) {
    if (isHard) return
    const el = e.target.closest('[data-fc-id]')
    if (!el || !articleRef.current?.contains(el)) return
    onAccuse({ fcId: el.dataset.fcId, label: el.textContent })
  }

  function handleMouseUp() {
    if (!isHard) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    // Coarse client guard: ignore tiny or huge selections (server is authoritative).
    if (text.length < 2 || text.length > 80) { sel.removeAllRanges(); return }
    const range = sel.getRangeAt(0)
    if (!articleRef.current || !articleRef.current.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges(); return
    }
    onAccuse({ selection: text, label: text })
    sel.removeAllRanges()
  }

  // Mark already-accused chips (easy/medium) so they visibly lock in.
  function decorate(rawHtml) {
    if (isHard || accusedIds.size === 0) return rawHtml
    let out = rawHtml
    for (const id of accusedIds) {
      out = out.replace(`data-fc-id="${id}"`, `data-fc-id="${id}" data-accused="true"`)
    }
    return out
  }

  return (
    <>
      <style>{`
        .fc-mark [data-fc-id] {
          background: #fffbe6;
          border-bottom: 2px solid #cbb24a;
          border-radius: 3px;
          padding: 0 3px;
          cursor: pointer;
          transition: background 120ms ease;
        }
        .fc-mark [data-fc-id]:hover { background: #fde68a; }
        .fc-mark [data-fc-id]:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
        .fc-mark [data-fc-id][data-accused="true"] {
          background: #fde047; border-bottom: 2px solid #a16207; font-weight: 600;
        }
      `}</style>
      <div
        ref={articleRef}
        className={isHard ? 'wiki-article px-4 py-4 text-[14px] leading-relaxed select-text'
                          : 'fc-mark wiki-article px-4 py-4 text-[14px] leading-relaxed'}
        style={{ fontFamily: 'Georgia, "Linux Libertine", serif', background: '#fff', color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: decorate(html) }}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      />
    </>
  )
}
