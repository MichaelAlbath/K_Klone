@echo off
chcp 65001 >nul
title Render Deploy - Alles in 3 Klicks
color 0A
echo.
echo  ══════════════════════════════════════════════════════
echo   RENDER DEPLOY - nur 3 Klicks noetig
echo  ══════════════════════════════════════════════════════
echo.
echo  Klick 1: GitHub bei Render verbinden (falls noetig)
echo  Klick 2: "Deploy Blueprint" / "Apply"
echo  Klick 3: Fertig - URL kopieren wenn "Live"
echo.
echo  Kein Trust-Dialog fuer Handys!
echo  URL wird z.B.: https://k-klone.onrender.com
echo.
pause
start https://dashboard.render.com/blueprint/new?repo=https://github.com/MichaelAlbath/K_Klone
echo.
echo  Render-Seite geoeffnet. Nach "Live" die URL hier im Chat schicken.
pause
