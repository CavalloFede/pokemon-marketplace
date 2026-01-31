#!/bin/bash
# Start Pokemon Marketplace in Local Development Mode
# This script starts infrastructure in Docker but runs the API/Web locally

set -e

echo "=================================="
echo "Pokemon Marketplace - Local Mode"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Start infrastructure services (PostgreSQL, Redis, Grafana, Prometheus)
echo ""
echo -e "${YELLOW}Starting infrastructure services...${NC}"
docker-compose -f monitoring/docker-compose.yml up -d postgres redis grafana prometheus

# Wait for PostgreSQL to be healthy
echo ""
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if docker exec pokemon-postgres pg_isready -U pokemon -d pokemon_marketplace > /dev/null 2>&1; then
        echo -e "${GREEN}PostgreSQL is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}PostgreSQL failed to start in time${NC}"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Wait for Redis
echo ""
echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
for i in {1..15}; do
    if docker exec pokemon-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}Redis is ready!${NC}"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${RED}Redis failed to start in time${NC}"
        exit 1
    fi
    echo "Waiting for Redis... ($i/15)"
    sleep 1
done

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install
fi

# Run database migrations
echo ""
echo -e "${YELLOW}Running database migrations...${NC}"
pnpm db:migrate

# Check if database has data, if not seed it
echo ""
echo -e "${YELLOW}Checking if database needs seeding...${NC}"
USER_COUNT=$(docker exec pokemon-postgres psql -U pokemon -d pokemon_marketplace -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
    echo "Database is empty, running seed..."
    pnpm db:seed
    echo -e "${GREEN}Database seeded successfully!${NC}"
else
    echo -e "${GREEN}Database already has $USER_COUNT users, skipping seed.${NC}"
fi

# Print status
echo ""
echo "=================================="
echo -e "${GREEN}Infrastructure Ready!${NC}"
echo "=================================="
echo ""
echo "Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis:      localhost:6379"
echo "  - Grafana:    http://localhost:3001 (admin/pokemon123)"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "Starting development servers..."
echo ""

# Start the development servers
pnpm dev
