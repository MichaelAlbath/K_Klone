window.QUIZ_LIST = [
  { id: 'beispiel-quiz', title: 'Beispiel Quiz', questionCount: 5 },
  { id: 'vorlage', title: 'Mein Quiz (Vorlage)', questionCount: 2 },
];

window.QUIZ_DATA = {
  'beispiel-quiz': {
    title: 'Beispiel Quiz',
    description: 'Ein Demo-Quiz zum Testen',
    timePerQuestion: 20,
    questions: [
      { text: 'Was ist die Hauptstadt von Deutschland?', answers: ['Berlin', 'München', 'Hamburg', 'Köln'], correct: 0 },
      { text: 'Wie viele Bundesländer hat Deutschland?', answers: ['14', '15', '16', '17'], correct: 2 },
      { text: 'Welcher Ozean liegt westlich von Europa?', answers: ['Pazifik', 'Atlantik', 'Indischer Ozean', 'Arktischer Ozean'], correct: 1 },
      { text: "Was bedeutet 'WLAN'?", answers: ['Wireless Local Area Network', 'Wide Long Area Network', 'Wired Local Access Node', 'Web Link And Network'], correct: 0 },
      { text: 'Welches Jahr war die Wiedervereinigung Deutschlands?', answers: ['1987', '1989', '1990', '1991'], correct: 2 },
    ],
  },
  vorlage: {
    title: 'Mein Quiz',
    description: 'Beschreibung deines Quiz',
    timePerQuestion: 20,
    questions: [
      { text: 'Deine Frage hier?', answers: ['Antwort A', 'Antwort B', 'Antwort C', 'Antwort D'], correct: 0 },
      { text: 'Zweite Frage?', answers: ['Ja', 'Nein', 'Vielleicht', 'Weiß nicht'], correct: 1 },
    ],
  },
};
