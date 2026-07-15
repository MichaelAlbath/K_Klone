class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicInterval = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    return this.enabled;
  }

  playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playJoin() {
    this.init();
    this.playTone(523, 0.15);
    setTimeout(() => this.playTone(659, 0.15), 100);
    setTimeout(() => this.playTone(784, 0.2), 200);
  }

  playStart() {
    this.init();
    [392, 440, 494, 523, 587, 659, 784].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'square', 0.15), i * 120);
    });
  }

  playCountdown() {
    this.init();
    this.playTone(880, 0.1, 'square', 0.2);
  }

  playCorrect() {
    this.init();
    this.playTone(523, 0.12);
    setTimeout(() => this.playTone(659, 0.12), 100);
    setTimeout(() => this.playTone(784, 0.25), 200);
  }

  playWrong() {
    this.init();
    this.playTone(200, 0.3, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.15), 200);
  }

  playTick() {
    this.init();
    this.playTone(600, 0.05, 'square', 0.1);
  }

  playVictory() {
    this.init();
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => setTimeout(() => this.playTone(f, 0.3, 'square', 0.2), i * 200));
  }

  startLobbyMusic() {
    if (!this.enabled) return;
    this.stopMusic();
    this.init();
    const melody = [262, 294, 330, 349, 392, 349, 330, 294];
    let i = 0;
    this.musicInterval = setInterval(() => {
      if (!this.enabled) return;
      this.playTone(melody[i % melody.length], 0.3, 'triangle', 0.08);
      i++;
    }, 500);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

window.SoundManager = SoundManager;
