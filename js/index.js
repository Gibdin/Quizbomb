// Highscores logic
const highscoresEl = document.getElementById("highscores");
let highscores = localStorage.getItem("highscores") || Array(5).fill(0);
if (typeof highscores === "string") highscores = highscores.split(";");

function loadHighscores() {
  highscoresEl.innerHTML = "";
  localStorage.setItem("highscores", highscores.join(";"));
  highscores.forEach(hs => {
    const li = document.createElement("li");
    li.innerText = hs;
    highscoresEl.appendChild(li);
  });
}

// UI elements
const startContainer = document.getElementById("startContainer");
const gameContainer = document.getElementById("gameContainer");
const startButton = document.getElementById("startButton");
const wordPrompt = document.getElementById("wordPrompt");
const inputWord = document.getElementById("inputWord");
const finalScoreEl = document.getElementById("finalScore");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const promptTimerEl = document.getElementById("promptTimer");

// Settings elements
const promptTimeInput = document.getElementById("promptTimeInput");
const infiniteModeInput = document.getElementById("infiniteModeInput");

// Audio FX
const correctSound = new Audio("assets/sound/sfx/correct.wav");
const wrongSound = new Audio("assets/sound/sfx/incorrect.wav");
function unlockAudio() {
  correctSound.play().then(_ => { correctSound.pause(); correctSound.currentTime = 0; }).catch(_=>{});
  wrongSound.play().then(_ => { wrongSound.pause(); wrongSound.currentTime = 0; }).catch(_=>{});
}
startButton.addEventListener("click", unlockAudio, { once: true });

// Word pairs data
let allWordPairs = { easy: [], medium: [], hard: [] };
let wordPairs = [];
let usedIndices = [];
let currentPair = null;
let wordsLoaded = false;

// Game state
let promptTimeInterval = null;
let inGame = false;
let score = 0;
let lives = 3;
const MEDIUM_THRESHOLD = 5;
const HARD_THRESHOLD = 10;
const POINTS = { easy: 1, medium: 2, hard: 3 };

// Feedback element
const answerFeedback = document.createElement("div");
answerFeedback.id = "answerFeedback";
answerFeedback.style.fontWeight = "bold";
gameContainer.appendChild(answerFeedback);

// Disable start until words load
startButton.disabled = true;

// Helper functions
function findHighscoreIndex(s) {
  const idx = highscores.findIndex(h => h < s);
  return idx < 0 ? highscores.length - 1 : idx;
}
function updateScore() {
  const lvl = score >= HARD_THRESHOLD ? 'hard'
              : score >= MEDIUM_THRESHOLD ? 'medium'
              : 'easy';
  score += POINTS[lvl];
  scoreEl.innerText = `Score: ${score}`;
}
function updateLivesDisplay() {
  livesEl.innerText = `Lives: ${lives}`;
}
function showFeedback(isCorrect, msg = "") {
  inputWord.style.backgroundColor = isCorrect ? '#24c154' : '#c13c3c';
  inputWord.style.color = '#fff';
  answerFeedback.innerText = msg;
  answerFeedback.style.color = isCorrect ? '#24c154' : '#c13c3c';
  setTimeout(() => {
    inputWord.style.backgroundColor = '';
    inputWord.style.color = '';
    if (isCorrect) answerFeedback.innerText = '';
  }, 400);
}
function showCorrectAnswer(text) {
  answerFeedback.innerText = `Correct answer: ${text}`;
  setTimeout(() => { answerFeedback.innerText = ''; }, 2000);
}
function selectDifficulty() {
  return score >= HARD_THRESHOLD ? 'hard'
         : score >= MEDIUM_THRESHOLD ? 'medium'
         : 'easy';
}
function loadPool(level) {
  wordPairs = allWordPairs[level] || [];
  usedIndices = [];
}
function resetDifficultyOnLifeLoss() {
  const curr = selectDifficulty();
  if (curr === 'hard') loadPool('medium');
  else if (curr === 'medium') loadPool('easy');
}
function getRandomUnusedPair() {
  if (!wordPairs.length) return null;
  if (usedIndices.length === wordPairs.length) usedIndices = [];
  let idx;
  do { idx = Math.floor(Math.random() * wordPairs.length); }
  while (usedIndices.includes(idx));
  usedIndices.push(idx);
  return wordPairs[idx];
}
function checkGameOver() {
  if (lives <= 0) { endGame(); return true; }
  return false;
}

