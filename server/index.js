// File: server/index.js
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

// ─── ES MODULE __dirname SHIM ─────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── PATHS ──────────────────────────────────────────────
const PUBLIC_DIR  = path.join(__dirname, '..', 'public')
const USERS_DB    = path.join(__dirname, 'data', 'users.json')
const WORDS_JSON  = path.join(PUBLIC_DIR, 'assets', 'json', 'wordPairs.json')

// ─── EXPRESS + HTTP + SOCKET.IO SETUP ──────────────────
const app        = express()
const httpServer = createServer(app)
const io         = new SocketIOServer(httpServer)

app.use(express.json())
app.use(express.static(PUBLIC_DIR))

// ─── SIMPLE JSON “DB” HELPERS ──────────────────────────
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_DB, 'utf-8'))
  } catch {
    return []
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2))
}

// ─── AUTH ENDPOINTS ───────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username & password required' })
  }

  const users = readUsers()
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already taken' })
  }

  const newId = users.length ? Math.max(...users.map(u=>u.user_id)) + 1 : 1
  users.push({ user_id: newId, username, password })
  writeUsers(users)
  return res.json({ token: `user-${newId}-token` })
})

app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username & password required' })
  }

  const users = readUsers()
  const user  = users.find(u => u.username === username && u.password === password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  return res.json({ token: `user-${user.user_id}-token` })
})

// ─── WORD‐PAIRS ENDPOINT ───────────────────────────────
app.get('/api/wordPairs', (req, res) => {
  fs.readFile(WORDS_JSON, 'utf-8', (err, raw) => {
    if (err) {
      console.error('Error reading wordPairs.json:', err)
      return res.status(500).json({ error: 'Could not load word list' })
    }
    try {
      const data = JSON.parse(raw)
      return res.json(data)
    } catch (parseErr) {
      console.error('Error parsing wordPairs.json:', parseErr)
      return res.status(500).json({ error: 'Invalid JSON format' })
    }
  })
})

// ─── IN-MEMORY ROOMS ───────────────────────────────────
const rooms = {}  // { roomCode: { host, players: { socketId: { lives, score } } } }

// ─── LIST ACTIVE ROOMS ──────────────────────────────────
app.get('/api/rooms', (req, res) => {
  res.json(Object.keys(rooms))
})

// ─── SOCKET.IO MULTIPLAYER LOGIC ───────────────────────
io.on('connection', socket => {
  console.log('Socket connected:', socket.id)

  socket.on('create-room', () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    rooms[code] = { host: socket.id, players: {} }
    socket.join(code)
    socket.emit('room-created', code)
  })

  socket.on('join-room', code => {
    const room = rooms[code]
    if (!room) return socket.emit('error', 'Room not found')
    room.players[socket.id] = { lives: 3, score: 0 }
    socket.join(code)
    io.in(code).emit('player-list', room.players)
  })

  socket.on('start-game', code => {
    const room = rooms[code]
    if (room?.host !== socket.id) return
    io.in(code).emit('game-start')
  })

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code]
      if (room.players[socket.id]) {
        delete room.players[socket.id]
        io.in(code).emit('player-list', room.players)
      }
      if (room.host === socket.id) {
        delete rooms[code]
      }
    }
  })
})

// ─── START THE SERVER ──────────────────────────────────
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
