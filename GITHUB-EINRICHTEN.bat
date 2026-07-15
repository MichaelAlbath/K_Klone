@echo off
title GitHub Upload + Pages einrichten
cd /d "%~dp0"

echo.
echo  ============================================================
echo   SCHRITT 1 von 2: Code hochladen
echo  ============================================================
echo.
echo   Gleich oeffnet sich die GitHub-Anmeldung im Browser.
echo   Bitte einloggen und "Authorize" klicken.
echo.
pause

git push -u origin main
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo   Upload fehlgeschlagen. Versuche Browser-Upload...
  start https://github.com/MichaelAlbath/K_Klone/upload
  explorer "%~dp0docs"
  echo   Ziehe ALLES aus dem docs-Ordner in den Browser.
  echo   Dann "Commit changes" klicken.
  pause
)

echo.
echo  ============================================================
echo   SCHRITT 2 von 2: GitHub Pages aktivieren
echo  ============================================================
echo.
echo   Im Browser:
echo   - Branch: main
echo   - Folder: /docs
echo   - Save klicken
echo.
start https://github.com/MichaelAlbath/K_Klone/settings/pages
echo.
echo   Nach 2 Minuten erreichbar unter:
echo   https://michaelalbath.github.io/K_Klone/host.html
echo   https://michaelalbath.github.io/K_Klone/SPIELEN.html
echo.
pause
start https://michaelalbath.github.io/K_Klone/host.html