// Prompt timeout handler
function handlePromptTimeout() {
  clearInterval(promptTimeInterval);
  wrongSound.play().catch(_=>{});
  showFeedback(false, "Time's up!");
  showCorrectAnswer(currentPair.english);
  lives -= 1;
  updateLivesDisplay();
  resetDifficultyOnLifeLoss();
  if (!checkGameOver()) setTimeout(nextPrompt, 2000);
}

// Main prompt function
function nextPrompt() {
  clearInterval(promptTimeInterval);
  const lvl = selectDifficulty();
  loadPool(lvl);
  currentPair = getRandomUnusedPair();
  if (!currentPair) { wordPrompt.innerText = 'No words loaded.'; return; }

  wordPrompt.innerText = currentPair.french;
  inputWord.value = '';
  inputWord.focus();
  answerFeedback.innerText = '';

  if (infiniteModeInput.checked) { promptTimerEl.innerText = ''; return; }

  let timeLeft = parseInt(promptTimeInput.value, 10) || 8;
  promptTimerEl.innerText = `${timeLeft}s`;

  promptTimeInterval = setInterval(() => {
    timeLeft -= 1;
    promptTimerEl.innerText = `${timeLeft}s`;
    if (timeLeft <= 0) handlePromptTimeout();
  }, 1000);
}

// End game
function endGame() {
  clearInterval(promptTimeInterval);
  inGame = false;
  if (score > highscores[highscores.length - 1]) {
    highscores.splice(findHighscoreIndex(score), 0, score);
    highscores.pop();
    loadHighscores();
  }
  finalScoreEl.innerText = `Final Score: ${score}`;
  score = 0; lives = 3;
  updateLivesDisplay();
  loadPool('easy');
  gameContainer.style.display = 'none';
  startContainer.style.display = 'block';
}

// Start game
function startGame() {
  if (!wordsLoaded) { alert('Please wait, loading words...'); return; }
  inGame = true;
  startContainer.style.display = 'none';
  gameContainer.style.display = 'block';
  score = 0; lives = 3;
  scoreEl.innerText = 'Score: 0'; finalScoreEl.innerText = '';
  updateLivesDisplay();
  loadPool('easy');
  nextPrompt();
}

// Input handlers
startButton.addEventListener('click', startGame);
// 'Skip' feature removed
inputWord.addEventListener('keypress', e => {
  if (e.code === 'Enter') {
    const ans = inputWord.value.trim().toLowerCase();
    if (ans === (currentPair.english || '').toLowerCase()) {
      clearInterval(promptTimeInterval);
      correctSound.play().catch(_=>{});
      showFeedback(true, 'Correct!');
      updateScore();
      setTimeout(nextPrompt, 400);
    } else {
      wrongSound.play().catch(_=>{});
      showFeedback(false, 'Incorrect!');
      // timer continues
    }
  }
});

document.addEventListener('keypress', e => {
  if (e.code === 'Space' && !inGame && wordsLoaded) startGame();
});

// Settings popup (unchanged)
const exitSettings = () => { settingsContainer.style.display = 'none'; settingsBackground.style.display = 'none'; };
settingsButton.addEventListener('click', () => { settingsContainer.style.display = 'block'; settingsBackground.style.display = 'block'; settingsContainer.focus(); });
settingsBackground.addEventListener('click', exitSettings);
settingsContainer.addEventListener('keydown', e => { if (e.key === 'Escape') exitSettings(); });

// Initialize
window.addEventListener('DOMContentLoaded', () => { loadHighscores(); loadWordPairs(); });
async function loadWordPairs() {
  try {
    const res = await fetch('assets/wordPairs.json');
    const data = await res.json();
    allWordPairs = { easy: [], medium: [], hard: [] };
    data.forEach(p => { (allWordPairs[p.difficulty] || allWordPairs.easy).push(p); });
    wordsLoaded = true;
    startButton.disabled = false;
  } catch {
    alert('Failed to load word pairs.');
    startButton.disabled = true;
  }
}
