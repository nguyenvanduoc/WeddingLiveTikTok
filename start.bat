@echo off
chcp 65001 >nul
title Dam Cuoi Online - Khoi dong
cd /d "%~dp0"

echo ==================================================
echo   DAM CUOI ONLINE - khoi dong server + TikTok bridge
echo ==================================================

where dotnet >nul 2>&1 || (echo [LOI] Chua cai .NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0 & pause & exit /b 1)
where npm >nul 2>&1 || (echo [LOI] Chua cai Node.js 18+: https://nodejs.org & pause & exit /b 1)

echo [1/4] Tat server cu (neu con chay)...
taskkill /IM WeddingLive.exe /F >nul 2>&1

echo [2/4] Chay server .NET (cua so moi)...
start "WeddingLive - server" cmd /k "dotnet run --project WeddingLive"

if not exist "tiktok-bridge\node_modules" (
  echo [3/4] Cai thu vien cho bridge lan dau...
  call npm --prefix tiktok-bridge install
) else (
  echo [3/4] Thu vien bridge da co.
)

if not exist "tiktok-bridge\.env" (
  copy "tiktok-bridge\.env.example" "tiktok-bridge\.env" >nul
  echo.
  echo  Dang mo file .env - dien TIKTOK_USERNAME roi LUU va DONG Notepad de tiep tuc.
  notepad "tiktok-bridge\.env"
)

echo [4/4] Chay TikTok bridge (cua so moi)...
start "WeddingLive - TikTok bridge" cmd /k "npm --prefix tiktok-bridge start"

echo.
echo Doi server khoi dong...
timeout /t 8 /nobreak >nul
start "" "http://localhost:5000/admin.html"

echo.
echo Xong! Da mo trang dieu khien. San khau cho OBS: http://localhost:5000
echo Dong 2 cua so "WeddingLive - ..." de tat.
timeout /t 5 >nul
