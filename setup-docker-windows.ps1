# DMAT - Docker Setup Script for Windows
# This script downloads and installs Docker Desktop, then sets up the project

Write-Host "========================================" -ForegroundColor Green
Write-Host "DMAT - Docker Desktop Setup Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([System.Security.Principal.WindowsIdentity]::GetCurrent().Groups -contains 'S-1-5-32-544')
if (-not $isAdmin) {
    Write-Host "⚠️  This script requires Administrator privileges." -ForegroundColor Yellow
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Step 1: Check if Docker is already installed
Write-Host "Step 1: Checking if Docker is already installed..." -ForegroundColor Cyan
$dockerExists = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerExists) {
    Write-Host "✓ Docker is already installed" -ForegroundColor Green
    $version = docker --version
    Write-Host "  Version: $version" -ForegroundColor Green
} else {
    Write-Host "✗ Docker not found. Downloading Docker Desktop..." -ForegroundColor Yellow
    
    # Step 2: Download Docker Desktop
    $downloadUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Cyan
    Write-Host "This may take a few minutes..." -ForegroundColor Yellow
    
    try {
        # Use faster download method
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        Write-Host "✓ Docker Desktop downloaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to download Docker Desktop" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Please manually download from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 3: Install Docker Desktop
    Write-Host ""
    Write-Host "Step 2: Installing Docker Desktop..." -ForegroundColor Cyan
    Write-Host "This will take several minutes..." -ForegroundColor Yellow
    
    try {
        # Run installer silently
        Start-Process -FilePath $installerPath -ArgumentList "install --quiet --accept-license" -Wait -NoNewWindow
        Write-Host "✓ Docker Desktop installer completed" -ForegroundColor Green
    } catch {
        Write-Host "✗ Installation encountered an error" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-Host "⚠️  Docker Desktop has been installed." -ForegroundColor Yellow
    Write-Host "Your computer may need to restart for WSL2 (Windows Subsystem for Linux 2) to be enabled." -ForegroundColor Yellow
    Write-Host ""
    $restart = Read-Host "Do you want to restart now? (y/n)"
    if ($restart -eq 'y') {
        Write-Host "Restarting in 30 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        Restart-Computer -Force
    }
}

Write-Host ""
Write-Host "Step 3: Waiting for Docker daemon to be ready..." -ForegroundColor Cyan

# Wait for Docker daemon to be ready (max 2 minutes)
$maxAttempts = 24
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        docker ps > $null 2>&1
        if ($?) {
            Write-Host "✓ Docker daemon is running" -ForegroundColor Green
            break
        }
    } catch { }
    
    $attempt++
    if ($attempt -lt $maxAttempts) {
        Write-Host "  Waiting... ($attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "✗ Docker daemon did not start within timeout" -ForegroundColor Red
    Write-Host "Please start Docker Desktop manually and try again" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Step 4: Starting Docker services with docker-compose..." -ForegroundColor Cyan

# Navigate to project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# Pull latest images
Write-Host "Pulling Docker images..." -ForegroundColor Yellow
docker-compose pull

# Start services
Write-Host "Starting PostgreSQL and MinIO containers..." -ForegroundColor Yellow
docker-compose up -d

# Check if containers started successfully
Start-Sleep -Seconds 5
Write-Host ""
Write-Host "Step 5: Verifying containers..." -ForegroundColor Cyan
docker ps --filter "name=dmat-"

Write-Host ""
Write-Host "✓ Docker setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor Green
Write-Host "  • PostgreSQL: localhost:5433 (User: postgres, Password: 1234)" -ForegroundColor Green
Write-Host "  • MinIO API: localhost:9000" -ForegroundColor Green
Write-Host "  • MinIO Console: http://localhost:9001 (Credentials: minioadmin/minioadmin)" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Install backend dependencies: cd backend && npm install" -ForegroundColor Cyan
Write-Host "  2. Install frontend dependencies: cd frontend && npm install" -ForegroundColor Cyan
Write-Host "  3. Run backend: cd backend && npm start" -ForegroundColor Cyan
Write-Host "  4. Run frontend (in another terminal): cd frontend && npm run dev" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
