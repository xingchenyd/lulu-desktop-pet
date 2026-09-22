@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo 首次见面，正在为噜噜准备小窝……
  call npm install
  if errorlevel 1 (
    echo 准备失败，请确认电脑可以访问 npm 后重试。
    pause
    exit /b 1
  )
)
start "水豚噜噜" /b cmd /c "npm start >nul 2>&1"
exit /b 0
