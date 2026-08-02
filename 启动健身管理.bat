@echo off
chcp 65001 >nul
title 健身管理工具

echo ============================
echo    💪 青云健身
echo ============================
echo.
echo 启动中... 浏览器访问 http://127.0.0.1:8900
echo.

cd /d "%~dp0backend"
python launch.py

pause
