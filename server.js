// server.js
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'
import { setupSocketHandlers } from './src/lib/socketHandlers.js'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  globalThis._io = io
  setupSocketHandlers(io)

  httpServer.listen(3004, () => {
    console.log('> Find Hitler running on http://localhost:3004')
  })
})
