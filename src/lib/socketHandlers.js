// src/lib/socketHandlers.js
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('socket connected:', socket.id)
  })
}
