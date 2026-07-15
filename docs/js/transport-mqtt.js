const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

class QuizTransport {
  constructor(pin, role, playerId = null) {
    this.pin = pin;
    this.role = role;
    this.playerId = playerId || `p${Math.random().toString(36).slice(2, 10)}`;
    this.mode = null;
    this.client = null;
    this.sources = [];
    this.onMessage = null;
  }

  _ntfyTopic(suffix) {
    return `kk${this.pin}${suffix}`;
  }

  _mqttTopicHost() {
    return `kk/${this.pin}/host`;
  }

  _mqttTopicAll() {
    return `kk/${this.pin}/all`;
  }

  _mqttTopicPlayer(id) {
    return `kk/${this.pin}/player/${id}`;
  }

  connect() {
    return this._connectNtfy().catch(() => this._connectMqtt(0));
  }

  _connectNtfy() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._closeSources();
        reject(new Error('ntfy timeout'));
      }, 12000);

      const topics =
        this.role === 'host'
          ? [this._ntfyTopic('in')]
          : [this._ntfyTopic('all'), this._ntfyTopic(`p${this.playerId}`)];

      let opened = 0;
      const needed = topics.length;

      topics.forEach((topic) => {
        const es = new EventSource(`https://ntfy.sh/${topic}/sse`);
        this.sources.push(es);

        es.onopen = () => {
          opened++;
          if (opened >= needed) {
            clearTimeout(timeout);
            this.mode = 'ntfy';
            resolve();
          }
        };

        es.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.onMessage?.(msg);
          } catch {
            /* ignore */
          }
        };

        es.onerror = () => {
          if (this.mode !== 'ntfy') {
            clearTimeout(timeout);
            this._closeSources();
            reject(new Error('ntfy error'));
          }
        };
      });
    });
  }

  _connectMqtt(index) {
    if (index >= MQTT_BROKERS.length) {
      return Promise.reject(
        new Error('Keine Verbindung möglich. Anderes Netz versuchen (z.B. Handy-Mobilfunk statt Hotspot).')
      );
    }

    return new Promise((resolve, reject) => {
      const broker = MQTT_BROKERS[index];
      const clientId = `kk_${this.role}_${Math.random().toString(36).slice(2, 9)}`;
      const client = mqtt.connect(broker, {
        clientId,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 12000,
      });

      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        client.end(true);
        this._connectMqtt(index + 1).then(resolve).catch(reject);
      };

      const timer = setTimeout(fail, 13000);

      client.on('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.mode = 'mqtt';
        this.client = client;

        if (this.role === 'host') {
          client.subscribe(this._mqttTopicHost());
        } else {
          client.subscribe([this._mqttTopicAll(), this._mqttTopicPlayer(this.playerId)]);
        }

        client.on('message', (_topic, payload) => {
          try {
            const msg = JSON.parse(payload.toString());
            this.onMessage?.(msg);
          } catch {
            /* ignore */
          }
        });

        resolve();
      });

      client.on('error', () => {
        clearTimeout(timer);
        fail();
      });
    });
  }

  async _publish(topic, msg) {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify(msg),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendToHost(msg) {
    const payload = { ...msg, playerId: this.playerId };
    if (this.mode === 'ntfy') {
      this._publish(this._ntfyTopic('in'), payload);
    } else if (this.mode === 'mqtt') {
      this.client?.publish(this._mqttTopicHost(), JSON.stringify(payload));
    }
  }

  sendToPlayer(playerId, msg) {
    if (this.mode === 'ntfy') {
      this._publish(this._ntfyTopic(`p${playerId}`), msg);
    } else if (this.mode === 'mqtt') {
      this.client?.publish(this._mqttTopicPlayer(playerId), JSON.stringify(msg));
    }
  }

  broadcast(msg) {
    if (this.mode === 'ntfy') {
      this._publish(this._ntfyTopic('all'), msg);
    } else if (this.mode === 'mqtt') {
      this.client?.publish(this._mqttTopicAll(), JSON.stringify(msg));
    }
  }

  _closeSources() {
    for (const es of this.sources) es.close();
    this.sources = [];
  }

  destroy() {
    this._closeSources();
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.mode = null;
  }

  getPlayerId() {
    return this.playerId;
  }
}

window.QuizTransport = QuizTransport;
