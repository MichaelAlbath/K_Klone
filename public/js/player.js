const socket = io();
const sound = new SoundManager();

let playerId = null;
let playerName = null;
let playerScore = 0;
let timerInterval = null;

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
if (pinFromUrl) {
  document.getElementById('input-pin').value = pinFromUrl;
}

document.getElementById('btn-join').addEventListener('click', joinGame);
document.getElementById('input-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinGame();
});
document.getElementById('input-pin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('input-name').focus();
});

document.getElementById('btn-rejoin').addEventListener('click', () => {
  playerId = null;
  showScreen('join');
});

function joinGame() {
  sound.init();
  const pin = document.getElementById('input-pin').value.trim();
  const name = document.getElementById('input-name').value.trim();
  const errorEl = document.getElementById('join-error');

  if (!pin || pin.length < 4) {
    showError('Bitte gültige PIN eingeben.');
    return;
  }

  socket.emit('player:join', { pin, name }, (res) => {
    if (res?.error) {
      showError(res.error);
      return;
    }

    errorEl.classList.add('hidden');
    playerId = res.playerId;
    playerName = res.player.name;
    playerScore = 0;

    document.getElementById('waiting-name').textContent = playerName;
    document.getElementById('player-avatar').textContent = playerName.charAt(0).toUpperCase();
    showScreen('waiting');
    sound.playJoin();
  });
}

function showError(msg) {
  const errorEl = document.getElementById('join-error');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

socket.on('game:phase', ({ phase }) => {
  if (phase === 'question') {
    // question:start handles display
  }
});

socket.on('question:start', (q) => {
  showQuestion(q);
});

function showQuestion(q) {
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
  document.querySelectorAll('.p-answer').forEach((b) => {
    b.classList.add('disabled');
  });
  btn.classList.add('selected');
  clearInterval(timerInterval);

  socket.emit('player:answer', { answerIndex: index });
  showScreen('answered');
}

socket.on('answer:received', () => {
  // already on answered screen
});

socket.on('question:reveal', (data) => {
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
});

socket.on('leaderboard:show', (data) => {
  showLeaderboard(data.leaderboard);
});

function showLeaderboard(leaderboard) {
  showScreen('leaderboard');
  const myRank = leaderboard.findIndex((p) => p.id === playerId) + 1;
  const inTop = myRank > 0;

  document.getElementById('lb-rank').textContent = inTop
    ? `Du bist auf Platz ${myRank}!`
    : 'Du bist noch nicht in den Top 5';

  const list = document.getElementById('p-leaderboard');
  list.innerHTML = leaderboard
    .map(
      (p, i) =>
        `<li class="${p.id === playerId ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(p.name)}</span><span>${p.score}</span></li>`
    )
    .join('');

  document.getElementById('p-total-score').textContent = `Deine Punkte: ${playerScore}`;
}

socket.on('podium:show', (data) => {
  showPodium(data.podium);
});

function showPodium(podium) {
  showScreen('podium');
  sound.playVictory();

  const allScores = podium;
  const myEntry = allScores.find((p) => p.id === playerId);
  const rankText = myEntry
    ? podium.indexOf(myEntry) + 1
    : '?';

  const rankLabels = { 1: 'Platz 1 – Du hast gewonnen!', 2: 'Platz 2 – Super!', 3: 'Platz 3 – Gut gemacht!' };
  document.getElementById('podium-rank-text').textContent =
    myEntry && rankText <= 3 ? rankLabels[rankText] : 'Spiel beendet!';
  document.getElementById('podium-score-text').textContent = `Deine Gesamtpunktzahl: ${playerScore}`;

  const medals = ['🥇', '🥈', '🥉'];
  document.getElementById('p-podium').innerHTML = podium
    .map((p, i) => `<li>${medals[i]} ${escapeHtml(p.name)} – ${p.score} Punkte</li>`)
    .join('');
}

socket.on('game:reset', () => {
  playerScore = 0;
  showScreen('waiting');
});

socket.on('game:ended', () => {
  showScreen('ended');
});

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
