// File: server/index.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// ─── ES MODULE __dirname SHIM (with CJS/Jest fallback) ──────
let __dirname;
try {
  // real ESM:
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch {
  // Jest/CommonJS fallback: force to the server folder
  __dirname = path.join(process.cwd(), "server");
}

// ─── PATHS ─────────────────────
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const USERS_DB = path.join(__dirname, "data", "users.json");
const WORDS_JSON = path.join(PUBLIC_DIR, "assets", "json", "wordPairs.json");

const STATIC_USERS_DB = path.join(__dirname, "data", "users.json");
function getUsersDbPath() {
  return process.env.USERS_DB || STATIC_USERS_DB;
}

// ─── EXPRESS + HTTP + SOCKET.IO SETUP ───────────
const app = express();
const httpServer = createServer(app);

let io;
try {
  // in production this works as normal
  io = new SocketIOServer(httpServer);
} catch {
  // under Jest (no wsEngine) fall back to a no‐op server
  io = {
    on: () => {},
    emit: () => {},
    to: () => ({ emit: () => {} }),
    sockets: { sockets: new Map() },
  };
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ─── AUTH HELPERS ────────────
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(getUsersDbPath(), "utf-8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(getUsersDbPath(), JSON.stringify(users, null, 2));
}

// ─── AUTH ENDPOINTS ────────────
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username & password required" });
  }
  const users = readUsers();
  if (users.some((u) => u.username === username)) {
    return res.status(400).json({ error: "Username already taken" });
  }
  const newId = users.length ? Math.max(...users.map((u) => u.user_id)) + 1 : 1;
  users.push({ user_id: newId, username, password });
  writeUsers(users);
  return res.json({ token: `user-${newId}-token`, username });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username & password required" });
  }
  const users = readUsers();
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  return res.json({
    token: `user-${user.user_id}-token`,
    username: user.username,
  });
});

// ─── WORD‐PAIRS ENDPOINT ───────────────
app.get("/api/wordPairs", (req, res) => {
  fs.readFile(WORDS_JSON, "utf-8", (err, raw) => {
    if (err) {
      console.error("Error reading wordPairs.json:", err);
      return res.status(500).json({ error: "Could not load word list" });
    }
    try {
      const data = JSON.parse(raw);
      return res.json(data);
    } catch (parseErr) {
      console.error("Error parsing wordPairs.json:", parseErr);
      return res.status(500).json({ error: "Invalid JSON format" });
    }
  });
});

// ─── IN‐MEMORY ROOMS & DEFAULTS ─────────
const DEFAULT_LIVES = 3;
const DEFAULT_MAX_PLAYERS = 4;
const DEFAULT_PROMPT_TIMER = 15; // seconds
const DEFAULT_IS_PRIVATE = false;

const rooms = new Map();

// ─── LOAD WORD PAIRS AT STARTUP ───────────
let WORD_PAIRS = [];
try {
  WORD_PAIRS = JSON.parse(fs.readFileSync(WORDS_JSON, "utf-8"));
} catch (err) {
  console.error("Failed to load word pairs:", err);
}

// ─── DIFFICULTY & SCORING CONSTANTS ─────────
const MEDIUM_THRESHOLD = 5;
const HARD_THRESHOLD = 10;
const POINTS = { easy: 1, medium: 2, hard: 3 };

