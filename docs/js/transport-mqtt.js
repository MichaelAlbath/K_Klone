const NTFY_BASE = 'https://ntfy.sh';

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = String(pin).trim();
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.sources = [];
    this.heartbeatTimer = null;
    this.onMessage = null;
    this.connected = false;
  }

  _topic(suffix) {
    return `kk${this.pin}-${suffix}`;
  }

  _playerTopic(id) {
    return this._topic(`player-${id}`);
  }

  _listenTopics() {
    if (this.role === 'host') {
      return [this._topic('in')];
    }
    return [this._topic('all'), this._playerTopic(this.playerId)];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const topics = this._listenTopics();
      let opened = 0;
      const needed = topics.length;

      const timeout = setTimeout(() => {
        this.destroy();
        reject(new Error('Verbindungs-Timeout. Internet prüfen.'));
      }, 15000);

      topics.forEach((topic) => {
        const es = new EventSource(`${NTFY_BASE}/${topic}/sse`);
        this.sources.push(es);

        es.onopen = () => {
          opened++;
          if (opened >= needed) {
            clearTimeout(timeout);
            this.connected = true;
            if (this.role === 'host') {
              this._publish(this._topic('all'), { type: 'host-ready', pin: this.pin });
              this.heartbeatTimer = setInterval(() => {
                this._publish(this._topic('all'), { type: 'host-ready', pin: this.pin });
              }, 4000);
            }
            resolve();
          }
        };

        es.onmessage = (event) => {
          if (!event.data) return;
          try {
            const msg = JSON.parse(event.data);
            this.onMessage?.(msg);
          } catch {
            /* ignore */
          }
        };
      });
    });
  }

  async _publish(topic, msg) {
    await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  sendToHost(msg) {
    this._publish(this._topic('in'), { ...msg, playerId: this.playerId });
  }

  sendToPlayer(playerId, msg) {
    this._publish(this._playerTopic(playerId), msg);
  }

  broadcast(msg) {
    this._publish(this._topic('all'), msg);
  }

  destroy() {
    this.connected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const es of this.sources) es.close();
    this.sources = [];
  }

  getPlayerId() {
    return this.playerId;
  }
}

window.QuizTransport = QuizTransport;
