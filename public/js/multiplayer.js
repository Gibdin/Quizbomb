// File: public/js/multiplayer.js

const socket = io();
const me     = localStorage.getItem('qb_user') || 'Player';

// ----- UI References -----
const lobbySection    = document.getElementById('lobby');
const gameSection     = document.getElementById('game');
const infoText        = document.getElementById('lobbyInfo');
const createBtn       = document.getElementById('createRoom');
const joinBtn         = document.getElementById('joinRoom');
const createModal     = document.getElementById('createModal');
const joinModal       = document.getElementById('joinModal');
const createForm      = document.getElementById('createForm');
const cancelCreate    = document.getElementById('cancelCreate');
const closeCreateBtn  = document.getElementById('closeCreate');
const lobbyInfoBox    = document.getElementById('lobbyInfoBox');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playerList      = document.getElementById('playerList');
const startGameBtn    = document.getElementById('startGame');
const roomsList       = document.getElementById('roomsList');
const joinForm        = document.getElementById('joinForm');
const cancelJoin      = document.getElementById('cancelJoin');
const closeJoinBtn    = document.getElementById('closeJoin');

let currentRoom = null;
let isHost      = false;

// Helper to show/hide modals
function showModal(modal) { modal.style.display = 'flex'; }
function hideModal(modal) { modal.style.display = 'none'; }

// ─── 1) Live lobby list via WebSocket ─────────────────
socket.on('rooms:update', rooms => {
  roomsList.innerHTML = rooms.map(r => {
    const lock = r.isPrivate ? ' 🔒' : '';
    return `<li>
      <button class="joinBtn" data-code="${r.code}" data-private="${r.isPrivate}">
        ${r.code}${lock} (${r.name})
      </button>
    </li>`;
  }).join('');

  joinForm.style.display = 'none';

  document.querySelectorAll('.joinBtn').forEach(btn => {
    btn.onclick = () => {
      const code        = btn.dataset.code;
      const privateRoom = btn.dataset.private === 'true';

      if (!privateRoom) {
        // --- Public room: auto-join ---
        currentRoom = code;
        isHost      = false;

        createForm.style.display   = 'none';
        lobbyInfoBox.style.display = 'block';
        roomCodeDisplay.innerText  = code;
        startGameBtn.style.display = 'none';

        hideModal(joinModal);
        showModal(createModal);

        socket.emit('join-room', {
          roomCode:   code,
          playerName: me,
          password:   undefined
        });
      } else {
        // --- Private room: prompt for password ---
        joinForm.roomCode.value = code;
        joinForm.querySelector('.password-field')
                .style.display = 'grid';
        joinForm.password.value = '';
        joinForm.style.display   = 'grid';

        hideModal(createModal);
        showModal(joinModal);
      }
    };
  });
});

// ─── 2) Create Room Flow ─────────────────────────────
createBtn.onclick = () => {
  createForm.reset();
  joinForm.style.display     = 'none';
  lobbyInfoBox.style.display = 'none';
  showModal(createModal);
};

createForm.addEventListener('submit', e => {
  e.preventDefault();
  socket.emit('create-room', {
    hostName:    me,
    name:        createForm.roomName.value.trim() || undefined,
    maxPlayers:  parseInt(createForm.maxPlayers.value, 10) || 6,
    promptTimer: parseInt(createForm.promptTimer.value, 10) || 10,
    language:    createForm.language.value,
    isPrivate:   createForm.isPrivate.checked,
    password:    createForm.isPrivate.checked
                   ? createForm.password.value
                   : undefined
  });
});

cancelCreate.onclick = () => {
  lobbyInfoBox.style.display = 'none';
  createForm.style.display   = '';
  hideModal(createModal);
};
closeCreateBtn.onclick = cancelCreate.onclick;

// ─── 3) Handle “room-created” (host view) ───────────
socket.on('room-created', ({ code }) => {
  currentRoom = code;
  isHost      = true;

  createForm.style.display   = 'none';
  lobbyInfoBox.style.display = 'block';
  roomCodeDisplay.innerText  = code;
  startGameBtn.style.display = 'inline-block';

  showModal(createModal);
});

// ─── 4) Join Room Flow ───────────────────────────────
joinBtn.onclick = () => {
  socket.emit('get-rooms');
  joinForm.style.display = 'none';
  showModal(joinModal);
};

joinForm.addEventListener('submit', e => {
  e.preventDefault();

  const code = joinForm.roomCode.value;
  currentRoom = code;
  isHost      = false;

  createForm.style.display   = 'none';
  lobbyInfoBox.style.display = 'block';
  roomCodeDisplay.innerText  = code;
  startGameBtn.style.display = 'none';

  hideModal(joinModal);
  showModal(createModal);

  socket.emit('join-room', {
    roomCode:   code,
    playerName: me,
    password:   joinForm.password.value || undefined
  });
});

cancelJoin.onclick = () => {
  joinForm.style.display = 'none';
  hideModal(joinModal);
};
closeJoinBtn.onclick = cancelJoin.onclick;

// ─── 5) Update Player List on any change ────────────
socket.on('room:players', players => {
  playerList.innerHTML = players.map(name => `<li>${name}</li>`).join('');
  infoText.textContent  = `Room: ${currentRoom} | ${players.length} player(s)`;
});

// ─── 6) Start Game (host only) ──────────────────────
startGameBtn.onclick = () => {
  if (isHost && currentRoom) {
    socket.emit('start-game', { roomCode: currentRoom });
  }
};

// ─── 7) Game Flow Handlers ──────────────────────────
socket.on('game:start', ({ promptTimer }) => {
  hideModal(createModal);
  lobbySection.style.display = 'none';
  gameSection.style.display  = 'flex';
});
socket.on('game:prompt', ({ word, timer }) => {
  document.getElementById('prompt-text').textContent = word;
  const timerText = document.getElementById('timer-text');
  let remaining   = timer;
  timerText.textContent    = remaining;
  clearInterval(window._countdown);
  window._countdown = setInterval(() => {
    timerText.textContent = --remaining;
    if (remaining <= 0) clearInterval(window._countdown);
  }, 1000);
});
socket.on('game:reveal', ({ answer }) => {
  document.getElementById('reveal-text').textContent = answer;
});
socket.on('game:end', () => {
  document.getElementById('game-end').style.display = 'block';
});

// ─── 8) Clean Up on Disconnect ──────────────────────
socket.on('disconnect', () => {
  lobbySection.style.display = 'block';
  gameSection.style.display  = 'none';
  hideModal(createModal);
  hideModal(joinModal);
  infoText.textContent        = '';
});
