#!/bin/bash
set -e
cd "$(dirname "$0")/.." || cd /workspaces/K_Klone
git pull origin main 2>/dev/null || true
exec npm start
