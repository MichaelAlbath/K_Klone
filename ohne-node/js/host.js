const sound = new SoundManager();
const game = new GameEngine();

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const SHAPES = ['▲', '◆', '●', '■'];

let state = null;
let timerInterval = null;
let peer = null;
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

function sendToPlayer(playerId, msg) {
  const entry = playerConnections.get(playerId);
  if (entry?.conn?.open) entry.conn.send(msg);
}

function broadcast(msg) {
  for (const entry of playerConnections.values()) {
    if (entry.conn.open) entry.conn.send(msg);
  }
}

function initPeer(pin) {
  return new Promise((resolve, reject) => {
    if (peer) peer.destroy();
    playerConnections.clear();

    peer = new Peer(`kahoot-${pin}`, { debug: 1 });

    peer.on('open', () => resolve());
    peer.on('error', (err) => reject(err));

    peer.on('connection', (conn) => {
      const playerId = conn.peer;

      conn.on('data', (raw) => {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;

        if (msg.type === 'join') {
          const result = game.addPlayer(playerId, msg.name);
          if (result.error) {
            conn.send({ type: 'error', message: result.error });
            return;
          }
          playerConnections.set(playerId, { conn, name: msg.name });
          conn.send({
            type: 'joined',
            playerId,
            player: result.player,
            state: game.getPlayerState(playerId),
          });
          sound.playJoin();
        }

        if (msg.type === 'answer') {
          if (game.submitAnswer(playerId, msg.answerIndex)) {
            conn.send({ type: 'answer:received', answerIndex: msg.answerIndex });
          }
        }
      });

      conn.on('close', () => {
        if (playerId) {
          playerConnections.delete(playerId);
          game.removePlayer(playerId);
        }
      });
    });
  });
}

async function loadQuizzes() {
  const res = await fetch('quizzes/manifest.json');
  const quizzes = await res.json();
  const select = document.getElementById('quiz-select');
  select.innerHTML = quizzes
    .map((q) => `<option value="${q.id}">${q.title} (${q.questionCount} Fragen)</option>`)
    .join('');
}

document.getElementById('btn-create').addEventListener('click', async () => {
  sound.init();
  const quizId = document.getElementById('quiz-select').value;
  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = 'Verbinde...';

  try {
    const quizRes = await fetch(`quizzes/${quizId}.json`);
    const quiz = await quizRes.json();
    const pin = game.createGame(quiz);

    game.onStateChange = (s) => {
      state = s;
      renderFromState();
    };
    game.onQuestionStart = (q) => broadcast({ type: 'question:start', question: q });
    game.onReveal = (data) => broadcast({ type: 'question:reveal', ...data });
    game.onLeaderboard = (data) => broadcast({ type: 'leaderboard:show', ...data });
    game.onPodium = (data) => broadcast({ type: 'podium:show', ...data });

    await initPeer(pin);
    state = game.getHostState();
    showLobby();
  } catch (err) {
    alert('Verbindung fehlgeschlagen. Internetverbindung prüfen und erneut versuchen.\n\n' + err.message);
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
  loadQR();
  sound.startLobbyMusic();
}

function loadQR() {
  const joinUrl = `${window.location.origin}${window.location.pathname.replace('host.html', 'play.html')}?pin=${state.pin}`;
  document.getElementById('join-url').textContent = joinUrl;
  const qrEl = document.getElementById('qr-code');
  qrEl.innerHTML = '';
  if (window.QRCode) {
    new QRCode(qrEl, { text: joinUrl, width: 200, height: 200, colorDark: '#46178f', colorLight: '#ffffff' });
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
  if (peer) peer.destroy();
  showScreen('setup');
  sound.stopMusic();
});

document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.target.textContent = on ? '🔊' : '🔇';
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

loadQuizzes();
