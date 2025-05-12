// File: public/js/multiplayer.js

const socket = io();

// ----- UI References -----
const lobbySection    = document.getElementById('lobby');
const gameSection     = document.getElementById('game');
const infoText        = document.getElementById('lobbyInfo');

// Create Room Modal
const createBtn       = document.getElementById('createRoom');
const createModal     = document.getElementById('createModal');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playerList      = document.getElementById('playerList');
const startGameBtn    = document.getElementById('startGame');
const closeCreate     = document.getElementById('closeCreate');

// Join Room Modal
const joinBtn         = document.getElementById('joinRoom');
const joinModal       = document.getElementById('joinModal');
const roomsList       = document.getElementById('roomsList');
const closeJoin       = document.getElementById('closeJoin');

let currentRoom = null;
let isHost      = false;

// Helper to show/hide modals
function showModal(modal) {
  modal.style.display = 'flex';
}
function hideModal(modal) {
  modal.style.display = 'none';
}

// 1) Create Room Flow
createBtn.onclick = () => {
  socket.emit('create-room');
};

socket.on('room-created', code => {
  currentRoom = code;
  isHost      = true;

  roomCodeDisplay.innerText = code;
  infoText.textContent       = `Room created: ${code}`;

  // Clear previous list and add self
  playerList.innerHTML = `<li>You (host)</li>`;

  // Show modal & enable start
  startGameBtn.style.display = 'inline-block';
  showModal(createModal);
});

// Start Game (host only)
startGameBtn.onclick = () => {
  if (!isHost || !currentRoom) return;
  socket.emit('start-game', currentRoom);
};

// Close Create Modal
closeCreate.onclick = () => hideModal(createModal);

// 2) Join Room Flow
joinBtn.onclick = async () => {
  try {
    const res   = await fetch('/api/rooms');
    const rooms = await res.json();

    roomsList.innerHTML = rooms
      .map(code => `<li><button class="joinCodeBtn">${code}</button></li>`)
      .join('');

    // Attach click handlers
    document.querySelectorAll('.joinCodeBtn').forEach(btn => {
      btn.onclick = () => {
        const code = btn.innerText;
        socket.emit('join-room', code);
        hideModal(joinModal);
      };
    });

    showModal(joinModal);
  } catch (err) {
    alert('Error fetching rooms');
  }
};

// Close Join Modal
closeJoin.onclick = () => hideModal(joinModal);

// 3) Error Handling
socket.on('error', msg => {
  alert(msg);
});

// 4) Update Player List
socket.on('player-list', players => {
  // players: { socketId: { lives, score } }
  const items = Object.entries(players).map(([id, p]) => {
    const label = id === socket.id ? 'You' : `Player ${id.slice(-4)}`;
    return `<li>${label} (❤️ ${p.lives}, ⭐ ${p.score})</li>`;
  });
  playerList.innerHTML = items.join('');

  infoText.textContent = `Room: ${currentRoom} | ${items.length} player(s)`;

  // Only host sees the start button
  startGameBtn.style.display = isHost ? 'inline-block' : 'none';
});

// 5) Game Start
socket.on('game-start', () => {
  hideModal(createModal);
  lobbySection.style.display = 'none';
  gameSection.style.display  = 'flex';
  // TODO: initialize multiplayer game prompt loop
});

// 6) Clean up on disconnect
socket.on('disconnect', () => {
  // Optionally: reset UI
  lobbySection.style.display = 'block';
  gameSection.style.display  = 'none';
  hideModal(createModal);
  hideModal(joinModal);
  infoText.textContent = 'Disconnected';
});