// ─── UTILITY: GENERATE ROOM CODES ─────────────
function generateCode(length = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── HELPER: EXTRACT PUBLIC ROOM DATA ─────────
function getRoomsData() {
  return Array.from(rooms.values()).map((r) => {
    // fallback to an empty object if settings was never set
    const s = r.settings || {};
    return {
      code: r.code,
      hostName: r.hostName,
      playerCount: r.players.length,
      maxPlayers: s.maxPlayers ?? DEFAULT_MAX_PLAYERS,
      isPrivate: s.isPrivate ?? DEFAULT_IS_PRIVATE,
    };
  });
}

// ─── API: LIST ACTIVE ROOMS ──────────────
app.get("/api/rooms", (req, res) => {
  res.json(getRoomsData());
});

// ─── LEADERBOARD ENDPOINT ───────────────────
app.get("/api/leaderboard", (req, res) => {
  const users = readUsers(); // reads server/data/users.json
  const ranking = users
    .map((u) => ({ name: u.username, highScore: u.highScore || 0 }))
    .sort((a, b) => b.highScore - a.highScore);
  res.json(ranking);
});

// ─── SOCKET.IO MULTIPLAYER LOGIC ────────────────
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Send current rooms list
  socket.emit("rooms:update", getRoomsData());

  // Create Room
  socket.on("create-room", (payload) => {
    // pull your form fields directly out of payload
    const {
      hostName,
      name,
      maxPlayers = DEFAULT_MAX_PLAYERS,
      promptTimer = DEFAULT_PROMPT_TIMER,
      language,
      isPrivate = DEFAULT_IS_PRIVATE,
      password,
    } = payload;

    // build the settings object you actually want
    const settings = {
      name,
      maxPlayers,
      promptTimer,
      language,
      isPrivate,
      password,
    };

    const code = generateCode();
    const room = {
      code,
      hostId: socket.id,
      hostName,
      settings,
      players: [
        {
          id: socket.id,
          name: hostName,
          lives: DEFAULT_LIVES,
          score: 0,
        },
      ],
      eliminated: [],
      usedIndices: { easy: [], medium: [], hard: [] },
      currentTurnIndex: 0,
      inProgress: false,
    };

    rooms.set(code, room);
    socket.join(code);
    socket.emit("room-created", { roomCode: code });
    io.emit("rooms:update", getRoomsData());
  });

  // Join Room
  socket.on("join-room", ({ roomCode, playerName, password } = {}) => {
    const room = rooms.get(roomCode);
    if (!room) {
      return socket.emit("room:join:error", "Room not found");
    }
    if (room.settings.isPrivate && room.settings.password !== password) {
      return socket.emit("room:join:error", "Incorrect password");
    }
    if (room.players.length >= room.settings.maxPlayers) {
      return socket.emit("room:join:error", "Room is full");
    }
    room.players.push({
      id: socket.id,
      name: playerName,
      lives: 3,
      score: 0,
    });
    socket.join(roomCode);
    io.to(roomCode).emit(
      "room:players",
      room.players.map((p) => p.name),
    );
    io.emit("rooms:update", getRoomsData());
  });

  // in server/index.js, inside io.on('connection')
  socket.on("get-rooms", () => {
    socket.emit("rooms:update", getRoomsData());
  });

  // Start Game
  socket.on("start-game", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.inProgress) return;

    room.inProgress = true;

    // hide the lobby, show the game
    io.to(roomCode).emit("game:start", {
      promptTimer: room.settings.promptTimer,
    });

    // send initial lives to all clients
    io.to(roomCode).emit(
      "player:update",
      room.players.map((p) => ({
        name: p.name,
        lives: p.lives,
        score: p.score, // ← add this so everyone starts at 0
      })),
    );

    // kick off the prompt loop
    startPromptLoop(room);
  });

  // ─── PROMPT LOOP: EMIT TURNS, PROMPTS, REVEALS, END ───
  async function startPromptLoop(room) {
    const { code } = room;

    function nextTurn() {
      // if only one left -> end + leaderboard
      if (room.players.length <= 1) {
        // notify clients we’re done
        io.to(code).emit("game:end");

        // ─── Build & emit the LOBBY-ONLY leaderboard ─────────
        const localPlayers = [...room.players, ...room.eliminated];
        const localRanking = localPlayers
          .map(p => ({ name: p.name, score: p.score }))
          .sort((a, b) => b.score - a.score);
        io.to(code).emit("game:leaderboard-local", localRanking);

        // ─── Now update global high‐scores and emit GLOBAL leaderboard ─
        const users = readUsers();
        for (const p of localPlayers) {
          const u = users.find(u => u.username === p.name);
          if (u && p.score > (u.highScore || 0)) u.highScore = p.score;
        }
        writeUsers(users);

        const globalRanking = users
          .map(u => ({ name: u.username, highScore: u.highScore || 0 }))
          .sort((a, b) => b.highScore - a.highScore);
        return io.to(code).emit("game:leaderboard-global", globalRanking);
      }

      // pick current player
      const turnPlayer = room.players[room.currentTurnIndex];

      // 1) choose difficulty by their score
      const lvl =
        turnPlayer.score >= HARD_THRESHOLD
          ? "hard"
          : turnPlayer.score >= MEDIUM_THRESHOLD
            ? "medium"
            : "easy";

      // 2) pick a random unused word from WORD_PAIRS[lvl]
      const pool = WORD_PAIRS.filter((x) => x.difficulty === lvl);
      const used = room.usedIndices[lvl];
      if (used.length >= pool.length) room.usedIndices[lvl] = [];
      let idx;
      do {
        idx = Math.floor(Math.random() * pool.length);
      } while (room.usedIndices[lvl].includes(idx));
      room.usedIndices[lvl].push(idx);
      const pair = pool[idx];

      // 3) announce turn & prompt
      io.to(code).emit("game:turn", {
        playerId: turnPlayer.id,
        playerName: turnPlayer.name,
      });
      // how many seconds the client should show
      const timer = room.settings?.promptTimer ?? DEFAULT_PROMPT_TIMER;
      // convert to ms for our timeout
      const promptMs = timer * 1000;
      io.to(code).emit("game:prompt", {
        word: pair.french,
        timer,
      });

      let turnOver = false;
      const timeoutId = setTimeout(() => {
        if (turnOver) return;
        turnOver = true;
        // timeout -> lose a life
        turnPlayer.lives--;
        io.to(code).emit(
          "player:update",
          room.players.map((p) => ({
            name: p.name,
            lives: p.lives,
            score: p.score,
          })),
        );
        if (turnPlayer.lives <= 0) {
          room.eliminated.push(turnPlayer);
          room.players = room.players.filter((p) => p.id !== turnPlayer.id);
          io.to(code).emit("player:eliminated", turnPlayer.name);
        }
        // reveal & advance
        io.to(code).emit("game:reveal", { answer: pair.english });
        advance();
      }, promptMs);

      // 4) handle guesses
      function onAnswer({ roomCode, answer }) {
        if (turnOver || roomCode !== code) return;
        const norm = answer.trim().toLowerCase();
        if (norm === pair.english.toLowerCase()) {
          // correct -> award pts & reveal
          turnOver = true;
          clearTimeout(timeoutId);
          turnPlayer.score += POINTS[lvl];
          io.to(code).emit("player:correct", {
            playerId: turnPlayer.id,
            playerName: turnPlayer.name,
          });
          io.to(code).emit(
            "player:update",
            room.players.map((p) => ({
              name: p.name,
              lives: p.lives,
              score: p.score,
            })),
          );
          io.to(code).emit("game:reveal", { answer: pair.english });
          advance();
        } else {
          // wrong -> just ping
          io.to(code).emit("player:wrong", {
            playerId: turnPlayer.id,
            playerName: turnPlayer.name,
          });
        }
      }
      io.sockets.sockets.get(turnPlayer.id).on("submit-answer", onAnswer);

      // 5) advance helper
      function advance() {
        const sock = io.sockets.sockets.get(turnPlayer.id);
        sock.off("submit-answer", onAnswer);
        // move to next index (wrap)
        room.currentTurnIndex = room.currentTurnIndex % room.players.length;
        room.currentTurnIndex =
          (room.currentTurnIndex + 1) % room.players.length;
        setTimeout(nextTurn, 1000);
      }
    }

    nextTurn();
  }

  // Handle disconnection
  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        io.to(code).emit(
          "room:players",
          room.players.map((p) => p.name),
        );
      }
      if (room.hostId === socket.id) {
        rooms.delete(code);
      }
    }
    io.emit("rooms:update", getRoomsData());
  });
});

// ─── START THE SERVER ────────────
const PORT = process.env.PORT || 3000;

// only start listening when NOT under Jest
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export { app, io, rooms, generateCode, getRoomsData, readUsers, writeUsers };
