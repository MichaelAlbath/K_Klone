@echo off
chcp 65001 >nul
title Quiz in GitHub Codespace starten
color 0A
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     Quiz über GitHub Codespace starten              ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  1. Browser oeffnet GitHub Codespace-Erstellung
echo  2. Mit GitHub anmelden (MichaelAlbath)
echo  3. Codespace erstellen (dauert ca. 1-2 Minuten)
echo  4. Server startet automatisch (npm start)
echo  5. Im Browser oeffnet sich der Host (/host)
echo.
echo  WICHTIG fuer Teilnehmer-Handys:
echo  - Unten/links: Ports ^> Port 3000 ^> Sichtbarkeit „Oeffentlich"
echo  - QR-Code auf dem Beamer zeigt die richtige URL
echo.
echo  Admin-Passwort: aral
echo.
pause
start https://github.com/codespaces/new?hide_repo_select=true^&ref=main^&repo=MichaelAlbath/K_Klone
echo.
echo  Codespace-Seite geoeffnet.
pause
