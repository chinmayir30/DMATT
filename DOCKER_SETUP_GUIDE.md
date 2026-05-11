# DMAT - Docker Setup Guide for Windows

## 📋 Quick Start

### Prerequisites
- Windows 10/11 (Build 2004 or later)
- Administrator access
- 4GB+ RAM available
- WSL 2 (Windows Subsystem for Linux 2) - Docker will handle setup

### Step 1: Install Docker Desktop

#### Option A: Automated Installation (Recommended)
1. Right-click on `setup-docker-windows.ps1` in File Explorer
2. Select "Run with PowerShell"
3. Click "Run" when prompted about execution policy
4. Wait for installation to complete
5. **Restart your computer** when prompted

#### Option B: Manual Installation
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop
2. Run the installer
3. Follow the installation wizard (accept default settings)
4. Restart your computer when prompted
5. Docker will auto-start after restart

### Step 2: Verify Docker Installation

Open PowerShell and run:
```powershell
docker --version
docker ps
```

Both commands should work without errors.

### Step 3: Start Docker Services

Run the batch file (easiest):
```bash
setup-docker-windows.bat
```

OR manually start with docker-compose:
```bash
cd dmatphase4
docker-compose up -d
```

### Step 4: Verify Services

Check that containers are running:
```bash
docker ps
```

You should see:
- `dmat-postgres` (PostgreSQL) - Status: Up
- `dmat-minio` (MinIO) - Status: Up

### Step 5: Install Project Dependencies

**Terminal 1 - Backend:**
```bash
cd backend
npm install
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
```

### Step 6: Run the Project

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

Backend runs on: http://localhost:5001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend runs on: http://localhost:5173

---

## 🔧 Service Details

### PostgreSQL
- **Container:** dmat-postgres
- **Host:** localhost
- **Port:** 5433
- **User:** postgres
- **Password:** 1234
- **Database:** dmat_dev
- **Connection String:** `postgresql://postgres:1234@localhost:5433/dmat_dev`

### MinIO (Object Storage)
- **Container:** dmat-minio
- **API Endpoint:** http://localhost:9000
- **Console URL:** http://localhost:9001
- **Access Key:** minioadmin
- **Secret Key:** minioadmin

---

## 📊 Useful Commands

### Docker Management
```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Stop all containers
docker-compose stop

# Start containers again
docker-compose start

# Remove containers (keeps volumes)
docker-compose down

# Full cleanup (removes everything including volumes)
docker-compose down -v

# View service logs
docker logs dmat-postgres
docker logs dmat-minio

# View continuous logs
docker logs -f dmat-postgres
```

### Database Management
```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U postgres -d dmat_dev

# From inside container
docker exec -it dmat-postgres psql -U postgres -d dmat_dev
```

### MinIO Management
```bash
# Access MinIO console
Open browser to: http://localhost:9001
Login with: minioadmin / minioadmin
```

---

## ✅ Verification Checklist

After setup, verify everything is working:

- [ ] Docker Desktop is installed and running
- [ ] `docker --version` returns version info
- [ ] `docker ps` shows both dmat-postgres and dmat-minio containers
- [ ] Can access PostgreSQL: `psql -h localhost -p 5433 -U postgres`
- [ ] Can access MinIO console: http://localhost:9001
- [ ] Backend dependencies installed: `backend/node_modules` exists
- [ ] Frontend dependencies installed: `frontend/node_modules` exists
- [ ] Backend starts without errors: `cd backend && npm start`
- [ ] Frontend starts without errors: `cd frontend && npm run dev`
- [ ] Can access backend API: http://localhost:5001
- [ ] Can access frontend UI: http://localhost:5173

---

## 🚨 Troubleshooting

### Docker Installation Issues

**Problem:** "Docker command not found"
- **Solution:** 
  1. Restart your computer (Docker needs time to install WSL2)
  2. Check if Docker Desktop is running (look in system tray)
  3. Manually add Docker to PATH: `C:\Program Files\Docker\Docker\resources\bin`

**Problem:** "WSL2 installation required"
- **Solution:**
  1. Open PowerShell as Administrator
  2. Run: `wsl --install`
  3. Restart computer
  4. Continue with Docker setup

**Problem:** "Insufficient memory"
- **Solution:**
  1. Close unnecessary applications
  2. Increase Docker memory allocation:
     - Docker Desktop → Settings → Resources → Memory (set to 4GB+)
     - Click "Apply & Restart"

### Container Issues

**Problem:** "Container failed to start"
- **Solution:**
  ```bash
  # Check logs
  docker logs dmat-postgres
  docker logs dmat-minio
  
  # Restart containers
  docker-compose restart
  ```

**Problem:** "Port already in use"
- **Solution:**
  ```powershell
  # Find process using port 5433
  netstat -ano | findstr :5433
  
  # Kill process (replace PID with actual process ID)
  taskkill /PID <PID> /F
  ```

**Problem:** "Cannot connect to PostgreSQL"
- **Solution:**
  1. Check if container is running: `docker ps`
  2. Wait 10-15 seconds for PostgreSQL to initialize
  3. Verify credentials: user=postgres, password=1234
  4. Test connection: `psql -h localhost -p 5433 -U postgres`

### Application Issues

**Problem:** "Cannot connect to database from backend"
- **Solution:**
  1. Verify DB_HOST=localhost and DB_PORT=5433 in .env
  2. Restart docker-compose: `docker-compose restart`
  3. Wait 10 seconds and try again
  4. Check PostgreSQL is running: `docker logs dmat-postgres`

**Problem:** "MinIO connection failed"
- **Solution:**
  1. Verify MINIO_ENDPOINT=localhost and MINIO_PORT=9000 in .env
  2. Check MinIO container: `docker logs dmat-minio`
  3. Restart MinIO: `docker-compose restart dmat-minio`

---

## 🔄 System Restart Required?

If you see this message after installing Docker:
- **DO restart your computer** - Docker needs to install WSL2
- After restart, Docker Desktop will auto-start
- Run `docker --version` to confirm installation

---

## 📚 Additional Resources

- Docker Documentation: https://docs.docker.com/
- Docker Desktop for Windows: https://docs.docker.com/desktop/install/windows-install/
- WSL 2: https://docs.microsoft.com/en-us/windows/wsl/install
- PostgreSQL: https://www.postgresql.org/docs/
- MinIO: https://docs.min.io/

---

## ✨ What's Next?

Once everything is running:
1. Check backend API: http://localhost:5001
2. Open frontend UI: http://localhost:5173
3. Access MinIO console: http://localhost:9001
4. Monitor logs in Docker Desktop dashboard

Need help? Check the CLAUDE.md file for additional development commands.
