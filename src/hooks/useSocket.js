// src/hooks/useSocket.js
'use client'
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let _socket = null

// Singleton socket shared across all components in the same browser tab
function getSocket() {
  if (!_socket) {
    _socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  }
  return _socket
}

/**
 * useSocket(handlers)
 * handlers: { eventName: (data) => void }
 * Returns a ref to the socket instance.
 * handlers must be stable (defined outside render or with useCallback).
 */
export function useSocket(handlers = {}) {
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event, fn)
    }

    return () => {
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event, fn)
      }
    }
  }, [])

  return socketRef
}
