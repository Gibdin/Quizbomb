// File: server/auth.js

import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

//
// 1) Shim __dirname in ES modules
//
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

//
// 2) Paths
//
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const USERS_DB   = path.join(__dirname, 'data', 'users.json')
const WORDS_JSON = path.join(PUBLIC_DIR, 'assets', 'json', 'wordPairs.json')

const app = express()
app.use(express.json())

//
// 3) Helpers for users.json “database”
//
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

//
// 4) Registration endpoint
//
app.post('/api/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username & password required' })
  }

  const users = readUsers()
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already taken' })
  }

  const newId = users.length
    ? Math.max(...users.map(u => u.user_id)) + 1
    : 1

  users.push({ user_id: newId, username, password })
  writeUsers(users)

  return res.json({ token: `user-${newId}-token` })
})

//
// 5) Login endpoint
//
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username & password required' })
  }

  const users = readUsers()
  const user  = users.find(u =>
    u.username === username && u.password === password
  )
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  return res.json({ token: `user-${user.user_id}-token` })
})

//
// 6) Word-pairs API endpoint (serve file directly)
//
app.get('/api/wordPairs', (req, res) => {
  console.log('DEBUG /api/wordPairs hit. File exists?', fs.existsSync(WORDS_JSON));
  console.log('DEBUG WORDS_JSON path:', WORDS_JSON);
  console.log('DEBUG: WORDS_JSON =', WORDS_JSON,
    'exists?', fs.existsSync(WORDS_JSON),
    'size:', fs.existsSync(WORDS_JSON)
              ? fs.statSync(WORDS_JSON).size
              : 'n/a');
  res.sendFile(WORDS_JSON, err => {
    if (err) {
      console.error('❌ sendFile error:', err);
      return res.status(500).json({ error: 'Could not load word list' });
    }
    console.log('✅ sendFile delivered wordPairs.json');
  });
});


//
// 7) Static frontend
//
app.use(express.static(PUBLIC_DIR))

//
// 8) Start the server
//
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
