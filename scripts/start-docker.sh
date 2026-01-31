#!/bin/bash
# Start Pokemon Marketplace - Full Docker Mode
# This script runs everything inside Docker containers

set -e

echo "=================================="
echo "Pokemon Marketplace - Docker Mode"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker is running${NC}"

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Working directory: $PROJECT_ROOT"

# Parse arguments
BUILD_FLAG=""
DETACHED="-d"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --build) BUILD_FLAG="--build" ;;
        --no-detach|-f) DETACHED="" ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --build      Force rebuild of all images"
            echo "  --no-detach  Run in foreground (see all logs)"
            echo "  --help       Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Stop existing containers
echo ""
echo -e "${YELLOW}Stopping any existing containers...${NC}"
docker-compose -f monitoring/docker-compose.yml down --remove-orphans 2>/dev/null || true

# Build and start all services
echo ""
echo -e "${YELLOW}Starting all services...${NC}"
docker-compose -f monitoring/docker-compose.yml up $DETACHED $BUILD_FLAG

# If running in detached mode, wait for services and show status
if [ -n "$DETACHED" ]; then
    echo ""
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

    # Wait for PostgreSQL
    for i in {1..60}; do
        if docker exec pokemon-postgres pg_isready -U pokemon -d pokemon_marketplace > /dev/null 2>&1; then
            echo -e "${GREEN}PostgreSQL is ready!${NC}"
            break
        fi
        if [ $i -eq 60 ]; then
            echo -e "${RED}PostgreSQL failed to start. Check logs with: docker logs pokemon-postgres${NC}"
            exit 1
        fi
        sleep 2
    done

    # Wait for API
    echo -e "${YELLOW}Waiting for API to be ready...${NC}"
    for i in {1..60}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}API is ready!${NC}"
            break
        fi
        if [ $i -eq 60 ]; then
            echo -e "${RED}API failed to start. Check logs with: docker logs pokemon-api${NC}"
            exit 1
        fi
        sleep 2
    done

    # Run migrations inside the container
    echo ""
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker exec pokemon-api npx prisma migrate deploy

    # Seed database if empty
    echo ""
    echo -e "${YELLOW}Checking if database needs seeding...${NC}"
    USER_COUNT=$(docker exec pokemon-postgres psql -U pokemon -d pokemon_marketplace -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ' || echo "0")

    if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
        echo "Database is empty, running seed..."
        docker exec pokemon-api npx tsx prisma/seed.ts
        echo -e "${GREEN}Database seeded successfully!${NC}"
    else
        echo -e "${GREEN}Database already has $USER_COUNT users, skipping seed.${NC}"
    fi

    # Show status
    echo ""
    echo "=================================="
    echo -e "${GREEN}All Services Running!${NC}"
    echo "=================================="
    echo ""
    echo -e "${CYAN}Services:${NC}"
    echo "  - API:        http://localhost:3000"
    echo "  - API Health: http://localhost:3000/health"
    echo "  - Metrics:    http://localhost:3000/metrics"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis:      localhost:6379"
    echo "  - Grafana:    http://localhost:3001 (admin/pokemon123)"
    echo "  - Prometheus: http://localhost:9090"
    echo ""
    echo -e "${CYAN}Useful commands:${NC}"
    echo "  - View logs:       docker-compose -f monitoring/docker-compose.yml logs -f"
    echo "  - View API logs:   docker logs -f pokemon-api"
    echo "  - Stop all:        docker-compose -f monitoring/docker-compose.yml down"
    echo ""

    # Show container status
    echo -e "${CYAN}Container Status:${NC}"
    docker-compose -f monitoring/docker-compose.yml ps
fi
