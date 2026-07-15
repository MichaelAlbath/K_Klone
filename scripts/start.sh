#!/bin/bash
cd "$(dirname "$0")/.." || cd /workspaces/K_Klone
git pull origin main 2>/dev/null || true

URL_FILE="/tmp/quiz-public-url.txt"
rm -f "$URL_FILE" /tmp/tunnel.log

echo "Starte Quiz-Server..."
npm start &
sleep 2

if command -v cloudflared >/dev/null 2>&1; then
  echo "Starte Cloudflare-Tunnel (kein GitHub-Trust-Dialog)..."
  cloudflared tunnel --url "http://127.0.0.1:3000" > /tmp/tunnel.log 2>&1 &
  for _ in $(seq 1 60); do
    URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
      echo "$URL" > "$URL_FILE"
      echo ""
      echo "  ═══════════════════════════════════════════════"
      echo "  HANDY-URL (ohne Trust-Dialog):"
      echo "  $URL/play"
      echo "  Host: $URL/host"
      echo "  ═══════════════════════════════════════════════"
      echo ""
      break
    fi
    sleep 1
  done
else
  echo "cloudflared nicht installiert – nutze Ports → 3000 → Public"
fi

wait
