const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3000;
const QUIZZES_DIR = path.join(__dirname, 'quizzes');

const ANSWER_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const PHASES = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  REVEAL: 'reveal',
  LEADERBOARD: 'leaderboard',
  PODIUM: 'podium',
};

let game = null;

function loadQuizzes() {
  if (!fs.existsSync(QUIZZES_DIR)) fs.mkdirSync(QUIZZES_DIR, { recursive: true });
  return fs
    .readdirSync(QUIZZES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(QUIZZES_DIR, f), 'utf8'));
      return { id: f.replace('.json', ''), filename: f, title: data.title, questionCount: data.questions?.length || 0 };
    });
}

function loadQuiz(quizId) {
  const file = path.join(QUIZZES_DIR, `${quizId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createGame(quizId) {
  const quiz = loadQuiz(quizId);
  if (!quiz) return null;

  return {
    pin: generatePin(),
    quizId,
    quiz,
    phase: PHASES.LOBBY,
    currentQuestion: -1,
    questionStartTime: null,
    players: new Map(),
    answers: new Map(),
    hostSocketId: null,
  };
}

function getPlayerList() {
  if (!game) return [];
  return Array.from(game.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score);
}

function getLeaderboard(limit = 10) {
  return getPlayerList().slice(0, limit);
}

function calculatePoints(timeMs, timeLimitSec) {
  const maxPoints = 1000;
  const timeLimitMs = timeLimitSec * 1000;
  const ratio = Math.min(timeMs / timeLimitMs, 1);
  return Math.max(Math.floor(maxPoints * (1 - ratio * 0.5)), 100);
}

function getPublicQuestion(q, index) {
  return {
    index,
    total: game.quiz.questions.length,
    text: q.text,
    answers: q.answers.map((a, i) => ({ text: a, color: ANSWER_COLORS[i] })),
    timeLimit: game.quiz.timePerQuestion || 20,
  };
}

function getHostState() {
  if (!game) return null;
  const q = game.currentQuestion >= 0 ? game.quiz.questions[game.currentQuestion] : null;
  return {
    pin: game.pin,
    phase: game.phase,
    quizTitle: game.quiz.title,
    currentQuestion: game.currentQuestion,
    totalQuestions: game.quiz.questions.length,
    players: getPlayerList(),
    playerCount: game.players.size,
    question: q ? getPublicQuestion(q, game.currentQuestion) : null,
    correctIndex: q && (game.phase === PHASES.REVEAL || game.phase === PHASES.LEADERBOARD) ? q.correct : null,
    answerStats: getAnswerStats(),
    leaderboard: getLeaderboard(),
    answeredCount: game.answers.size,
  };
}

function getAnswerStats() {
  if (!game || game.currentQuestion < 0) return [0, 0, 0, 0];
  const stats = [0, 0, 0, 0];
  for (const ans of game.answers.values()) {
    if (ans.answerIndex >= 0 && ans.answerIndex < 4) stats[ans.answerIndex]++;
  }
  return stats;
}

function broadcastState() {
  if (!game) return;
  io.to('host').emit('game:state', getHostState());
  io.to(`game:${game.pin}`).emit('game:phase', {
    phase: game.phase,
    currentQuestion: game.currentQuestion,
    totalQuestions: game.quiz.questions.length,
    playerCount: game.players.size,
  });
}

function startQuestion() {
  game.phase = PHASES.QUESTION;
  game.answers.clear();
  game.questionStartTime = Date.now();
  const q = game.quiz.questions[game.currentQuestion];

  io.to('host').emit('game:state', getHostState());
  io.to(`game:${game.pin}`).emit('question:start', getPublicQuestion(q, game.currentQuestion));

  const timeLimit = (game.quiz.timePerQuestion || 20) * 1000;
  game.questionTimer = setTimeout(() => revealAnswers(), timeLimit);
}

function revealAnswers() {
  if (!game || game.phase !== PHASES.QUESTION) return;
  clearTimeout(game.questionTimer);

  const q = game.quiz.questions[game.currentQuestion];
  game.phase = PHASES.REVEAL;

  for (const [playerId, ans] of game.answers) {
    const player = game.players.get(playerId);
    if (!player) continue;
    if (ans.answerIndex === q.correct) {
      const points = calculatePoints(ans.timeMs, game.quiz.timePerQuestion || 20);
      player.score += points;
      ans.points = points;
      ans.correct = true;
    } else {
      ans.correct = false;
      ans.points = 0;
    }
  }

  io.to('host').emit('game:state', getHostState());
  io.to(`game:${game.pin}`).emit('question:reveal', {
    correctIndex: q.correct,
    results: Object.fromEntries(
      Array.from(game.answers.entries()).map(([id, a]) => [id, { correct: a.correct, points: a.points }])
    ),
  });

  setTimeout(() => showLeaderboard(), 3000);
}

function showLeaderboard() {
  if (!game) return;
  game.phase = PHASES.LEADERBOARD;
  io.to('host').emit('game:state', getHostState());
  io.to(`game:${game.pin}`).emit('leaderboard:show', { leaderboard: getLeaderboard(5) });
}

function showPodium() {
  if (!game) return;
  game.phase = PHASES.PODIUM;
  const top = getLeaderboard(3);
  io.to('host').emit('game:state', getHostState());
  io.to(`game:${game.pin}`).emit('podium:show', { podium: top });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/host', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/play', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

app.get('/api/quizzes', (_req, res) => {
  res.json(loadQuizzes());
});

app.get('/api/quiz/:id', (req, res) => {
  const quiz = loadQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz nicht gefunden' });
  res.json(quiz);
});

app.get('/api/qrcode', async (req, res) => {
  const pin = req.query.pin || '';
  const host = req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const joinUrl = `${proto}://${host}/play?pin=${pin}`;
  try {
    const svg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 256 });
    res.type('svg').send(svg);
  } catch {
    res.status(500).send('QR-Code Fehler');
  }
});

