// File: public/js/offline.js

window.addEventListener('DOMContentLoaded', () => {
  // ─── CACHE DOM NODES ────
  // Grab the bits of the page we’ll need later.
  const highscoresEl       = document.getElementById('highscores')
  const startContainer     = document.getElementById('startContainer')
  const gameContainer      = document.getElementById('gameContainer')
  const startButton        = document.getElementById('startButton')
  const wordPrompt         = document.getElementById('wordPrompt')
  const inputWord          = document.getElementById('inputWord')
  const finalScoreEl       = document.getElementById('finalScore')
  const scoreEl            = document.getElementById('score')
  const livesEl            = document.getElementById('lives')
  const promptTimerEl      = document.getElementById('promptTimer')
  const promptTimeInput    = document.getElementById('promptTimeInput')
  const infiniteModeInput  = document.getElementById('infiniteModeInput')
  const settingsButton     = document.getElementById('settingsButton')
  const settingsBackground = document.getElementById('settingsBackground')
  const settingsContainer  = document.getElementById('settingsContainer')

  // ─── HIGH-SCORES STORAGE ───
  // We store a rolling top-5 in localStorage, separated by “;”
  let highscores = localStorage.getItem('highscores') || Array(5).fill(0)
  if (typeof highscores === 'string') highscores = highscores.split(';')
  function loadHighscores() {
    // Render the list and write back to localStorage
    highscoresEl.innerHTML = ''
    localStorage.setItem('highscores', highscores.join(';'))
    highscores.forEach(h => {
      const li = document.createElement('li')
      li.innerText = h
      highscoresEl.append(li)
    })
  }

  // ─── AUDIO SETUP ──────
  // Pre-load sound effects and unlock on first click
  const correctSound = new Audio('assets/sound/sfx/correct.wav')
  const wrongSound   = new Audio('assets/sound/sfx/incorrect.wav')
  function unlockAudio() {
    // Tiny hack to let browsers play audio later without blocking
    correctSound.play().then(_ => {
      correctSound.pause()
      correctSound.currentTime = 0
    }).catch(_=>{})
    wrongSound.play().then(_ => {
      wrongSound.pause()
      wrongSound.currentTime = 0
    }).catch(_=>{})
  }
  startButton.addEventListener('click', unlockAudio, { once: true })

  // ─── GAME STATE & CONSTANTS ──────
  // Holds our words by difficulty, current score, lives, etc.
  let allWordPairs       = { easy: [], medium: [], hard: [] }
  let wordPairs          = []
  let usedIndices        = []
  let currentPair        = null
  let wordsLoaded        = false
  let promptTimeInterval = null
  let inGame             = false
  let score              = 0
  let lives              = 3

  // At what points do we bump up a difficulty tier?
  const MEDIUM_THRESHOLD = 5
  const HARD_THRESHOLD   = 10
  const POINTS           = { easy: 1, medium: 2, hard: 3 }

  // ─── FEEDBACK OVERLAY ──────
  // A little div to flash “Correct!” or show the right answer
  const answerFeedback = document.createElement('div')
  answerFeedback.id                = 'answerFeedback'
  answerFeedback.style.fontWeight  = 'bold'
  gameContainer.append(answerFeedback)

  startButton.disabled = true // blocked until words arrive

  // ─── HELPERS ────
  // Find where a new score would slot into our top-5
  function findHighscoreIndex(s) {
    const idx = highscores.findIndex(h => h < s)
    return idx < 0 ? highscores.length - 1 : idx
  }
  // Increase the score by the correct tier’s points
  function updateScore() {
    const tier = score >= HARD_THRESHOLD
               ? 'hard'
               : score >= MEDIUM_THRESHOLD
                 ? 'medium'
                 : 'easy'
    score += POINTS[tier]
    scoreEl.innerText = `Score: ${score}`
  }
  // Show remaining lives
  function updateLivesDisplay() {
    livesEl.innerText = `Lives: ${lives}`
  }
  // Flash green/red on correct/incorrect
  function showFeedback(isCorrect, msg='') {
    inputWord.style.backgroundColor = isCorrect ? '#24c154' : '#c13c3c'
    inputWord.style.color           = '#fff'
    answerFeedback.innerText        = msg
    answerFeedback.style.color      = isCorrect ? '#24c154' : '#c13c3c'
    setTimeout(() => {
      inputWord.style.backgroundColor = ''
      inputWord.style.color           = ''
      if (isCorrect) answerFeedback.innerText = ''
    }, 400)
  }
  // After a wrong guess or timeout, reveal the right answer
  function showCorrectAnswer(txt) {
    answerFeedback.innerText = `Correct answer: ${txt}`
    setTimeout(() => { answerFeedback.innerText = '' }, 2000)
  }
  // Choose difficulty based on how many points you’ve racked up
  function selectDifficulty() {
    return score >= HARD_THRESHOLD
      ? 'hard'
      : score >= MEDIUM_THRESHOLD
        ? 'medium'
        : 'easy'
  }
  // Load a fresh pool for the current difficulty
  function loadPool(level) {
    wordPairs   = allWordPairs[level] || []
    usedIndices = []
  }
  // If you lose a life, maybe drop you down a tier
  function resetDifficultyOnLifeLoss() {
    const curr = selectDifficulty()
    if (curr === 'hard')   loadPool('medium')
    else if (curr === 'medium') loadPool('easy')
  }
  // Pick a random unseen word from the current pool
  function getRandomUnusedPair() {
    if (!wordPairs.length) return null
    if (usedIndices.length === wordPairs.length) usedIndices = []
    let idx
    do { idx = Math.floor(Math.random() * wordPairs.length) }
    while (usedIndices.includes(idx))
    usedIndices.push(idx)
    return wordPairs[idx]
  }
  // Check if game over and bail out
  function checkGameOver() {
    if (lives <= 0) {
      endGame()
      return true
    }
    return false
  }

  // ─── GAME LOOP: TIMEOUT & NEXT PROMPT ───────────
  function handlePromptTimeout() {
    clearInterval(promptTimeInterval)
    wrongSound.play().catch(_=>{})
    showFeedback(false, "Time's up!")
    showCorrectAnswer(currentPair.english)
    lives--
    updateLivesDisplay()
    resetDifficultyOnLifeLoss()
    if (!checkGameOver()) setTimeout(nextPrompt, 2000)
  }

  function nextPrompt() {
    clearInterval(promptTimeInterval)

    // Decide your tier, load pool, and grab a random word
    const lvl         = selectDifficulty()
    loadPool(lvl)
    currentPair       = getRandomUnusedPair()
    if (!currentPair) {
      wordPrompt.innerText = 'No words loaded.'
      return
    }

    // Show the French word and reset the input field
    wordPrompt.innerText = currentPair.french
    inputWord.value      = ''
    inputWord.focus()
    answerFeedback.innerText = ''

    // If infinite mode is on, skip the timer
    if (infiniteModeInput.checked) {
      promptTimerEl.innerText = ''
      return
    }

    // Otherwise, start the countdown
    let timeLeft = parseInt(promptTimeInput.value, 10) || 8
    promptTimerEl.innerText = `${timeLeft}s`
    promptTimeInterval = setInterval(() => {
      timeLeft--
      promptTimerEl.innerText = `${timeLeft}s`
      if (timeLeft <= 0) handlePromptTimeout()
    }, 1000)
  }

  // ─── END GAME: Tidy up, update highscores, reset UI ────
  function endGame() {
    clearInterval(promptTimeInterval)
    inGame = false

    // If you beat the lowest top-5 score, insert yourself
    if (score > highscores[highscores.length - 1]) {
      highscores.splice(findHighscoreIndex(score), 0, score)
      highscores.pop()
      loadHighscores()
    }

    // Show final score, then reset state for next run
    finalScoreEl.innerText = `Final Score: ${score}`
    score = 0
    lives = 3
    updateLivesDisplay()
    loadPool('easy')
    gameContainer.style.display  = 'none'
    startContainer.style.display = 'block'
  }

  // ─── USER INTERACTIONS ──────────
  startButton.addEventListener('click', startGame)
  inputWord.addEventListener('keypress', e => {
    if (e.code === 'Enter') {
      const ans = inputWord.value.trim().toLowerCase()
      if (ans === (currentPair?.english || '').toLowerCase()) {
        // Correct!
        clearInterval(promptTimeInterval)
        correctSound.play().catch(_=>{})
        showFeedback(true, 'Correct!')
        updateScore()
        setTimeout(nextPrompt, 400)
      } else {
        // Wrong – keep timer running
        wrongSound.play().catch(_=>{})
        showFeedback(false, 'Incorrect!')
      }
    }
  })
  document.addEventListener('keypress', e => {
    if (e.code === 'Space' && !inGame && wordsLoaded) startGame()
  })

  // ─── SETTINGS POPUP CONTROL ──────
  function exitSettings() {
    settingsContainer.style.display  = 'none'
    settingsBackground.style.display = 'none'
  }
  settingsButton.addEventListener('click', () => {
    settingsContainer.style.display  = 'block'
    settingsBackground.style.display = 'block'
    settingsContainer.focus()
  })
  settingsBackground.addEventListener('click', exitSettings)
  settingsContainer.addEventListener('keydown', e => {
    if (e.key === 'Escape') exitSettings()
  })

  // ─── BOOTSTRAP: LOAD HIGHSCORES & WORD LIST ──────
  loadHighscores()
  loadWordPairs()

  async function loadWordPairs() { // Fetch the word pairs from the server..
    console.log('▶️ Fetching word pairs…')
    try {
      const res  = await fetch('/api/wordPairs')
      const data = await res.json()
      console.log('✅ Received words:', data.length)

      // Sort words into easy/medium/hard buckets
      allWordPairs = { easy: [], medium: [], hard: [] }
      data.forEach(p => {
        (allWordPairs[p.difficulty] || allWordPairs.easy).push(p)
      })

      wordsLoaded    = true
      startButton.disabled = false
    } catch (err) {
      console.error('❌ Error loading words:', err)
      alert(`Could not load words:\n${err.message}`)
      startButton.disabled = true
    }
  }

  // Handle pressing “Start” from the title screen
  function startGame() {
    if (!wordsLoaded) {
      alert('Please wait, loading words…')
      return
    }
    inGame                 = true
    startContainer.style.display = 'none'
    gameContainer.style.display  = 'block'
    score                  = 0
    lives                  = 3
    scoreEl.innerText      = 'Score: 0'
    finalScoreEl.innerText = ''
    updateLivesDisplay()
    loadPool('easy')
    nextPrompt()
  }
})
