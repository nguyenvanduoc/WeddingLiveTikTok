@echo off
chcp 65001 >nul
title Mo san khau (tu phat am thanh)
rem Mo san khau trong cua so Chrome/Edge rieng, CHO PHEP tu phat am thanh (khong can bam nut 🔊).
rem Dung cho TikTok LIVE Studio: them nguon "Window capture" chon cua so nay + bat thu am thanh he thong.

set "URL=http://localhost:5000/"
set "PROFILE=%TEMP%\wedding-stage-browser"

set "B=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%B%" goto run
set "B=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%B%" goto run

echo Khong tim thay Chrome hoac Edge. Hay mo %URL% bang trinh duyet va bam nut 🔊 tren san khau.
pause
exit /b 1

:run
echo Dang mo san khau bang: %B%
start "" "%B%" --app=%URL% --autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" --window-size=1296,759 --no-first-run --no-default-browser-check
