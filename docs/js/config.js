// Öffentliche URL für Teilnehmer (GitHub Pages)
const QUIZ_PUBLIC_BASE = 'https://michaelalbath.github.io/K_Klone/';

function getPlayUrl() {
  return QUIZ_PUBLIC_BASE + 'SPIELEN.html';
}

function getJoinUrl(pin) {
  return `${getPlayUrl()}?pin=${pin}`;
}

window.QuizConfig = { QUIZ_PUBLIC_BASE, getPlayUrl, getJoinUrl };
