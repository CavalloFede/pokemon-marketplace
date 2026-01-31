@echo off
REM Start Pokemon Marketplace in Local Development Mode
REM This script starts infrastructure in Docker but runs the API/Web locally

echo ==================================
echo Pokemon Marketplace - Local Mode
echo ==================================

REM Check if Docker is running
docker info > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Docker is not running. Please start Docker first.
    exit /b 1
)

echo Docker is running

REM Navigate to project root
cd /d "%~dp0\.."
echo Working directory: %CD%

REM Start infrastructure services
echo.
echo Starting infrastructure services...
docker-compose -f monitoring/docker-compose.yml up -d postgres redis grafana prometheus

REM Wait for PostgreSQL
echo.
echo Waiting for PostgreSQL to be ready...
:wait_pg
docker exec pokemon-postgres pg_isready -U pokemon -d pokemon_marketplace > nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 2 /nobreak > nul
    goto wait_pg
)
echo PostgreSQL is ready!

REM Wait for Redis
echo.
echo Waiting for Redis to be ready...
:wait_redis
docker exec pokemon-redis redis-cli ping > nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 1 /nobreak > nul
    goto wait_redis
)
echo Redis is ready!

REM Install dependencies if needed
if not exist "node_modules" (
    echo.
    echo Installing dependencies...
    pnpm install
)

REM Run database migrations
echo.
echo Running database migrations...
call pnpm db:migrate

REM Print status
echo.
echo ==================================
echo Infrastructure Ready!
echo ==================================
echo.
echo Services running:
echo   - PostgreSQL: localhost:5433
echo   - Redis:      localhost:6379
echo   - Grafana:    http://localhost:3001 (admin/pokemon123)
echo   - Prometheus: http://localhost:9090
echo.
echo Starting development servers...
echo.

REM Start the development servers
call pnpm dev
