// File: server/auth.js

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── ES MODULE __dirname SHIM ─────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── PATHS ─────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const USERS_DB = path.join(__dirname, "data", "users.json");

const app = express();
app.use(express.json());

// ─── SIMPLE JSON “DB” HELPERS ─────────────────────────
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_DB, "utf-8"));
  } catch {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2), "utf-8");
}

// ─── REGISTRATION ENDPOINT ────────────────────────────
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

  // Return both token and username for client to store
  return res.json({ token: `user-${newId}-token`, username });
});

// ─── LOGIN ENDPOINT ────────────────────────────────────
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

  // Return both token and username
  return res.json({
    token: `user-${user.user_id}-token`,
    username: user.username,
  });
});

// ─── SERVE STATIC ASSETS ─────────────────────────────
app.use(express.static(PUBLIC_DIR));

// ─── START SERVER ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
