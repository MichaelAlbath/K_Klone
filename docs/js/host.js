const sound = new SoundManager();
const game = new GameEngine();

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const SHAPES = ['▲', '◆', '●', '■'];

let state = null;
let timerInterval = null;
let transport = null;
let playerConnections = new Map();

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

function broadcast(msg) {
  transport?.broadcast(msg);
}

function initTransport(pin) {
  return new Promise(async (resolve, reject) => {
    if (transport) transport.destroy();
    playerConnections.clear();

    transport = new QuizTransport(pin, 'host');
    transport.onMessage = (msg) => {
      const playerId = msg.playerId;
      if (!playerId) return;

      if (msg.type === 'join') {
        const result = game.addPlayer(playerId, msg.name);
        if (result.error) {
          transport.sendToPlayer(playerId, { type: 'error', message: result.error });
          return;
        }
        playerConnections.set(playerId, { name: msg.name });
        transport.sendToPlayer(playerId, {
          type: 'joined',
          playerId,
          player: result.player,
          state: game.getPlayerState(playerId),
        });
        sound.playJoin();
      }

      if (msg.type === 'answer') {
        if (game.submitAnswer(playerId, msg.answerIndex)) {
          transport.sendToPlayer(playerId, { type: 'answer:received', answerIndex: msg.answerIndex });
        }
      }
    };

    try {
      await transport.connect();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function loadQuizzes() {
  const select = document.getElementById('quiz-select');
  select.innerHTML = window.QUIZ_LIST.map(
    (q) => `<option value="${q.id}">${q.title} (${q.questionCount} Fragen)</option>`
  ).join('');
}

document.getElementById('btn-create').addEventListener('click', async () => {
  sound.init();
  const quizId = document.getElementById('quiz-select').value;
  const quiz = window.QUIZ_DATA[quizId];
  if (!quiz) return alert('Quiz nicht gefunden.');

  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = 'Verbinde...';

  try {
    const pin = game.createGame(quiz);

    game.onStateChange = (s) => {
      state = s;
      renderFromState();
    };
    game.onQuestionStart = (q) => broadcast({ type: 'question:start', question: q });
    game.onReveal = (data) => broadcast({ type: 'question:reveal', ...data });
    game.onLeaderboard = (data) => broadcast({ type: 'leaderboard:show', ...data });
    game.onPodium = (data) => broadcast({ type: 'podium:show', ...data });

    await initTransport(pin);
    state = game.getHostState();
    showLobby();
  } catch (err) {
    alert('Verbindung fehlgeschlagen. Internet prüfen und erneut versuchen.\n\n' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Spiel erstellen';
  }
});

function showLobby() {
  showScreen('lobby');
  document.getElementById('pin-display').textContent = state.pin;
  document.getElementById('quiz-title').textContent = state.quizTitle;
  updatePlayers();
  showJoinInfo();
  sound.startLobbyMusic();
}

function getPlayUrl() {
  return window.QuizConfig?.getPlayUrl() || 'https://michaelalbath.github.io/K_Klone/SPIELEN.html';
}

function showJoinInfo() {
  document.getElementById('join-pin-big').textContent = state.pin;
  const playUrl = getPlayUrl();
  const joinUrl = `${playUrl}?pin=${state.pin}`;

  const urlEl = document.getElementById('join-url');
  if (urlEl) urlEl.textContent = playUrl;

  const qrEl = document.getElementById('qr-code');
  qrEl.innerHTML = '';
  if (window.QRCode) {
    new QRCode(qrEl, {
      text: joinUrl,
      width: 180,
      height: 180,
      colorDark: '#46178f',
      colorLight: '#ffffff',
    });
  }
}

function updatePlayers() {
  if (!state) return;
  document.getElementById('player-count').textContent = state.playerCount;
  document.getElementById('player-list').innerHTML = state.players
    .map((p) => `<li>${escapeHtml(p.name)}</li>`)
    .join('');
  document.getElementById('btn-start').disabled = state.playerCount === 0;
}

function renderFromState() {
  if (!state) return;

  if (state.phase === 'lobby') {
    if (screens.lobby.classList.contains('hidden')) showLobby();
    else updatePlayers();
    return;
  }

  sound.stopMusic();

  if (state.phase === 'question') showQuestion();
  else if (state.phase === 'reveal') showReveal();
  else if (state.phase === 'leaderboard') showLeaderboard();
  else if (state.phase === 'podium') {
    sound.playVictory();
    spawnConfetti();
    showPodium();
  }
}

document.getElementById('btn-start').addEventListener('click', () => {
  sound.stopMusic();
  sound.playStart();
  game.startGame();
});

document.getElementById('btn-next').addEventListener('click', () => game.next());

document.getElementById('btn-restart').addEventListener('click', () => {
  game.resetGame();
  broadcast({ type: 'game:reset' });
});

document.getElementById('btn-end').addEventListener('click', () => {
  broadcast({ type: 'game:ended' });
  game.endGame();
  if (transport) transport.destroy();
  showScreen('setup');
  sound.stopMusic();
});

document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.target.textContent = on ? '🔊' : '🔇';
});

document.getElementById('btn-share').addEventListener('click', () => {
  const playUrl = state ? getPlayUrl() : '';
  const text = `Quiz mitmachen: ${playUrl}\nPIN: ${state?.pin || '------'}`;
  navigator.clipboard?.writeText(text).then(() => alert('Link kopiert – in Teams einfügen!'));
});

function showQuestion() {
  showScreen('question');
  const q = state.question;
  document.getElementById('q-progress').textContent = `${q.index + 1} / ${q.total}`;
  document.getElementById('question-text').textContent = q.text;
  document.getElementById('answered-count').textContent = `${state.answeredCount} / ${state.playerCount}`;

  document.getElementById('answers-grid').innerHTML = q.answers
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
  let remaining = seconds;
  fill.style.width = '100%';
  fill.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining -= 0.1;
    fill.style.width = `${(remaining / seconds) * 100}%`;
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
  document.getElementById('reveal-grid').innerHTML = q.answers
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
  document.getElementById('leaderboard-list').innerHTML = state.leaderboard
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

  document.getElementById('podium').innerHTML = order
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

function tryAdminLogin() {
  const pw = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('login-error');
  const loginScreen = document.getElementById('screen-login');

  if (AdminAuth.login(pw)) {
    errorEl.classList.add('hidden');
    loginScreen.classList.add('hidden');
    showScreen('setup');
    initApp();
  } else {
    errorEl.classList.remove('hidden');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

function initAuth() {
  const loginScreen = document.getElementById('screen-login');
  if (!loginScreen) {
    initApp();
    return;
  }

  if (AdminAuth.isAuthenticated()) {
    loginScreen.classList.add('hidden');
    showScreen('setup');
    initApp();
    return;
  }

  loginScreen.classList.remove('hidden');
  document.getElementById('btn-admin-login').addEventListener('click', tryAdminLogin);
  document.getElementById('admin-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryAdminLogin();
  });
  document.getElementById('admin-password').focus();
}

initAuth();
