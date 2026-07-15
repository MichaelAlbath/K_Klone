const socket = io();
const sound = new SoundManager();

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const SHAPES = ['▲', '◆', '●', '■'];

let state = null;
let timerInterval = null;

const screens = {
  setup: document.getElementById('screen-setup'),
  lobby: document.getElementById('screen-lobby'),
  question: document.getElementById('screen-question'),
  reveal: document.getElementById('screen-reveal'),
  leaderboard: document.getElementById('screen-leaderboard'),
  podium: document.getElementById('screen-podium'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name]?.classList.remove('hidden');
}

async function loadQuizzes() {
  const res = await fetch('/api/quizzes');
  const quizzes = await res.json();
  const select = document.getElementById('quiz-select');
  select.innerHTML = quizzes
    .map((q) => `<option value="${q.id}">${q.title} (${q.questionCount} Fragen)</option>`)
    .join('');
}

document.getElementById('btn-create').addEventListener('click', () => {
  sound.init();
  const quizId = document.getElementById('quiz-select').value;
  socket.emit('host:create', { quizId }, (res) => {
    if (res?.error) return alert(res.error);
    state = res.state;
    showLobby();
  });
});

function showLobby() {
  showScreen('lobby');
  document.getElementById('pin-display').textContent = state.pin;
  document.getElementById('join-pin-big').textContent = state.pin;
  document.getElementById('quiz-title').textContent = state.quizTitle;
  updatePlayers();
  loadQR();
  sound.startLobbyMusic();
}

async function loadQR() {
  const origin = await resolvePlayOrigin();
  const joinUrl = buildJoinUrl(origin, state.pin);
  const urlEl = document.getElementById('join-url');
  urlEl.textContent = joinUrl;

  if (joinUrl.includes('localhost') || joinUrl.includes('127.0.0.1')) {
    urlEl.innerHTML =
      `${joinUrl}<br><strong style="color:#e21b3c">Ports → 3000 → „Open in Browser" klicken (nicht localhost)!</strong>`;
  }

  renderQR(document.getElementById('qr-code'), joinUrl);
}

function updatePlayers() {
  if (!state) return;
  document.getElementById('player-count').textContent = state.playerCount;
  const list = document.getElementById('player-list');
  const prevCount = list.children.length;
  list.innerHTML = state.players
    .filter((p) => p.connected)
    .map((p) => `<li>${escapeHtml(p.name)}</li>`)
    .join('');
  document.getElementById('btn-start').disabled = state.playerCount === 0;

  if (state.playerCount > prevCount) sound.playJoin();
}

document.getElementById('btn-start').addEventListener('click', () => {
  sound.stopMusic();
  sound.playStart();
  socket.emit('host:start');
});

document.getElementById('btn-next').addEventListener('click', () => {
  socket.emit('host:next');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  socket.emit('host:reset');
});

document.getElementById('btn-end').addEventListener('click', () => {
  socket.emit('host:end');
  showScreen('setup');
  sound.stopMusic();
});

document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.target.textContent = on ? '🔊' : '🔇';
});

socket.on('game:state', (newState) => {
  if (!newState) {
    showScreen('setup');
    return;
  }

  const prevPhase = state?.phase;
  const prevCount = state?.playerCount;
  state = newState;

  if (state.phase === 'lobby') {
    showScreen('lobby');
    updatePlayers();
    if (!document.getElementById('join-url').textContent) loadQR();
    sound.startLobbyMusic();
    return;
  }

  sound.stopMusic();

  if (state.phase === 'question') {
    showQuestion();
  } else if (state.phase === 'reveal') {
    showReveal();
  } else if (state.phase === 'leaderboard') {
    showLeaderboard();
  } else if (state.phase === 'podium') {
    if (prevPhase !== 'podium') {
      sound.playVictory();
      spawnConfetti();
    }
    showPodium();
  }

  if (state.playerCount !== prevCount && state.phase === 'lobby') {
    updatePlayers();
  }
});

