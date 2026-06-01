@echo off
title Find Hitler - WikiRace
cd /d "C:\Users\lasse\Desktop\find-hitler"
echo Starting Find Hitler on http://localhost:3003 ...
start "" cmd /c "npm run dev"
timeout /t 3 /noisy > nul
start "" "http://localhost:3003"
