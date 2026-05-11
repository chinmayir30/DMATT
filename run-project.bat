@echo off
REM DMAT - Complete Project Startup Script
REM Run this after Docker is running and dependencies are installed

setlocal enabledelayedexpansion

echo ========================================
echo DMAT - Project Startup
echo ========================================
echo.

REM Check if Docker is running
echo Step 1: Checking Docker services...
docker ps --filter "name=dmat-postgres" --format "table {{.Names}}\t{{.Status}}" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker containers not running
    echo Please run setup-docker-windows.bat first
    pause
    exit /b 1
)

echo [OK] Docker services are running

REM Check backend dependencies
echo.
echo Step 2: Checking backend dependencies...
if exist "backend\node_modules" (
    echo [OK] Backend dependencies installed
) else (
    echo [WARNING] Backend dependencies not found
    echo Installing... (this may take a minute)
    cd backend
    call npm install
    cd ..
)

REM Check frontend dependencies
echo.
echo Step 3: Checking frontend dependencies...
if exist "frontend\node_modules" (
    echo [OK] Frontend dependencies installed
) else (
    echo [WARNING] Frontend dependencies not found
    echo Installing... (this may take a minute)
    cd frontend
    call npm install
    cd ..
)

echo.
echo ========================================
echo Ready to Start Services
echo ========================================
echo.
echo You need to open SEPARATE terminals for each service:
echo.
echo Terminal 1 - Backend:
echo   cd backend
echo   npm start
echo.
echo Terminal 2 - Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo Services will run at:
echo   Backend:  http://localhost:5001
echo   Frontend: http://localhost:5173
echo.
pause
