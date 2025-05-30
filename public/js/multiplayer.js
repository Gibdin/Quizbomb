// File: public/js/multiplayer.js

const socket = io();
const me = localStorage.getItem("qb_user") || "Player";

// ----- UI References -----
const lobbySection = document.getElementById("lobby");
const gameSection = document.getElementById("game");
const infoText = document.getElementById("lobbyInfo");
const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const createModal = document.getElementById("createModal");
const joinModal = document.getElementById("joinModal");
const createForm = document.getElementById("createForm");
const cancelCreate = document.getElementById("cancelCreate");
const closeCreateBtn = document.getElementById("closeCreate");
const lobbyInfoBox = document.getElementById("lobbyInfoBox");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomNameDisplay = document.getElementById("roomNameDisplay");
const startGameBtn = document.getElementById("startGame");
const roomsList = document.getElementById("roomsList");
const joinForm = document.getElementById("joinForm");
const cancelJoin = document.getElementById("cancelJoin");
const closeJoinBtn = document.getElementById("closeJoin");
const lobbyPlayerList = document.getElementById("lobbyPlayerList");
const gamePlayerList = document.getElementById("gamePlayerList");
const answerInput = document.getElementById("answer-input");
const promptTextEl = document.getElementById("prompt-text");
const timerTextEl = document.getElementById("timer-text");
const revealTextEl = document.getElementById("reveal-text");
const turnTextEl = document.getElementById("turn-text");
const sfxCorrect = document.getElementById("sfx-correct");
const sfxWrong = document.getElementById("sfx-wrong");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardModal = document.getElementById("leaderboardModal");
const leaderboardList = document.getElementById("leaderboardList");
const closeLeaderboard = document.getElementById("closeLeaderboard");

let currentRoom = null;
let isHost = false;

// modal helpers
function showModal(modal) {
  modal.style.display = "flex";
}
function hideModal(modal) {
  modal.style.display = "none";
}

// ─── 1) Live lobby list ──────────────────────────────
socket.on("rooms:update", (rooms) => {
  roomsList.innerHTML = rooms
    .map((r) => {
      const lock = r.isPrivate ? " 🔒" : "";
      return `<li>
      <button class="joinBtn" data-code="${r.code}" data-private="${r.isPrivate}">
        ${r.code}${lock} (${r.name || "—"})
      </button>
    </li>`;
    })
    .join("");

  joinForm.style.display = "none";

  document.querySelectorAll(".joinBtn").forEach((btn) => {
    btn.onclick = () => {
      const code = btn.dataset.code;
      const privateRoom = btn.dataset.private === "true";

      if (!privateRoom) {
        currentRoom = code;
        isHost = false;

        createForm.style.display = "none";
        lobbyInfoBox.style.display = "block";
        roomCodeDisplay.innerText = code;
        startGameBtn.style.display = "none";

        hideModal(joinModal);
        showModal(createModal);

        socket.emit("join-room", {
          roomCode: code,
          playerName: me,
          password: undefined,
        });
      } else {
        joinForm.roomCode.value = code;
        joinForm.querySelector(".password-field").style.display = "grid";
        joinForm.password.value = "";
        joinForm.style.display = "grid";

        hideModal(createModal);
        showModal(joinModal);
      }
    };
  });
});

// ─── 2) Create Room Flow ─────────────────────────────
if (createBtn) {
  createBtn.onclick = () => {
    if (createForm) createForm.reset();
    if (joinForm) joinForm.style.display = "none";
    lobbyInfoBox.style.display = "none";
    showModal(createModal);
  };
}

// guard createForm existence in tests
if (createForm) {
  createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    socket.emit("create-room", {
      hostName: me,
      name: createForm.roomName.value.trim() || undefined,
      maxPlayers: parseInt(createForm.maxPlayers.value, 10) || 6,
      promptTimer: parseInt(createForm.promptTimer.value, 10) || 10,
      language: createForm.language.value,
      isPrivate: createForm.isPrivate.checked,
      password: createForm.isPrivate.checked
        ? createForm.password.value
        : undefined,
    });
  });
}

