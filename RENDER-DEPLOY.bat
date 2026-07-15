@echo off
chcp 65001 >nul
title Quiz auf Render.com deployen
color 0A
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   Quiz-Server auf Render.com (kostenlos)            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Vorteil: Normale URL fuer Handys, KEIN GitHub-Trust-Dialog
echo.
echo  Schritt 1: Browser oeffnet Render Deploy-Seite
echo  Schritt 2: Mit GitHub anmelden (MichaelAlbath)
echo  Schritt 3: Blueprint "k-klone" deployen - Apply klicken
echo  Schritt 4: Warten bis Status "Live" (ca. 2-3 Min.)
echo  Schritt 5: URL kopieren, z.B. https://k-klone.onrender.com
echo  Schritt 6: URL im Chat an Assistenten schicken ODER selbst oeffnen:
echo            https://DEINE-URL.onrender.com/host
echo.
echo  Admin-Passwort: aral
echo.
echo  Hinweis: Free-Tier schlaeft nach 15 Min. - erstes Oeffnen
echo           kann 30 Sek. dauern. Vor dem Quiz einmal Host oeffnen!
echo.
pause
start https://dashboard.render.com/blueprint/new?repo=https://github.com/MichaelAlbath/K_Klone
echo.
pause
