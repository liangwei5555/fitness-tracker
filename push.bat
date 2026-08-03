@echo off
cd /d C:\Users\33125\Projects\fitness-tracker

echo === 检查变更 ===
git status --short

echo.
echo === 暂存所有变更 ===
git add -A

echo.
echo === 正在提交 ===
git commit -m "update: %date% %time%"

echo.
echo === 正在推送到 GitHub ===
git push

echo.
echo === 完成！Railway 将自动部署 ===
pause
