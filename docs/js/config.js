// Öffentliche URL für Teilnehmer (GitHub Pages)
const QUIZ_PUBLIC_BASE = 'https://michaelalbath.github.io/K_Klone/';

// Verbindungsserver (Firebase Realtime Database – einmalig einrichten, siehe FIREBASE-EINRICHTEN.bat)
// URL endet mit firebasedatabase.app (ohne / am Ende)
const FIREBASE_DB_URL = '';

// Optional: eigener Relay-Server (Render), falls Firebase nicht genutzt wird
const RELAY_URL = '';

function getPlayUrl() {
  return QUIZ_PUBLIC_BASE + 'SPIELEN.html';
}

function getJoinUrl(pin) {
  return `${getPlayUrl()}?pin=${pin}`;
}

window.QuizConfig = { QUIZ_PUBLIC_BASE, FIREBASE_DB_URL, RELAY_URL, getPlayUrl, getJoinUrl };