// ─── cancel/close buttons ─────────────────────────────
if (cancelCreate) {
  cancelCreate.onclick = () => {
    if (createForm) createForm.style.display = "";
    if (lobbyInfoBox) lobbyInfoBox.style.display = "none";
    hideModal(createModal);
  };
}
if (closeCreateBtn) {
  closeCreateBtn.onclick = cancelCreate.onclick;
}

if (cancelJoin) {
  cancelJoin.onclick = () => {
    if (joinForm) joinForm.style.display = "none";
    hideModal(joinModal);
  };
}
if (closeJoinBtn) {
  closeJoinBtn.onclick = cancelJoin.onclick;
}

// ─── 3) Handle “room-created” (host view) ───────────
socket.on("room-created", ({ roomCode, roomName }) => {
  currentRoom = roomCode;
  isHost = true;

  createForm.style.display = "none";
  lobbyInfoBox.style.display = "block";

  roomCodeDisplay.innerText = roomCode;
  roomNameDisplay.innerText = roomName || "—";

  startGameBtn.style.display = "inline-block";
});

// ─── fire off “start-game” when host clicks ─────────────
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    if (currentRoom && isHost) {
      socket.emit("start-game", { roomCode: currentRoom });
    }
  });
}

// ─── 4) Join Room Flow ───────────────────────────────
if (joinBtn) {
  joinBtn.onclick = () => {
    socket.emit("get-rooms");
    joinForm.style.display = "none";
    showModal(joinModal);
  };
}

if (joinForm) {
  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = joinForm.roomCode.value;
    currentRoom = code;
    isHost = false;

    createForm.style.display = "none";
    lobbyInfoBox.style.display = "block";
    roomCodeDisplay.innerText = code;
    startGameBtn.style.display = "none";

    hideModal(joinModal);
    showModal(createModal);

    socket.emit("join-room", {
      roomCode: code,
      playerName: me,
      password: joinForm.password.value || undefined,
    });
  });
}

// ─── 5) Update Player List in Lobby ─────────────────
socket.on("room:players", (players) => {
  lobbyPlayerList.innerHTML = players.map((n) => `<li>${n}</li>`).join("");
  infoText.textContent = `Room: ${currentRoom} | ${players.length} player(s)`;
});

// ─── 6) Start Game (host only) ──────────────────────────
if (startGameBtn) {
  startGameBtn.onclick = () => {
    if (isHost && currentRoom) {
      socket.emit("start-game", { roomCode: currentRoom });
    }
  };
}

// ─── 7) Game Flow Handlers ──────────────────────────
socket.on("game:start", ({ promptTimer }) => {
  hideModal(createModal);
  lobbySection.style.display = "none";
  gameSection.style.display = "flex";

  // reset UI
  document.getElementById("game-end").style.display = "none";
  revealTextEl.textContent = "";
  promptTextEl.textContent = "";
  timerTextEl.textContent = "";
  turnTextEl.textContent = "";
  answerInput.disabled = true;
});

// ─── 7.1) Update Lives Display ──────────────────────
socket.on("player:update", (players) => {
  gamePlayerList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    const pts = typeof p.score === "number" ? p.score : 0;
    li.textContent = `${p.name}: ${pts} pts, ${p.lives} ❤️`;
    gamePlayerList.appendChild(li);
  });
});

// ─── 7.2) Handle Eliminations in Game List ──────────
socket.on("player:eliminated", (name) => {
  document.querySelectorAll("#gamePlayerList li").forEach((li) => {
    if (li.textContent.startsWith(name + " ")) {
      li.classList.add("eliminated");
    }
  });
});

// ─── 7.3) Highlight Turn & Enable Input ─────────────
if (typeof socket.off === "function") {
  socket.off("game:turn");
}
// then subscribe
socket.on("game:turn", ({ playerId, playerName }) => {
  console.log("⏱ game:turn →", { playerId, playerName, myId: socket.id });
  turnTextEl.textContent = `${playerName}'s turn`;
  answerInput.disabled = socket.id !== playerId;
  if (!answerInput.disabled) answerInput.focus();
  document.querySelectorAll("#gamePlayerList li").forEach((li) => {
    const active = li.textContent.startsWith(playerName + " ");
    if (active) li.classList.add("active-turn");
    else li.classList.remove("active-turn");
  });
});

