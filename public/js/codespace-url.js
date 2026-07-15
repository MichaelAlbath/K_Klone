function isLocalHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function getPlayOrigin() {
  const { protocol, hostname } = window.location;
  if (!isLocalHost() && (hostname.includes('github.dev') || hostname.includes('githubpreview.dev'))) {
    return `${protocol}//${hostname}`;
  }
  return null;
}

async function resolvePlayOrigin() {
  const direct = getPlayOrigin();
  if (direct) return direct;

  try {
    const res = await fetch('/api/join-url?pin=0');
    const data = await res.json();
    if (data.base && !data.base.includes('localhost')) return data.base;
    if (data.url) {
      const u = new URL(data.url);
      if (!u.hostname.includes('localhost')) return u.origin;
    }
  } catch {
    /* ignore */
  }
  return window.location.origin;
}

async function ensurePublicHostPage() {
  if (!isLocalHost()) return;
  const origin = await resolvePlayOrigin();
  if (origin && !origin.includes('localhost')) {
    window.location.replace(`${origin}/host`);
  }
}

function buildJoinUrl(origin, pin) {
  return `${origin}/play?pin=${pin}`;
}

function renderQR(el, url) {
  el.innerHTML = '';
  if (window.QRCode) {
    new QRCode(el, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#46178f',
      colorLight: '#ffffff',
    });
    return;
  }
  const img = document.createElement('img');
  img.alt = 'QR-Code';
  img.width = 180;
  img.height = 180;
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  el.appendChild(img);
}

ensurePublicHostPage();
