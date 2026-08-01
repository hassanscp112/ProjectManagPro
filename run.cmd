@echo off
echo Starting Project Manager App...
cd /d "%~dp0ProjectManagerApp"
start http://localhost:5173
npm run dev
pause
