@echo off
chcp 65001 >nul
title Dam Cuoi Online - Server (khong live, de test)
cd /d "%~dp0"
taskkill /IM WeddingLive.exe /F >nul 2>&1
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:5000/admin.html"
dotnet run --project WeddingLive
pause
