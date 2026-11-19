@echo off
title Gemini Web2API Service (Neon Active)
cd /d "%~dp0"
echo ========================================================
echo   Starting Gemini Web2API (Port: 8083)
echo   Status: Model Gemini 4 Neon Siap Pakai
echo   Sesi: Otomatis dimuat dari data\gemini.db (Tanpa Browser)
echo ========================================================
.\gemini-web2api.exe -config .\config.json
pause
