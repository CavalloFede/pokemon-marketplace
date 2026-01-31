@echo off
REM Start Pokemon Marketplace - Full Docker Mode
REM This script runs everything inside Docker containers

echo ==================================
echo Pokemon Marketplace - Docker Mode
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

REM Stop existing containers
echo.
echo Stopping any existing containers...
docker-compose -f monitoring/docker-compose.yml down --remove-orphans 2>nul

REM Build and start all services
echo.
echo Starting all services (this may take a while on first run)...
docker-compose -f monitoring/docker-compose.yml up -d --build

REM Wait for PostgreSQL
echo.
echo Waiting for PostgreSQL to be ready...
set /a count=0
:wait_pg
set /a count+=1
if %count% gtr 60 (
    echo PostgreSQL failed to start. Check logs with: docker logs pokemon-postgres
    exit /b 1
)
docker exec pokemon-postgres pg_isready -U pokemon -d pokemon_marketplace > nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 2 /nobreak > nul
    goto wait_pg
)
echo PostgreSQL is ready!

REM Wait for API
echo.
echo Waiting for API to be ready...
set /a count=0
:wait_api
set /a count+=1
if %count% gtr 60 (
    echo API failed to start. Check logs with: docker logs pokemon-api
    exit /b 1
)
curl -s http://localhost:3000/health > nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 2 /nobreak > nul
    goto wait_api
)
echo API is ready!

REM Run migrations
echo.
echo Running database migrations...
docker exec pokemon-api npx prisma migrate deploy

REM Print status
echo.
echo ==================================
echo All Services Running!
echo ==================================
echo.
echo Services:
echo   - API:        http://localhost:3000
echo   - API Health: http://localhost:3000/health
echo   - Metrics:    http://localhost:3000/metrics
echo   - PostgreSQL: localhost:5432
echo   - Redis:      localhost:6379
echo   - Grafana:    http://localhost:3001 (admin/pokemon123)
echo   - Prometheus: http://localhost:9090
echo.
echo Useful commands:
echo   - View logs:     docker-compose -f monitoring/docker-compose.yml logs -f
echo   - View API logs: docker logs -f pokemon-api
echo   - Stop all:      docker-compose -f monitoring/docker-compose.yml down
echo.

REM Show container status
echo Container Status:
docker-compose -f monitoring/docker-compose.yml ps
