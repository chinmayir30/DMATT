@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo DMAT Database Setup Script (PostgreSQL Windows)
echo ========================================================
echo.

:: ENVIRONMENT CONFIG
set DB_HOST=localhost
set DB_PORT=5433
set DB_NAME=dmat_db
set DB_USER=postgres
set DB_PASSWORD=postgres

:: Pass password dynamically to psql without prompt
set PGPASSWORD=%DB_PASSWORD%

echo STEP 1: Checking if PostgreSQL command-line tool (psql) is installed...
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL 'psql' command not found.
    echo Please make sure PostgreSQL is installed and its bin folder is in your system PATH.
    echo Installation Steps:
    echo 1. Download from https://www.postgresql.org/download/windows/
    echo 2. Run the installer. When asked for password, use: %DB_PASSWORD%
    echo 3. Keep the default port as %DB_PORT%
    echo 4. After installation, search "Environment Variables" in Windows and add "C:\Program Files\PostgreSQL\[version]\bin" to the PATH.
    pause
    exit /b 1
)

echo.
echo STEP 2: Creating Database '%DB_NAME%'...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%';" | find "1" >nul
if %errorlevel% neq 0 (
    echo Database does not exist. Creating now...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create database. Is your PostgreSQL server running?
        echo Troubleshooting: Search for "Services" in Windows and ensure "postgresql" is running.
        pause
        exit /b 1
    )
    echo [SUCCESS] Database %DB_NAME% created.
) else (
    echo [INFO] Database '%DB_NAME%' already exists. Proceeding with migrations.
)

echo.
echo STEP 3: Running Migrations in strict forward order
echo --------------------------------------------------------

:: Core / Phase 1 to Phase 3
call :RunMigration "database\migrations\001_create_core_tables.sql"
call :RunMigration "database\migrations\002_extend_landing_pages.sql"
call :RunMigration "database\migrations\002_phase2_enhancements.sql"
call :RunMigration "database\migrations\003_refine_leads.sql"

:: Phase 4 Enhancements
call :RunMigration "backend\migrations\001_create_google_credentials_table.sql"
call :RunMigration "backend\migrations\002_create_seo_tables.sql"
call :RunMigration "backend\migrations\003_create_analytics_tables.sql"
call :RunMigration "backend\migrations\004_create_linkedin_tables.sql"
call :RunMigration "backend\migrations\005_create_social_tables.sql"
call :RunMigration "backend\migrations\006_create_whatsapp_messages_table.sql"
call :RunMigration "backend\migrations\007_add_whatsapp_from_number_column.sql"
call :RunMigration "backend\migrations\008_create_scheduled_posts_table.sql"

echo.
echo ========================================================
echo STEP 4: VERIFICATION
echo ========================================================
echo Listing all tables...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dt"

echo.
echo Checking data sets (Count)...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 'users' as table, COUNT(*) FROM users;"
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 'landing_pages' as table, COUNT(*) FROM landing_pages;"
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 'leads' as table, COUNT(*) FROM leads;"

echo.
echo [COMPLETE] Database Setup Finished Successfully!
pause
exit /b 0

:: Function block for running migrations
:RunMigration
set "current_file=%~1"
if not exist "%current_file%" (
    echo [WARNING] Migration file missing: %current_file%. Skipping...
    goto :eof
)

echo Executing: %current_file%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%current_file%"
if %errorlevel% neq 0 (
    echo [ERROR] Migration failed on %current_file%
    echo Please check the error message above. Your table structure or dependencies might be out of sync.
    echo Script execution stopped.
    pause
    exit
)
echo [SUCCESS]
goto :eof
