@echo off
chcp 65001 >nul
title Firebase einrichten – K-Klone Quiz
color 0B
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     Firebase einrichten (einmalig, ca. 3 Minuten)   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Schritt 1: Firebase-Konsole oeffnet sich gleich im Browser.
echo            Mit Google-Konto anmelden (z.B. budni.de).
echo.
echo  Schritt 2: Neues Projekt erstellen:
echo            Name: K-Klone  ^>  Weiter  ^>  Weiter  ^>  Erstellen
echo.
echo  Schritt 3: Links "Realtime Database" klicken
echo            ^>  "Datenbank erstellen"
echo            ^>  Standort: europe-west1 (Belgien)
echo            ^>  "Im Testmodus starten"  ^>  Aktivieren
echo.
echo  Schritt 4: Oben steht die URL, z.B.:
echo            https://k-klone-xxxxx-default-rtdb.europe-west1.firebasedatabase.app
echo.
echo            Diese URL kopieren und im Chat an den Assistenten schicken.
echo            (Er traegt sie ein und laedt alles hoch.)
echo.
pause
start https://console.firebase.google.com/
echo.
echo  Browser geoeffnet. Nach dem Kopieren der URL hier Enter druecken.
pause
