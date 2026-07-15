const NTFY_BASE = 'https://ntfy.sh';
const POLL_MS = 600;
const HEARTBEAT_MS = 4000;

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = String(pin).trim();
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.heartbeatTimer = null;
    this.pollTimer = null;
    this.lastIds = {};
    this.onMessage = null;
    this.connected = false;
    this._destroyed = false;
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

  _parsePayload(raw) {
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw);
      if (!envelope || typeof envelope !== 'object') return null;

      if (envelope.type) return envelope;

      if (envelope.event && envelope.event !== 'message') return null;

      const body = envelope.message;
      if (body == null) return null;

      if (typeof body === 'string') {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      }
      if (typeof body === 'object') return body;
    } catch {
      return null;
    }
    return null;
  }

  _handleRaw(raw) {
    const msg = this._parsePayload(raw);
    if (msg?.type) this.onMessage?.(msg);
  }

  _handleNtfyItem(item) {
    if (!item || item.event !== 'message') return;
    this._handleRaw(JSON.stringify(item));
  }

  _parseNdjson(text) {
    if (!text || !text.trim()) return [];
    const items = [];
    for (const line of text.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        items.push(JSON.parse(line));
      } catch {
        /* ignore bad line */
      }
    }
    return items;
  }

  async _pollOnce(topics) {
    for (const topic of topics) {
      if (this._destroyed) return;
      const since = this.lastIds[topic] || 'none';
      try {
        const res = await fetch(`${NTFY_BASE}/${topic}/json?poll=1&since=${since}`, {
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const items = this._parseNdjson(await res.text());
        for (const item of items) {
          if (item.id) this.lastIds[topic] = item.id;
          this._handleNtfyItem(item);
        }
      } catch {
        /* ignore single poll failure */
      }
    }
  }

  _startPolling(topics) {
    topics.forEach((topic) => {
      this.lastIds[topic] = 'none';
    });

    const tick = () => this._pollOnce(topics);
    tick();
    this.pollTimer = setInterval(tick, POLL_MS);
  }

  _startHeartbeat() {
    if (this.role !== 'host') return;
    const beat = () => this._publish(this._topic('all'), { type: 'host-ready', pin: this.pin });
    beat();
    this.heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
  }

  connect() {
    return new Promise((resolve, reject) => {
      const topics = this._listenTopics();
      let resolved = false;

      const finish = () => {
        if (resolved || this._destroyed) return;
        resolved = true;
        clearTimeout(timeout);
        this.connected = true;
        this._startHeartbeat();
        resolve();
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          this.destroy();
          reject(new Error('Verbindungs-Timeout. Internet prüfen.'));
        }
      }, 15000);

      this._startPolling(topics);
      setTimeout(finish, 800);
    });
  }

  async _publish(topic, msg) {
    try {
      await fetch(`${NTFY_BASE}/${topic}`, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: {
          'Content-Type': 'text/plain',
          'Cache': 'no',
        },
        keepalive: true,
      });
    } catch {
      /* ignore transient publish errors */
    }
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
    this._destroyed = true;
    this.connected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.heartbeatTimer = null;
    this.pollTimer = null;
  }

  getPlayerId() {
    return this.playerId;
  }
}

window.QuizTransport = QuizTransport;
