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

// ─── PATHS ─────────────────────────────────────────────
const PUBLIC_DIR  = path.join(__dirname, '..', 'public')
const USERS_DB    = path.join(__dirname, 'data', 'users.json')
const WORDS_JSON  = path.join(PUBLIC_DIR, 'assets', 'json', 'wordPairs.json')

// ─── EXPRESS + HTTP + SOCKET.IO SETUP ─────────────────
const app        = express()
const httpServer = createServer(app)
const io         = new SocketIOServer(httpServer)

app.use(express.json())
app.use(express.static(PUBLIC_DIR))

// ─── SIMPLE JSON “DB” HELPERS ─────────────────────────
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
  const newId = users.length ? Math.max(...users.map(u => u.user_id)) + 1 : 1
  users.push({ user_id: newId, username, password })
  writeUsers(users)
  return res.json({ token: `user-${newId}-token`, username })
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
  return res.json({ token: `user-${user.user_id}-token`, username: user.username })
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
const rooms = new Map()

// ─── LOAD WORD PAIRS AT STARTUP ────────────────────────
let WORD_PAIRS = []
try {
  WORD_PAIRS = JSON.parse(fs.readFileSync(WORDS_JSON, 'utf-8'))
} catch (err) {
  console.error('Failed to load word pairs:', err)
}

// ─── UTILITY: GENERATE ROOM CODES ─────────────────────
function generateCode(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// ─── HELPER: EXTRACT PUBLIC ROOM DATA ─────────────────
function getRoomsData() {
  return Array.from(rooms.values()).map(r => ({
    code: r.code,
    name: r.name,
    hostName: r.hostName,
    playerCount: r.players.length,
    maxPlayers: r.settings.maxPlayers,
    isPrivate: r.settings.isPrivate
  }))
}

// ─── API: LIST ACTIVE ROOMS ───────────────────────────
app.get('/api/rooms', (req, res) => {
  res.json(getRoomsData())
})

// ─── SOCKET.IO MULTIPLAYER LOGIC ───────────────────────
io.on('connection', socket => {
  console.log('Socket connected:', socket.id)

  // Send current rooms list
  socket.emit('rooms:update', getRoomsData())

  // Create Room
  socket.on('create-room', ({ hostName, name, maxPlayers = 6, promptTimer = 10, language = 'fr', isPrivate = false, password } = {}) => {
    const code = generateCode();
    const settings = { maxPlayers, promptTimer, language, isPrivate };
    if (isPrivate && password) settings.password = password;
  
    const room = {
      code,
      name:     name || code,
      hostId:   socket.id,
      hostName: hostName || 'Host',
      players: [{ id: socket.id, name: hostName || 'Host', socket }],
      settings
    };
  
    rooms.set(code, room);
    socket.join(code);
  
    // 1) Tell the creator "room-created"
    socket.emit('room-created', {
      code,
      room: getRoomsData().find(r => r.code === code)
    });
  
    // 2) Immediately send the initial player list (just the host)
    io.to(code).emit(
      'room:players',
      room.players.map(p => p.name)
    );
  
    // 3) Update everyone’s lobby overview
    io.emit('rooms:update', getRoomsData());
  });
  

  // Join Room
  socket.on('join-room', ({ roomCode, playerName, password } = {}) => {
    const room = rooms.get(roomCode)
    if (!room) {
      return socket.emit('room:join:error', 'Room not found')
    }
    if (room.settings.isPrivate && room.settings.password !== password) {
      return socket.emit('room:join:error', 'Incorrect password')
    }
    if (room.players.length >= room.settings.maxPlayers) {
      return socket.emit('room:join:error', 'Room is full')
    }
    room.players.push({ id: socket.id, name: playerName, socket })
    socket.join(roomCode)
    io.to(roomCode).emit('room:players', room.players.map(p => p.name))
    io.emit('rooms:update', getRoomsData())
  })

  // in server/index.js, inside io.on('connection')
    socket.on('get-rooms', () => {
    socket.emit('rooms:update', getRoomsData());
  });
  
  

  // Start Game
  socket.on('start-game', ({ roomCode } = {}) => {
    const room = rooms.get(roomCode)
    if (!room || room.hostId !== socket.id) return
    io.to(roomCode).emit('game:start', { promptTimer: room.settings.promptTimer, language: room.settings.language })
    startPromptLoop(room)
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    for (const [code, room] of rooms) {
      const idx = room.players.findIndex(p => p.id === socket.id)
      if (idx !== -1) {
        room.players.splice(idx, 1)
        io.to(code).emit('room:players', room.players.map(p => p.name))
      }
      if (room.hostId === socket.id) {
        rooms.delete(code)
      }
    }
    io.emit('rooms:update', getRoomsData())
  })
})

// ─── PROMPT LOOP: EMIT PROMPTS, REVEALS, END ──────────
async function startPromptLoop(room) {
  const { promptTimer } = room.settings
  for (const pair of WORD_PAIRS) {
    io.to(room.code).emit('game:prompt', { word: pair.fr, timer: promptTimer })
    await new Promise(res => setTimeout(res, promptTimer * 1000))
    io.to(room.code).emit('game:reveal', { answer: pair.en })
    await new Promise(res => setTimeout(res, 2000))
  }
  io.to(room.code).emit('game:end')
}

// ─── START THE SERVER ──────────────────────────────────
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
