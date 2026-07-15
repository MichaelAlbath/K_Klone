const POLL_MS = 900;
const HEARTBEAT_MS = 5000;

function getBackend() {
  const cfg = window.QuizConfig || {};
  if (cfg.FIREBASE_DB_URL) return { type: 'firebase', url: cfg.FIREBASE_DB_URL.replace(/\/$/, '') };
  if (cfg.RELAY_URL) return { type: 'relay', url: cfg.RELAY_URL.replace(/\/$/, '') };
  return null;
}

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = String(pin).trim();
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.backend = getBackend();
    this.seen = new Set();
    this.lastRelayId = {};
    this.heartbeatTimer = null;
    this.pollTimer = null;
    this.onMessage = null;
    this.connected = false;
    this._destroyed = false;
  }

  _channel(suffix) {
    return suffix;
  }

  _playerChannel(id) {
    return `out/${id}`;
  }

  _listenChannels() {
    if (this.role === 'host') return ['in'];
    return ['all', this._playerChannel(this.playerId)];
  }

  _basePath() {
    return `${this.backend.url}/quiz/${this.pin}`;
  }

  async _firebaseGet(path) {
    const res = await fetch(`${this._basePath()}/${path}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Firebase GET ${res.status}`);
    const data = await res.json();
    return data;
  }

  async _firebasePut(path, data) {
    await fetch(`${this._basePath()}/${path}.json`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }

  async _firebasePush(path, data) {
    await fetch(`${this._basePath()}/${path}.json`, {
      method: 'POST',
      body: JSON.stringify({ ...data, ts: Date.now() }),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }

  async _relaySend(ch, data) {
    const url = `${this.backend.url}/send?pin=${encodeURIComponent(this.pin)}&ch=${encodeURIComponent(ch)}`;
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }

  async _relayPoll(ch) {
    const since = this.lastRelayId[ch] || 0;
    const url = `${this.backend.url}/poll?pin=${encodeURIComponent(this.pin)}&ch=${encodeURIComponent(ch)}&since=${since}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const items = await res.json();
    return Array.isArray(items) ? items : [];
  }

  _emit(msg) {
    if (msg?.type) this.onMessage?.(msg);
  }

  _trackFirebase(path, obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      const id = `${path}/${key}`;
      if (this.seen.has(id)) continue;
      this.seen.add(id);
      if (val && typeof val === 'object' && val.type) this._emit(val);
    }
  }

  async _pollFirebase() {
    if (this.role === 'host') {
      const inbox = await this._firebaseGet('in');
      this._trackFirebase('in', inbox);
      return;
    }

    const host = await this._firebaseGet('host');
    if (host?.active) this._emit({ type: 'host-ready', pin: this.pin });

    const all = await this._firebaseGet('all');
    this._trackFirebase('all', all);

    const personal = await this._firebaseGet(`out/${this.playerId}`);
    this._trackFirebase(`out/${this.playerId}`, personal);
  }

  async _pollRelay() {
    for (const ch of this._listenChannels()) {
      const items = await this._relayPoll(ch);
      for (const item of items) {
        if (item.id) this.lastRelayId[ch] = Math.max(this.lastRelayId[ch] || 0, item.id);
        if (item.data?.type) this._emit(item.data);
      }
    }
    if (this.role === 'player') {
      const hostItems = await this._relayPoll('host');
      for (const item of hostItems) {
        if (item.id) this.lastRelayId.host = Math.max(this.lastRelayId.host || 0, item.id);
        if (item.data?.active) this._emit({ type: 'host-ready', pin: this.pin });
      }
    }
  }

  _startPolling() {
    const tick = async () => {
      if (this._destroyed) return;
      try {
        if (this.backend.type === 'firebase') await this._pollFirebase();
        else await this._pollRelay();
      } catch {
        /* ignore transient errors */
      }
    };
    tick();
    this.pollTimer = setInterval(tick, POLL_MS);
  }

  _startHeartbeat() {
    if (this.role !== 'host') return;
    const beat = async () => {
      try {
        if (this.backend.type === 'firebase') {
          await this._firebasePut('host', { active: true, pin: this.pin, ts: Date.now() });
          await this._firebasePush('all', { type: 'host-ready', pin: this.pin });
        } else {
          await this._relaySend('host', { active: true, pin: this.pin });
          await this._relaySend('all', { type: 'host-ready', pin: this.pin });
        }
      } catch {
        /* ignore */
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.backend) {
        reject(
          new Error(
            'Verbindungsserver nicht eingerichtet. Bitte FIREBASE-EINRICHTEN.bat ausführen.'
          )
        );
        return;
      }

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

      this._startPolling();
      setTimeout(finish, 600);
    });
  }

  async sendToHost(msg) {
    if (this.backend.type === 'firebase') {
      await this._firebasePush('in', { ...msg, playerId: this.playerId });
    } else {
      await this._relaySend('in', { ...msg, playerId: this.playerId });
    }
  }

  async sendToPlayer(playerId, msg) {
    if (this.backend.type === 'firebase') {
      await this._firebasePush(`out/${playerId}`, msg);
    } else {
      await this._relaySend(`out/${playerId}`, msg);
    }
  }

  async broadcast(msg) {
    if (this.backend.type === 'firebase') {
      await this._firebasePush('all', msg);
    } else {
      await this._relaySend('all', msg);
    }
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
