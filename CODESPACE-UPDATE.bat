@echo off
chcp 65001 >nul
title Codespace aktualisieren
color 0A
echo.
echo  Codespace mit Handy-Fix aktualisieren:
echo.
echo  Im Codespace-Terminal diesen Befehl einfuegen und Enter:
echo.
echo    git pull ^&^& pkill -f "node server" ; bash scripts/start.sh
echo.
echo  ODER: Command Palette (Strg+Shift+P) ^> "Rebuild Container"
echo.
echo  Danach im Terminal die Zeile "HANDY-URL" ablesen
echo  oder Host oeffnen - QR zeigt trycloudflare.com Link
echo.
pause
start https://github.com/codespaces
pause
