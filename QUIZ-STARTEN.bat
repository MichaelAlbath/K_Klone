@echo off
title Quiz Host
cd /d "%~dp0offline"
echo.
echo  ============================================
echo   QUIZ STARTEN
echo   Kein Server, keine Firewall noetig!
echo  ============================================
echo.
echo  Host-Seite wird geoeffnet...
echo  SPIELEN.html vorher an Teilnehmer senden (Teams).
echo.
start "" "%~dp0offline\host.html"
exit
