@echo off
title Quiz - GitHub Upload per Browser
echo.
echo  ====================================================
echo   GITHUB UPLOAD (ohne Git-Befehle)
echo  ====================================================
echo.
echo  1. Browser oeffnet dein leeres GitHub-Repo
echo  2. Klicke: "Add file" -^> "Upload files"
echo  3. Oeffne den Ordner "docs" (wird gleich geoeffnet)
echo  4. ALLES markieren (css, js, host.html, ...)
echo  5. In den Browser ziehen (Drag and Drop)
echo  6. Unten: "Commit changes" klicken
echo.
echo  DANACH GitHub Pages aktivieren:
echo  Settings - Pages - Branch: main - Folder: /docs - Save
echo.
echo  Deine URLs dann:
echo  https://michaelalbath.github.io/K_Klone/host.html
echo  https://michaelalbath.github.io/K_Klone/SPIELEN.html
echo.
pause
start https://github.com/MichaelAlbath/K_Klone/upload
explorer "%~dp0docs"
exit
