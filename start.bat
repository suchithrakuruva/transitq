@echo off
title TransitQ - Full Stack Launcher
echo ==========================================================
echo Starting TransitQ for GPREC Transportation Optimization
echo ==========================================================

set PYTHONIOENCODING=utf-8

:: Check for node in path or local fallback
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\tmp\nodejs\node-v24.20.0-win-x64\node.exe" (
        set "PATH=C:\tmp\nodejs\node-v24.20.0-win-x64;%PATH%"
    )
)

echo [1/2] Starting Backend API Server (FastAPI on http://localhost:8000)...
start "TransitQ Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 >nul

echo [2/2] Starting Frontend App (Vite on http://localhost:5173)...
start "TransitQ Frontend" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 0.0.0.0 --port 5173"

echo.
echo ==========================================================
echo TransitQ is now starting!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo Docs:     http://localhost:8000/docs
echo ==========================================================
