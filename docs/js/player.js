const sound = new SoundManager();

let playerId = null;
let playerName = null;
let playerScore = 0;
let timerInterval = null;
let transport = null;

const screens = {
  join: document.getElementById('screen-join'),
  waiting: document.getElementById('screen-waiting'),
  question: document.getElementById('screen-question'),
  answered: document.getElementById('screen-answered'),
  feedback: document.getElementById('screen-feedback'),
  leaderboard: document.getElementById('screen-leaderboard'),
  podium: document.getElementById('screen-podium'),
  ended: document.getElementById('screen-ended'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name]?.classList.remove('hidden');
}

const params = new URLSearchParams(window.location.search);
const pinFromUrl = params.get('pin');
if (pinFromUrl) document.getElementById('input-pin').value = pinFromUrl;

document.getElementById('btn-join').addEventListener('click', joinGame);
document.getElementById('input-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinGame();
});

document.getElementById('btn-rejoin').addEventListener('click', () => {
  if (transport) transport.destroy();
  transport = null;
  playerId = null;
  showScreen('join');
});

async function joinGame() {
  sound.init();
  const pin = document.getElementById('input-pin').value.trim();
  const name = document.getElementById('input-name').value.trim();
  const errorEl = document.getElementById('join-error');
  const btn = document.getElementById('btn-join');

  if (!pin || pin.length < 4) {
    showError('Bitte gültige PIN eingeben.');
    return;
  }
  if (!name) {
    showError('Bitte einen Namen eingeben.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verbinde...';
  errorEl.classList.add('hidden');

  if (transport) transport.destroy();

  transport = new QuizTransport(pin, 'player');
  transport.onMessage = handleMessage;

  try {
    await transport.connect();
    const joinTimeout = setTimeout(() => {
      if (!playerId) {
        showError('Kein Host gefunden. PIN prüfen – auf dem Beamer muss „Spiel erstellen" aktiv sein.');
        btn.disabled = false;
        btn.textContent = 'Beitreten';
        transport.destroy();
        transport = null;
      }
    }, 8000);
    transport._joinTimeout = joinTimeout;
    transport.sendToHost({ type: 'join', name });
  } catch (err) {
    showError('Verbindung fehlgeschlagen. Host gestartet? Internet/WLAN prüfen.');
    btn.disabled = false;
    btn.textContent = 'Beitreten';
    transport.destroy();
    transport = null;
  }

  function handleMessage(msg) {

    if (msg.type === 'error') {
      showError(msg.message);
      btn.disabled = false;
      btn.textContent = 'Beitreten';
      return;
    }

    if (msg.type === 'joined') {
      if (transport._joinTimeout) clearTimeout(transport._joinTimeout);
      playerId = msg.playerId || transport.getPlayerId();
      playerName = msg.player.name;
      playerScore = 0;
      document.getElementById('waiting-name').textContent = playerName;
      document.getElementById('player-avatar').textContent = playerName.charAt(0).toUpperCase();
      showScreen('waiting');
      sound.playJoin();
      btn.disabled = false;
      btn.textContent = 'Beitreten';
      if (msg.state) applyPlayerState(msg.state);
    }

    if (msg.type === 'question:start') showQuestion(msg.question);
    if (msg.type === 'question:reveal') showReveal(msg);
    if (msg.type === 'leaderboard:show') showLeaderboard(msg.leaderboard);
    if (msg.type === 'podium:show') showPodium(msg.podium);
    if (msg.type === 'game:reset') {
      playerScore = 0;
      showScreen('waiting');
    }
    if (msg.type === 'game:ended') showScreen('ended');
    if (msg.type === 'answer:received') showScreen('answered');
  }
}

function applyPlayerState(s) {
  if (s.phase === 'question' && s.question) showQuestion(s.question);
  if (s.reveal) showReveal({ correctIndex: s.reveal.correctIndex, results: { [playerId]: { correct: s.reveal.correct, points: s.reveal.points } } });
  if (s.leaderboard) showLeaderboard(s.leaderboard);
  if (s.podium) showPodium(s.podium);
}

function showError(msg) {
  const errorEl = document.getElementById('join-error');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function showQuestion(q) {
  if (q.alreadyAnswered) {
    showScreen('answered');
    return;
  }
  showScreen('question');
  document.getElementById('p-score').textContent = playerScore;
  document.getElementById('p-question-text').textContent = q.text;

  const container = document.getElementById('p-answers');
  container.innerHTML = q.answers
    .map(
      (a, i) =>
        `<div class="p-answer" style="background:${a.color}" data-index="${i}">${escapeHtml(a.text)}</div>`
    )
    .join('');

  container.querySelectorAll('.p-answer').forEach((btn) => {
    btn.addEventListener('click', () => submitAnswer(parseInt(btn.dataset.index), btn));
  });

  startTimer(q.timeLimit);
}

function submitAnswer(index, btn) {
  document.querySelectorAll('.p-answer').forEach((b) => b.classList.add('disabled'));
  btn.classList.add('selected');
  clearInterval(timerInterval);
  transport.sendToHost({ type: 'answer', answerIndex: index });
}

function showReveal(data) {
  clearInterval(timerInterval);
  const result = data.results[playerId];
  const screen = screens.feedback;
  screen.classList.remove('correct', 'wrong');

  if (result?.correct) {
    screen.classList.add('correct');
    document.getElementById('feedback-icon').textContent = '✓';
    document.getElementById('feedback-text').textContent = 'Richtig!';
    document.getElementById('feedback-points').textContent = `+${result.points} Punkte`;
    playerScore += result.points;
    sound.playCorrect();
  } else {
    screen.classList.add('wrong');
    document.getElementById('feedback-icon').textContent = '✗';
    document.getElementById('feedback-text').textContent = 'Falsch!';
    document.getElementById('feedback-points').textContent = '0 Punkte';
    sound.playWrong();
  }
  showScreen('feedback');
}

function showLeaderboard(leaderboard) {
  showScreen('leaderboard');
  const myRank = leaderboard.findIndex((p) => p.id === playerId) + 1;
  document.getElementById('lb-rank').textContent =
    myRank > 0 ? `Du bist auf Platz ${myRank}!` : 'Du bist noch nicht in den Top 5';

  document.getElementById('p-leaderboard').innerHTML = leaderboard
    .map(
      (p, i) =>
        `<li class="${p.id === playerId ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(p.name)}</span><span>${p.score}</span></li>`
    )
    .join('');

  document.getElementById('p-total-score').textContent = `Deine Punkte: ${playerScore}`;
}

function showPodium(podium) {
  showScreen('podium');
  sound.playVictory();

  const myEntry = podium.find((p) => p.id === playerId);
  const rankText = myEntry ? podium.indexOf(myEntry) + 1 : 0;
  const rankLabels = { 1: 'Platz 1 – Du hast gewonnen!', 2: 'Platz 2 – Super!', 3: 'Platz 3 – Gut gemacht!' };

  document.getElementById('podium-rank-text').textContent =
    rankText && rankText <= 3 ? rankLabels[rankText] : 'Spiel beendet!';
  document.getElementById('podium-score-text').textContent = `Deine Gesamtpunktzahl: ${playerScore}`;

  const medals = ['🥇', '🥈', '🥉'];
  document.getElementById('p-podium').innerHTML = podium
    .map((p, i) => `<li>${medals[i]} ${escapeHtml(p.name)} – ${p.score} Punkte</li>`)
    .join('');
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  const el = document.getElementById('p-timer');
  let remaining = seconds;
  el.textContent = remaining;
  el.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    el.textContent = Math.max(remaining, 0);
    if (remaining <= 5) {
      el.classList.add('urgent');
      sound.playTick();
    }
    if (remaining <= 0) {
      clearInterval(timerInterval);
      sound.playCountdown();
      document.querySelectorAll('.p-answer').forEach((b) => b.classList.add('disabled'));
    }
  }, 1000);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
