@echo off
title Quiz auf GitHub hochladen
cd /d "%~dp0"

echo.
echo  ============================================
echo   Quiz auf GitHub hochladen
echo  ============================================
echo.
echo  Voraussetzung: Leeres Repo auf github.com erstellt
echo  (z.B. Name: kahoot-klone)
echo.
set /p REPO="GitHub Repo-URL eingeben (z.B. https://github.com/DEIN-NAME/kahoot-klone.git): "

if "%REPO%"=="" (
  echo Abgebrochen.
  pause
  exit /b 1
)

git remote remove origin 2>nul
git remote add origin "%REPO%"
git push -u origin main

if %ERRORLEVEL% EQU 0 (
  echo.
  echo  ============================================
  echo   Hochladen erfolgreich!
  echo.
  echo   Jetzt auf GitHub:
  echo   Settings - Pages - Source: main - /docs
  echo.
  echo   Nach 1-2 Minuten:
  echo   https://DEIN-NAME.github.io/kahoot-klone/host.html
  echo   https://DEIN-NAME.github.io/kahoot-klone/SPIELEN.html
  echo  ============================================
) else (
  echo.
  echo  Fehler beim Hochladen. GitHub-Anmeldung noetig.
  echo  Browser oeffnet sich ggf. fuer Login.
)

echo.
pause