app.get('/api/join-url', (req, res) => {
  const pin = req.query.pin || '';
  const host = req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  res.json({ url: `${proto}://${host}/play?pin=${pin}` });
});

io.on('connection', (socket) => {
  socket.on('host:create', ({ quizId }, cb) => {
    if (game && game.phase !== PHASES.LOBBY && game.phase !== PHASES.PODIUM) {
      return cb?.({ error: 'Ein Spiel läuft bereits' });
    }
    game = createGame(quizId);
    if (!game) return cb?.({ error: 'Quiz nicht gefunden' });

    game.hostSocketId = socket.id;
    socket.join('host');
    socket.join(`game:${game.pin}`);
    cb?.({ ok: true, state: getHostState() });
    broadcastState();
  });

  socket.on('host:start', () => {
    if (!game || socket.id !== game.hostSocketId) return;
    if (game.players.size === 0) return;
    game.currentQuestion = 0;
    startQuestion();
  });

  socket.on('host:next', () => {
    if (!game || socket.id !== game.hostSocketId) return;

    if (game.phase === PHASES.LEADERBOARD) {
      game.currentQuestion++;
      if (game.currentQuestion >= game.quiz.questions.length) {
        showPodium();
      } else {
        startQuestion();
      }
    } else if (game.phase === PHASES.QUESTION) {
      revealAnswers();
    }
  });

  socket.on('host:reset', () => {
    if (!game || socket.id !== game.hostSocketId) return;
    const quizId = game.quizId;
    const pin = game.pin;
    for (const p of game.players.values()) p.score = 0;
    game.currentQuestion = -1;
    game.phase = PHASES.LOBBY;
    game.answers.clear();
    clearTimeout(game.questionTimer);
    io.to(`game:${pin}`).emit('game:reset');
    broadcastState();
  });

  socket.on('host:end', () => {
    if (!game || socket.id !== game.hostSocketId) return;
    const pin = game.pin;
    io.to(`game:${pin}`).emit('game:ended');
    game = null;
    socket.emit('game:state', null);
  });

  socket.on('player:join', ({ pin, name }, cb) => {
    if (!game || game.pin !== pin) return cb?.({ error: 'Spiel nicht gefunden. PIN prüfen.' });
    if (game.phase !== PHASES.LOBBY) return cb?.({ error: 'Spiel hat bereits begonnen.' });

    const trimmed = (name || '').trim().slice(0, 15);
    if (!trimmed) return cb?.({ error: 'Bitte einen Namen eingeben.' });

    const taken = Array.from(game.players.values()).some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.connected
    );
    if (taken) return cb?.({ error: 'Name bereits vergeben.' });

    const playerId = socket.id;
    game.players.set(playerId, {
      id: playerId,
      name: trimmed,
      score: 0,
      connected: true,
      socketId: socket.id,
    });

    socket.join(`game:${pin}`);
    socket.playerId = playerId;
    socket.gamePin = pin;

    cb?.({
      ok: true,
      playerId,
      player: { name: trimmed, score: 0 },
    });
    broadcastState();
  });

  socket.on('player:answer', ({ answerIndex }) => {
    if (!game || game.phase !== PHASES.QUESTION) return;
    if (!socket.playerId || game.answers.has(socket.playerId)) return;
    if (answerIndex < 0 || answerIndex > 3) return;

    const timeMs = Date.now() - game.questionStartTime;
    game.answers.set(socket.playerId, { answerIndex, timeMs });

    socket.emit('answer:received', { answerIndex });

    io.to('host').emit('game:state', getHostState());

    if (game.answers.size >= game.players.size) {
      clearTimeout(game.questionTimer);
      setTimeout(() => revealAnswers(), 500);
    }
  });

  socket.on('player:rejoin', ({ pin, playerId, name }, cb) => {
    if (!game || game.pin !== pin) return cb?.({ error: 'Spiel nicht gefunden' });
    const existing = game.players.get(playerId);
    if (existing) {
      existing.connected = true;
      existing.socketId = socket.id;
      socket.playerId = playerId;
      socket.gamePin = pin;
      socket.join(`game:${pin}`);
      cb?.({ ok: true, player: existing, state: getPlayerGameState(playerId) });
      broadcastState();
    } else {
      cb?.({ error: 'Spieler nicht gefunden' });
    }
  });

  socket.on('disconnect', () => {
    if (game && socket.id === game.hostSocketId) {
      // Host disconnected – game continues
    }
    if (socket.playerId && game) {
      const player = game.players.get(socket.playerId);
      if (player) {
        player.connected = false;
        broadcastState();
      }
    }
  });
});

