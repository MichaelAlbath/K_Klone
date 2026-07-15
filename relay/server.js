const http = require('http');

const rooms = new Map();

function getRoom(pin, ch) {
  const key = `${pin}:${ch}`;
  if (!rooms.has(key)) rooms.set(key, { nextId: 1, msgs: [] });
  return rooms.get(key);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/poll' && req.method === 'GET') {
    const pin = url.searchParams.get('pin') || '';
    const ch = url.searchParams.get('ch') || '';
    const since = parseInt(url.searchParams.get('since') || '0', 10);
    const room = getRoom(pin, ch);
    const out = room.msgs.filter((m) => m.id > since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }

  if (url.pathname === '/send' && req.method === 'POST') {
    const pin = url.searchParams.get('pin') || '';
    const ch = url.searchParams.get('ch') || '';
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const room = getRoom(pin, ch);
        const id = room.nextId++;
        room.msgs.push({ id, data, ts: Date.now() });
        if (room.msgs.length > 1000) room.msgs.splice(0, room.msgs.length - 1000);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Quiz relay on port ${port}`);
});
