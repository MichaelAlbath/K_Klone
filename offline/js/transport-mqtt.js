const NTFY_BASE = 'https://ntfy.sh';
const POLL_MS = 800;

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = String(pin).trim();
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.lastIds = {};
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.onMessage = null;
    this.connected = false;
  }

  _topic(suffix) {
    return `kk${this.pin}${suffix}`;
  }

  _pollTopics() {
    if (this.role === 'host') {
      return [this._topic('in')];
    }
    return [this._topic('all'), this._topic(`p${this.playerId}`)];
  }

  connect() {
    return new Promise((resolve) => {
      this.connected = true;
      this.pollTimer = setInterval(() => this._poll(), POLL_MS);
      if (this.role === 'host') {
        this._publish(this._topic('all'), { type: 'host-ready', pin: this.pin });
        this.heartbeatTimer = setInterval(() => {
          this._publish(this._topic('all'), { type: 'host-ready', pin: this.pin });
        }, 3000);
      }
      resolve();
    });
  }

  async _poll() {
    if (!this.connected) return;

    for (const topic of this._pollTopics()) {
      const since = this.lastIds[topic] || 'none';
      try {
        const res = await fetch(`${NTFY_BASE}/${topic}/json?poll=1&since=${since}`);
        if (!res.ok) continue;
        const messages = await res.json();
        if (!Array.isArray(messages)) continue;

        for (const entry of messages) {
          if (entry.id) this.lastIds[topic] = entry.id;
          if (!entry.message) continue;
          try {
            const msg = JSON.parse(entry.message);
            this.onMessage?.(msg);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* Netzwerk kurz nicht erreichbar – beim nächsten Poll erneut */
      }
    }
  }

  async _publish(topic, msg) {
    try {
      await fetch(`${NTFY_BASE}/${topic}`, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch {
      /* ignore */
    }
  }

  sendToHost(msg) {
    this._publish(this._topic('in'), { ...msg, playerId: this.playerId });
  }

  sendToPlayer(playerId, msg) {
    this._publish(this._topic(`p${playerId}`), msg);
  }

  broadcast(msg) {
    this._publish(this._topic('all'), msg);
  }

  destroy() {
    this.connected = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.pollTimer = null;
    this.heartbeatTimer = null;
  }

  getPlayerId() {
    return this.playerId;
  }
}

window.QuizTransport = QuizTransport;