function showQuestion() {
  showScreen('question');
  const q = state.question;
  document.getElementById('q-progress').textContent = `${q.index + 1} / ${q.total}`;
  document.getElementById('question-text').textContent = q.text;
  document.getElementById('answered-count').textContent = `${state.answeredCount} / ${state.playerCount}`;

  const grid = document.getElementById('answers-grid');
  grid.innerHTML = q.answers
    .map(
      (a, i) => `
    <div class="answer-card" style="background:${a.color}">
      <span class="shape">${SHAPES[i]}</span>
      ${escapeHtml(a.text)}
    </div>`
    )
    .join('');

  startTimer(q.timeLimit);
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  const fill = document.getElementById('timer-fill');
  const total = seconds;
  let remaining = seconds;
  fill.style.width = '100%';
  fill.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining -= 0.1;
    const pct = (remaining / total) * 100;
    fill.style.width = `${pct}%`;

    if (remaining <= 5) {
      fill.classList.add('urgent');
      if (Math.floor(remaining * 10) % 10 === 0) sound.playTick();
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      sound.playCountdown();
    }
  }, 100);
}

function showReveal() {
  clearInterval(timerInterval);
  showScreen('reveal');
  const q = state.question;
  document.getElementById('r-progress').textContent = `${q.index + 1} / ${q.total}`;
  document.getElementById('reveal-text').textContent = q.text;

  const total = state.answerStats.reduce((a, b) => a + b, 0) || 1;
  const grid = document.getElementById('reveal-grid');
  grid.innerHTML = q.answers
    .map((a, i) => {
      const pct = Math.round((state.answerStats[i] / total) * 100);
      const isCorrect = i === state.correctIndex;
      return `
      <div class="answer-card ${isCorrect ? 'correct' : 'dimmed'}" style="background:${a.color}">
        <span class="shape">${SHAPES[i]}</span>
        ${escapeHtml(a.text)}
        <span class="stat">${pct}%</span>
      </div>`;
    })
    .join('');
}

function showLeaderboard() {
  showScreen('leaderboard');
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = state.leaderboard
    .map(
      (p, i) => `
    <li>
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${escapeHtml(p.name)}</span>
      <span class="lb-score">${p.score}</span>
    </li>`
    )
    .join('');

  const isLast = state.currentQuestion >= state.totalQuestions - 1;
  document.getElementById('btn-next').textContent = isLast ? 'Podium anzeigen' : 'Nächste Frage';
}

function showPodium() {
  showScreen('podium');
  const top = state.leaderboard;
  const order = [1, 0, 2];
  const medals = ['🥈', '🥇', '🥉'];
  const places = ['place-2', 'place-1', 'place-3'];

  const podium = document.getElementById('podium');
  podium.innerHTML = order
    .map((idx) => {
      const p = top[idx];
      if (!p) return '';
      return `
      <div class="podium-place">
        <div class="podium-bar ${places[idx]}">
          <div class="podium-medal">${medals[idx]}</div>
          <div class="podium-name">${escapeHtml(p.name)}</div>
          <div class="podium-score">${p.score} Punkte</div>
        </div>
      </div>`;
    })
    .join('');
}

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.animationDelay = `${Math.random() * 2}s`;
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    if (Math.random() > 0.5) piece.style.borderRadius = '50%';
    container.appendChild(piece);
  }
  setTimeout(() => (container.innerHTML = ''), 5000);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function initApp() {
  loadQuizzes();
}

function showLoginError(show) {
  document.getElementById('login-error').classList.toggle('hidden', !show);
}

function enterApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-setup').classList.remove('hidden');
  initApp();
}

document.getElementById('btn-admin-login').addEventListener('click', () => {
  const pw = document.getElementById('admin-password').value;
  if (AdminAuth.login(pw)) {
    showLoginError(false);
    enterApp();
  } else {
    showLoginError(true);
  }
});

document.getElementById('admin-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-admin-login').click();
});

if (AdminAuth.isAuthenticated()) {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-setup').classList.remove('hidden');
  initApp();
}
