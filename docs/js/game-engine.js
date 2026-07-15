const ANSWER_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];

const PHASES = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  REVEAL: 'reveal',
  LEADERBOARD: 'leaderboard',
  PODIUM: 'podium',
};

function calculatePoints(timeMs, timeLimitSec) {
  const maxPoints = 1000;
  const timeLimitMs = timeLimitSec * 1000;
  const ratio = Math.min(timeMs / timeLimitMs, 1);
  return Math.max(Math.floor(maxPoints * (1 - ratio * 0.5)), 100);
}

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.pin = null;
    this.quiz = null;
    this.phase = PHASES.LOBBY;
    this.currentQuestion = -1;
    this.questionStartTime = null;
    this.players = new Map();
    this.answers = new Map();
    this.questionTimer = null;
    this.onStateChange = null;
    this.onQuestionStart = null;
    this.onReveal = null;
    this.onLeaderboard = null;
    this.onPodium = null;
    this.onPlayerJoin = null;
  }

  createGame(quiz) {
    this.reset();
    this.pin = generatePin();
    this.quiz = quiz;
    this.phase = PHASES.LOBBY;
    this.emitState();
    return this.pin;
  }

  addPlayer(playerId, name) {
    const trimmed = (name || '').trim().slice(0, 15);
    if (!trimmed) return { error: 'Bitte einen Namen eingeben.' };

    const taken = Array.from(this.players.values()).some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (taken) return { error: 'Name bereits vergeben.' };

    this.players.set(playerId, { id: playerId, name: trimmed, score: 0 });
    this.onPlayerJoin?.(playerId);
    this.emitState();
    return { ok: true, player: this.players.get(playerId) };
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.emitState();
  }

  getPlayerList() {
    return Array.from(this.players.values()).sort((a, b) => b.score - a.score);
  }

  getLeaderboard(limit = 10) {
    return this.getPlayerList().slice(0, limit);
  }

  getPublicQuestion(index) {
    const q = this.quiz.questions[index];
    return {
      index,
      total: this.quiz.questions.length,
      text: q.text,
      answers: q.answers.map((a, i) => ({ text: a, color: ANSWER_COLORS[i] })),
      timeLimit: this.quiz.timePerQuestion || 20,
    };
  }

  getAnswerStats() {
    const stats = [0, 0, 0, 0];
    for (const ans of this.answers.values()) {
      if (ans.answerIndex >= 0 && ans.answerIndex < 4) stats[ans.answerIndex]++;
    }
    return stats;
  }

  getHostState() {
    const q = this.currentQuestion >= 0 ? this.quiz.questions[this.currentQuestion] : null;
    return {
      pin: this.pin,
      phase: this.phase,
      quizTitle: this.quiz.title,
      currentQuestion: this.currentQuestion,
      totalQuestions: this.quiz.questions.length,
      players: this.getPlayerList(),
      playerCount: this.players.size,
      question: q ? this.getPublicQuestion(this.currentQuestion) : null,
      correctIndex:
        q && (this.phase === PHASES.REVEAL || this.phase === PHASES.LEADERBOARD) ? q.correct : null,
      answerStats: this.getAnswerStats(),
      leaderboard: this.getLeaderboard(),
      answeredCount: this.answers.size,
    };
  }

  getPlayerState(playerId) {
    const player = this.players.get(playerId);
    const state = {
      phase: this.phase,
      currentQuestion: this.currentQuestion,
      totalQuestions: this.quiz.questions.length,
      player: player ? { name: player.name, score: player.score } : null,
    };

    if (this.phase === PHASES.QUESTION && this.currentQuestion >= 0) {
      state.question = this.getPublicQuestion(this.currentQuestion);
      state.alreadyAnswered = this.answers.has(playerId);
    }

    if (this.phase === PHASES.REVEAL || this.phase === PHASES.LEADERBOARD) {
      const q = this.quiz.questions[this.currentQuestion];
      const ans = this.answers.get(playerId);
      state.reveal = {
        correctIndex: q.correct,
        yourAnswer: ans?.answerIndex ?? -1,
        correct: ans?.correct ?? false,
        points: ans?.points ?? 0,
      };
    }

    if (this.phase === PHASES.LEADERBOARD) state.leaderboard = this.getLeaderboard(5);
    if (this.phase === PHASES.PODIUM) {
      state.podium = this.getLeaderboard(3);
      state.rank = this.getPlayerList().findIndex((p) => p.id === playerId) + 1;
    }

    return state;
  }

  emitState() {
    this.onStateChange?.(this.getHostState());
  }

  startGame() {
    if (this.players.size === 0) return false;
    this.currentQuestion = 0;
    this.startQuestion();
    return true;
  }

  startQuestion() {
    clearTimeout(this.questionTimer);
    this.phase = PHASES.QUESTION;
    this.answers.clear();
    this.questionStartTime = Date.now();
    const question = this.getPublicQuestion(this.currentQuestion);

    this.emitState();
    this.onQuestionStart?.(question);

    const timeLimit = (this.quiz.timePerQuestion || 20) * 1000;
    this.questionTimer = setTimeout(() => this.revealAnswers(), timeLimit);
  }

  submitAnswer(playerId, answerIndex) {
    if (this.phase !== PHASES.QUESTION) return false;
    if (this.answers.has(playerId)) return false;
    if (answerIndex < 0 || answerIndex > 3) return false;

    const timeMs = Date.now() - this.questionStartTime;
    this.answers.set(playerId, { answerIndex, timeMs });
    this.emitState();

    if (this.answers.size >= this.players.size) {
      clearTimeout(this.questionTimer);
      setTimeout(() => this.revealAnswers(), 500);
    }
    return true;
  }

  revealAnswers() {
    if (this.phase !== PHASES.QUESTION) return;
    clearTimeout(this.questionTimer);

    const q = this.quiz.questions[this.currentQuestion];
    this.phase = PHASES.REVEAL;

    const results = {};
    for (const [playerId, ans] of this.answers) {
      const player = this.players.get(playerId);
      if (!player) continue;
      if (ans.answerIndex === q.correct) {
        const points = calculatePoints(ans.timeMs, this.quiz.timePerQuestion || 20);
        player.score += points;
        ans.points = points;
        ans.correct = true;
      } else {
        ans.correct = false;
        ans.points = 0;
      }
      results[playerId] = { correct: ans.correct, points: ans.points };
    }

    this.emitState();
    this.onReveal?.({ correctIndex: q.correct, results });
    setTimeout(() => this.showLeaderboard(), 3000);
  }

  showLeaderboard() {
    this.phase = PHASES.LEADERBOARD;
    this.emitState();
    this.onLeaderboard?.({ leaderboard: this.getLeaderboard(5) });
  }

  showPodium() {
    this.phase = PHASES.PODIUM;
    this.emitState();
    this.onPodium?.({ podium: this.getLeaderboard(3) });
  }

  next() {
    if (this.phase === PHASES.LEADERBOARD) {
      this.currentQuestion++;
      if (this.currentQuestion >= this.quiz.questions.length) {
        this.showPodium();
      } else {
        this.startQuestion();
      }
    } else if (this.phase === PHASES.QUESTION) {
      this.revealAnswers();
    }
  }

  resetGame() {
    for (const p of this.players.values()) p.score = 0;
    this.currentQuestion = -1;
    this.phase = PHASES.LOBBY;
    this.answers.clear();
    clearTimeout(this.questionTimer);
    this.emitState();
    return true;
  }

  endGame() {
    clearTimeout(this.questionTimer);
    this.reset();
  }
}

window.GameEngine = GameEngine;
window.PHASES = PHASES;
