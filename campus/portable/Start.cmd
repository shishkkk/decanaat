@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 24 or later first. & pause & exit /b 1)
node serve.mjs --open
pause