// ─── 7.4) Show Prompt & Start Countdown ────────────
socket.on("game:prompt", ({ word, timer }) => {
  promptTextEl.textContent = word;
  revealTextEl.textContent = "";
  answerInput.value = "";

  let rem = timer;
  timerTextEl.textContent = rem;
  clearInterval(window._cnt);
  window._cnt = setInterval(() => {
    timerTextEl.textContent = --rem;
    if (rem <= 0) clearInterval(window._cnt);
  }, 1000);
});

// ─── 7.5) Reveal Answer ──────────────────────────────
socket.on("game:reveal", ({ answer }) => {
  revealTextEl.textContent = answer;
});

// ─── 7.6) Correct/Wrong Feedback & Sound FX ─────────
socket.on("player:correct", ({ playerName }) => {
  if (playerName === me) turnTextEl.textContent = "✅ You got it!";
  else turnTextEl.textContent = `${playerName} was correct!`;
  sfxCorrect.currentTime = 0;
  sfxCorrect.play().catch(() => {});
});

socket.on("player:wrong", ({ playerName }) => {
  if (playerName === me) turnTextEl.textContent = "❌ Wrong — try again";
  sfxWrong.currentTime = 0;
  sfxWrong.play().catch(() => {});
});

// ─── 7.7) End Game ───────────────────────────────────
socket.on("game:end", () => {
  document.getElementById("game-end").style.display = "block";
});

// 7.8) End-Game Ranking Modal
const endModal = document.getElementById("endModal");
const leaderboardEl = document.getElementById("leaderboard-list");
const returnButton = document.getElementById("returnButton");

// lobby‐only leaderboard
socket.on("game:leaderboard-local", (ranking) => {
  // hide game UI
  gameSection.style.display = "none";

  // populate end‐game modal with lobby scores
  leaderboardEl.innerHTML = ranking
    .map((p, i) => `<li>${i + 1}. ${p.name} — ${p.score} pts</li>`)
    .join("");
  endModal.style.display = "flex";
});

// global leaderboard (optional: show in a separate modal or reuse same)
socket.on("game:leaderboard-global", (ranking) => {
  // e.g. console.log('all‐time ranking', ranking);
});

// ─── 8) Return to Lobby Button ────────────────────────
if (returnButton) {
  returnButton.addEventListener("click", () => {
    endModal.style.display = "none";
    lobbySection.style.display = "flex";
    // reset lobby UI if needed…
    socket.emit("get-rooms");
  });
}

// ─── 8) Submit Answer on Enter ──────────────────────
if (answerInput) {
  answerInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const ans = answerInput.value.trim();
    if (!ans) return;
    socket.emit("submit-answer", { roomCode: currentRoom, answer: ans });
    answerInput.value = "";
  });
}

// ─── 9) Clean Up on Disconnect ──────────────────────
socket.on("disconnect", () => {
  lobbySection.style.display = "block";
  gameSection.style.display = "none";
  hideModal(createModal);
  hideModal(joinModal);
  infoText.textContent = "";
});

// ─── Leaderboard Button ─────────────────────────────
if (leaderboardBtn) {
  leaderboardBtn.addEventListener("click", async () => {
    // 1) fetch sorted high scores
    const res = await fetch("/api/leaderboard");
    const ranking = await res.json();
    // 2) populate the list
    leaderboardList.innerHTML = ranking
      .map((u, i) => `<li>${i + 1}. ${u.name} — ${u.highScore} pts</li>`)
      .join("");
    // 3) show the modal
    leaderboardModal.style.display = "flex";
  });
}

// ─── Close Leaderboard Modal ────────────────────────
if (closeLeaderboard) {
  closeLeaderboard.addEventListener("click", () => {
    leaderboardModal.style.display = "none";
  });
}
