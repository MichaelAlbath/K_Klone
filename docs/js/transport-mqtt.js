const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = pin;
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.client = null;
    this.onMessage = null;
  }

  _topicHost() {
    return `kk/${this.pin}/host`;
  }

  _topicAll() {
    return `kk/${this.pin}/all`;
  }

  _topicPlayer(id) {
    return `kk/${this.pin}/player/${id}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const clientId = `kk_${this.role}_${Date.now()}`.slice(0, 22);
      this.client = mqtt.connect(MQTT_BROKER, {
        clientId,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 10000,
      });

      const timeout = setTimeout(() => {
        reject(new Error('Zeitüberschreitung – Internetverbindung prüfen.'));
      }, 12000);

      this.client.on('connect', () => {
        clearTimeout(timeout);
        if (this.role === 'host') {
          this.client.subscribe(this._topicHost());
        } else {
          this.client.subscribe([this._topicAll(), this._topicPlayer(this.playerId)]);
        }
        resolve();
      });

      this.client.on('message', (_topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          this.onMessage?.(msg);
        } catch {
          /* ignore invalid payloads */
        }
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  sendToHost(msg) {
    this.client?.publish(this._topicHost(), JSON.stringify({ ...msg, playerId: this.playerId }));
  }

  sendToPlayer(playerId, msg) {
    this.client?.publish(this._topicPlayer(playerId), JSON.stringify(msg));
  }

  broadcast(msg) {
    this.client?.publish(this._topicAll(), JSON.stringify(msg));
  }

  destroy() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  getPlayerId() {
    return this.playerId;
  }
}

window.QuizTransport = QuizTransport;
