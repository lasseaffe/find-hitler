'use client'
import { useState, useEffect, useRef } from 'react'

const ALLOWED_EMOTES = ['💀', '🔥', '😭', '👏', '⚡', '🤡']

// msg shape: { type: 'system'|'chat'|'emote', text?, name?, emote?, isWin? }
export default function LobbyChat({ socket, roomCode, playerCount = 0 }) {
  const [messages, setMessages] = useState([{ type: 'system', text: 'Race started' }])
  const [input, setInput] = useState('')
  const feedRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    const onChatMessage = (data) => {
      setMessages(prev => [...prev, { type: 'chat', name: data.name, text: data.text }])
    }
    const onChatEmote = (data) => {
      setMessages(prev => [...prev, { type: 'emote', name: data.name, emote: data.emote }])
    }
    const onChatEvent = (data) => {
      setMessages(prev => [...prev, { type: 'system', text: data.text, isWin: data.isWin }])
    }

    socket.on('chat:message', onChatMessage)
    socket.on('chat:emote', onChatEmote)
    socket.on('chat:event', onChatEvent)

    return () => {
      socket.off('chat:message', onChatMessage)
      socket.off('chat:emote', onChatEmote)
      socket.off('chat:event', onChatEvent)
    }
  }, [socket])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    const text = input.trim().slice(0, 120)
    if (!text || !socket) return
    socket.emit('chat:message', { roomCode, text })
    setInput('')
  }

  const sendEmote = (emote) => {
    if (!socket) return
    socket.emit('chat:emote', { roomCode, emote })
  }

  return (
    <div className="flex flex-col border-l-4 border-ink bg-paper" style={{ width: 264, height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-ink px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 flex-shrink-0">
        <span>Chat</span>
        <span style={{ color: '#2563eb' }}>{playerCount} players</span>
      </div>

      {/* Emote bar */}
      <div className="flex gap-1 px-2 py-1.5 border-b-2 border-ink bg-paper-dim flex-shrink-0 flex-wrap">
        {ALLOWED_EMOTES.map(e => (
          <button key={e} onClick={() => sendEmote(e)}
            className="text-base hover:scale-125 transition-transform cursor-pointer"
            style={{ background: 'none', border: 'none', padding: '1px 3px', lineHeight: 1 }}>
            {e}
          </button>
        ))}
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1" style={{ fontSize: 9, fontFamily: 'ui-monospace,monospace' }}>
        {messages.map((msg, i) => {
          if (msg.type === 'emote') return (
            <div key={i} className="flex items-center gap-1.5">
              <span style={{ fontSize: 15 }}>{msg.emote}</span>
              <span style={{ color: '#555', fontSize: 8 }}>{msg.name}</span>
            </div>
          )
          if (msg.type === 'chat') return (
            <div key={i}>
              <span style={{ color: '#fbbf24' }}>{msg.name}: </span>
              <span style={{ color: '#888' }}>{msg.text}</span>
            </div>
          )
          // system
          return (
            <div key={i} style={{ color: msg.isWin ? '#2563eb' : '#555', fontStyle: 'italic' }}>
              {msg.text}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="flex border-t-2 border-ink flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message…"
          maxLength={120}
          style={{
            flex: 1, background: '#fafaf8', border: 'none', outline: 'none',
            fontFamily: 'ui-monospace,monospace', fontSize: 9, padding: '7px 8px',
            color: '#0e0e0e',
          }}
        />
        <button onClick={sendMessage}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'ui-monospace,monospace', fontSize: 8, fontWeight: 700,
            padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
          Send
        </button>
      </div>
    </div>
  )
}
