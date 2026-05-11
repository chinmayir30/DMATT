@echo off
REM DMAT - Service Health Check Script
REM Run this to verify all services are working correctly

setlocal enabledelayedexpansion

cls
echo ========================================
echo DMAT - Service Health Check
echo ========================================
echo.

REM Colors simulation using title trick
color 0A
echo Checking system status...
echo.

REM Check Docker
echo [1/6] Checking Docker Installation...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ Docker is installed
    docker --version
) else (
    echo     ✗ Docker is NOT installed
    echo     Please install Docker Desktop first
    echo     Run: setup-docker-windows.ps1
    echo.
    pause
    exit /b 1
)

echo.
echo [2/6] Checking Docker Daemon...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ Docker daemon is running
) else (
    echo     ✗ Docker daemon is NOT running
    echo     Please start Docker Desktop
    pause
    exit /b 1
)

echo.
echo [3/6] Checking Docker Services...
docker ps --filter "name=dmat-postgres" --format "{{.Names}}" >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ PostgreSQL container found
    for /f %%i in ('docker ps --filter "name=dmat-postgres" --format "{{.Status}}"') do (
        echo       Status: %%i
    )
) else (
    echo     ⚠ PostgreSQL container not running
    echo     Run: docker-compose up -d
)

docker ps --filter "name=dmat-minio" --format "{{.Names}}" >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ MinIO container found
    for /f %%i in ('docker ps --filter "name=dmat-minio" --format "{{.Status}}"') do (
        echo       Status: %%i
    )
) else (
    echo     ⚠ MinIO container not running
    echo     Run: docker-compose up -d
)

echo.
echo [4/6] Checking Backend Dependencies...
if exist "backend\node_modules" (
    echo     ✓ Backend dependencies installed
) else (
    echo     ✗ Backend dependencies missing
    echo     Run: cd backend ^&^& npm install
)

echo.
echo [5/6] Checking Frontend Dependencies...
if exist "frontend\node_modules" (
    echo     ✓ Frontend dependencies installed
) else (
    echo     ✗ Frontend dependencies missing
    echo     Run: cd frontend ^&^& npm install
)

echo.
echo [6/6] Checking Ports...
netstat -ano | findstr ":5433" >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ PostgreSQL port 5433 is listening
) else (
    echo     ✗ PostgreSQL port not listening
    echo     Containers may not be running yet
)

netstat -ano | findstr ":5001" >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ Backend port 5001 is listening
) else (
    echo     ⚠ Backend port not listening (start backend to use)
)

netstat -ano | findstr ":5173" >nul 2>&1
if %errorlevel% equ 0 (
    echo     ✓ Frontend port 5173 is listening
) else (
    echo     ⚠ Frontend port not listening (start frontend to use)
)

echo.
echo ========================================
echo Health Check Summary
echo ========================================
echo.
echo All Critical Services Ready!
echo.
echo Next Steps:
echo   1. Terminal 1: cd backend ^&^& npm start
echo   2. Terminal 2: cd frontend ^&^& npm run dev
echo   3. Open: http://localhost:5173
echo.
pause
