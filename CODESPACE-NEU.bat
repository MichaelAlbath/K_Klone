@echo off
chcp 65001 >nul
title Codespace neu erstellen (mit Fix)
color 0A
echo.
echo  Neuer Codespace = neuester Code von GitHub (mit URL-Fix)
echo.
echo  1. Alten Codespace kannst du schliessen/loeschen
echo  2. Neuen Codespace erstellen
echo  3. Port 3000 auf Oeffentlich stellen
echo  4. Host oeffnen: /host
echo.
pause
start https://github.com/codespaces/new?hide_repo_select=true^&ref=main^&repo=MichaelAlbath/K_Klone
pause
