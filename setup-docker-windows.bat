@echo off
REM DMAT - Docker Setup Script for Windows (Batch)
REM This script checks Docker status and helps with setup

setlocal enabledelayedexpansion

echo ========================================
echo DMAT - Docker Setup Assistant
echo ========================================
echo.

REM Check if Docker is installed
echo Checking if Docker is installed...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker is installed
    docker --version
    echo.
) else (
    echo [ERROR] Docker is not installed or not found in PATH
    echo.
    echo To install Docker Desktop for Windows:
    echo 1. Open PowerShell as Administrator
    echo 2. Right-click setup-docker-windows.ps1 and select "Run with PowerShell"
    echo 3. OR Visit: https://www.docker.com/products/docker-desktop
    echo 4. Download and install Docker Desktop
    echo 5. Restart your computer
    echo 6. Run this script again
    echo.
    pause
    exit /b 1
)

REM Check if Docker daemon is running
echo Checking Docker daemon status...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker daemon is running
) else (
    echo [ERROR] Docker daemon is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

REM Check for docker-compose
echo Checking docker-compose...
docker-compose --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] docker-compose is available
    docker-compose --version
) else (
    echo [ERROR] docker-compose is not available
    echo Please restart Docker Desktop
    pause
    exit /b 1
)

echo.
echo ========================================
echo Starting Docker Services
echo ========================================
echo.

REM Stop existing containers (if any)
echo Stopping any existing containers...
docker-compose down

echo.
echo Pulling latest images...
docker-compose pull

echo.
echo Starting PostgreSQL and MinIO...
docker-compose up -d

echo.
echo Waiting for services to start (10 seconds)...
timeout /t 10 /nobreak

echo.
echo ========================================
echo Service Status
echo ========================================
docker ps --filter "name=dmat-"

echo.
echo ========================================
echo Services Started Successfully!
echo ========================================
echo.
echo PostgreSQL:
echo   - Host: localhost
echo   - Port: 5433
echo   - User: postgres
echo   - Password: 1234
echo   - Database: dmat_dev
echo.
echo MinIO (Object Storage):
echo   - API: http://localhost:9000
echo   - Console: http://localhost:9001
echo   - User: minioadmin
echo   - Password: minioadmin
echo.
echo Next Steps:
echo   1. Open a NEW terminal (PowerShell or Command Prompt)
echo   2. Install backend: cd backend ^&^& npm install
echo   3. Run backend: npm start
echo   4. Open ANOTHER terminal for frontend
echo   5. Install frontend: cd frontend ^&^& npm install
echo   6. Run frontend: npm run dev
echo.
pause