function getPlayerGameState(playerId) {
  if (!game) return null;
  const player = game.players.get(playerId);
  const state = {
    phase: game.phase,
    currentQuestion: game.currentQuestion,
    totalQuestions: game.quiz.questions.length,
    player: player ? { name: player.name, score: player.score } : null,
  };

  if (game.phase === PHASES.QUESTION && game.currentQuestion >= 0) {
    const q = game.quiz.questions[game.currentQuestion];
    state.question = getPublicQuestion(q, game.currentQuestion);
    state.alreadyAnswered = game.answers.has(playerId);
  }

  if (game.phase === PHASES.REVEAL || game.phase === PHASES.LEADERBOARD) {
    const q = game.quiz.questions[game.currentQuestion];
    const ans = game.answers.get(playerId);
    state.reveal = {
      correctIndex: q.correct,
      yourAnswer: ans?.answerIndex ?? -1,
      correct: ans?.correct ?? false,
      points: ans?.points ?? 0,
    };
  }

  if (game.phase === PHASES.LEADERBOARD) {
    state.leaderboard = getLeaderboard(5);
  }

  if (game.phase === PHASES.PODIUM) {
    state.podium = getLeaderboard(3);
    state.rank = getPlayerList().findIndex((p) => p.id === playerId) + 1;
  }

  return state;
}

function getLocalIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║         KAHOOT KLONE – Quiz Server           ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Host (Beamer):  http://localhost:${PORT}/host`);
  console.log(`  ║  Spieler:         http://${ip}:${PORT}/play`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
