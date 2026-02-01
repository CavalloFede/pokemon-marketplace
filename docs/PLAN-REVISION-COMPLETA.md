# Plan de Revision Completa - Pokemon Marketplace

**Fecha:** 2026-01-27
**Objetivo:** Revision completa de la app, configuracion Docker, Grafana, seguridad y tests

---

## Indice

1. [Estado Actual](#1-estado-actual)
2. [Problemas Identificados](#2-problemas-identificados)
3. [Fase 1: Configuracion Base](#3-fase-1-configuracion-base)
4. [Fase 2: Dashboards Grafana](#4-fase-2-dashboards-grafana)
5. [Fase 3: Scripts de Inicio](#5-fase-3-scripts-de-inicio)
6. [Fase 4: URL Publica con ngrok](#6-fase-4-url-publica-con-ngrok)
7. [Fase 5: MCP Browser Tools](#7-fase-5-mcp-browser-tools)
8. [Fase 6: Revision Visual](#8-fase-6-revision-visual)
9. [Fase 7: Auditoria de Seguridad](#9-fase-7-auditoria-de-seguridad)
10. [Fase 8: Tests](#10-fase-8-tests)
11. [Verificacion Final](#11-verificacion-final)

---

## 1. Estado Actual

### Arquitectura
```
pokemon-marketplace/
├── apps/
│   ├── api/          # Backend Fastify + Prisma + PostgreSQL
│   └── web/          # Frontend React + Vite + TailwindCSS
├── packages/
│   └── shared/       # Tipos compartidos
├── monitoring/
│   ├── docker-compose.yml
│   ├── grafana/
│   └── prometheus/
├── terraform/        # Infraestructura AWS
└── docs/
```

### Servicios Docker Actuales
| Servicio | Imagen | Puerto | Estado |
|----------|--------|--------|--------|
| PostgreSQL | postgres:15-alpine | 5432 | OK |
| Redis | redis:7-alpine | 6379 | OK |
| Grafana | grafana/grafana:latest | 3001 | OK |
| Prometheus | prom/prometheus:latest | 9090 | OK |

### Funcionalidades Implementadas
- Autenticacion OAuth con Cognito/Google
- Sistema de usuarios con monedas
- Tienda de Pokemon y Huevos
- Coleccion de Pokemon
- Sistema de intercambios (trades)
- Pokedex con estadisticas
- Recompensas diarias con streak

---

## 2. Problemas Identificados

### CRITICOS (Bloquean funcionamiento)

| ID | Problema | Archivo | Solucion |
|----|----------|---------|----------|
| C1 | Endpoint /metrics NO registrado | apps/api/src/app.ts | Agregar registro de metricsRoutes |
| C2 | Dashboards usan CloudWatch | monitoring/grafana/dashboards/*.json | Crear dashboard con Prometheus |

### ALTOS (Afectan desarrollo local)

| ID | Problema | Archivo | Solucion |
|----|----------|---------|----------|
| A1 | No hay Dockerfile para API | apps/api/Dockerfile | Crear Dockerfile multi-stage |
| A2 | Prometheus target incorrecto | monitoring/prometheus/prometheus.yml | Cambiar a network interna |
| A3 | API no esta en docker-compose | monitoring/docker-compose.yml | Agregar servicio api |
| A4 | Tests cubren solo 5% | apps/api/src/**/*.test.ts | Agregar tests criticos |

### MEDIOS (Mejoras recomendadas)

| ID | Problema | Archivo | Solucion |
|----|----------|---------|----------|
| M1 | Sin scripts de inicio | scripts/*.sh | Crear scripts automatizados |
| M2 | Sin documentacion ngrok | docs/ngrok-setup.md | Documentar proceso |
| M3 | Sin validacion Zod | apps/api/src/routes/*.ts | Implementar schemas |
| M4 | vitest.integration.config.ts faltante | apps/api/ | Crear archivo |

---

## 3. Fase 1: Configuracion Base

### 1.1 Registrar endpoint /metrics en API

**Archivo:** `apps/api/src/app.ts`

**Cambio requerido:**
```typescript
// Agregar import
import metricsRoutes from './routes/metrics';

// Agregar registro (despues de las otras rutas)
await app.register(metricsRoutes);
```

**Verificacion:**
```bash
curl http://localhost:3000/metrics
# Debe retornar metricas en formato Prometheus
```

### 1.2 Crear Dockerfile para API

**Archivo:** `apps/api/Dockerfile`

**Contenido:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar codigo fuente
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Generar Prisma client
WORKDIR /app/apps/api
RUN pnpm db:generate

# Build
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos necesarios
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "dist/server.js"]
```

**Verificacion:**
```bash
docker build -t pokemon-api -f apps/api/Dockerfile .
docker run -p 3000:3000 pokemon-api
```

### 1.3 Actualizar docker-compose.yml

**Archivo:** `monitoring/docker-compose.yml`

**Agregar servicio:**
```yaml
services:
  # ... servicios existentes ...

  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: pokemon-api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://pokemon:pokemon123@postgres:5432/pokemon_marketplace
      - REDIS_URL=redis://redis:6379
      - MOCK_AUTH=true
      - NODE_ENV=development
      - PORT=3000
      - HOST=0.0.0.0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    networks:
      - default
```

**Verificacion:**
```bash
docker-compose up -d api
docker logs pokemon-api
```

### 1.4 Corregir prometheus.yml

**Archivo:** `monitoring/prometheus/prometheus.yml`

**Cambio:**
```yaml
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'pokemon-api'
    static_configs:
      - targets: ['api:3000']  # Cambiado de host.docker.internal
    metrics_path: /metrics
    scrape_interval: 10s
```

**Verificacion:**
```bash
# En Prometheus UI (http://localhost:9090)
# Status -> Targets -> pokemon-api debe estar UP
```

---

## 4. Fase 2: Dashboards Grafana

### 2.1 Crear dashboard local para Prometheus

**Archivo:** `monitoring/grafana/dashboards/local-api.json`

**Contenido:** Dashboard con paneles para:
- HTTP Requests Total (counter)
- HTTP Errors Total (counter)
- Request Duration Average (gauge)
- Requests by Status Code (counter)
- API Health Status
- Active Connections

**Metricas a usar:**
```
http_requests_total
http_errors_total
http_request_duration_ms_avg
http_requests_by_status{status="2xx"}
http_requests_by_status{status="4xx"}
http_requests_by_status{status="5xx"}
```

### 2.2 Verificar provisioning

**Archivo:** `monitoring/grafana/provisioning/dashboards/dashboards.yml`

Verificar que incluya:
```yaml
providers:
  - name: 'Pokemon Marketplace'
    folder: 'Pokemon Marketplace'
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

### 2.3 Verificar datasource

**Archivo:** `monitoring/grafana/provisioning/datasources/datasources.yml`

Verificar:
```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

**Verificacion:**
```
1. Abrir http://localhost:3001
2. Login: admin / pokemon123
3. Ir a Dashboards -> Pokemon Marketplace
4. Verificar que los paneles muestren datos
```

---

## 5. Fase 3: Scripts de Inicio

### 3.1 Script para desarrollo local (sin Docker para API)

**Archivo:** `scripts/start-local.sh`

```bash
#!/bin/bash
set -e

echo "=== Pokemon Marketplace - Local Development ==="

# Verificar Docker
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker no esta corriendo"
    exit 1
fi

# Levantar infraestructura
echo "Levantando PostgreSQL, Redis, Grafana, Prometheus..."
docker-compose -f monitoring/docker-compose.yml up -d postgres redis grafana prometheus

# Esperar a PostgreSQL
echo "Esperando a PostgreSQL..."
until docker exec pokemon-postgres pg_isready -U pokemon -d pokemon_marketplace > /dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL listo!"

# Migraciones
echo "Ejecutando migraciones..."
pnpm db:migrate

# Seed si es necesario
echo "Verificando datos iniciales..."
pnpm db:seed || true

# Iniciar desarrollo
echo ""
echo "=== Infraestructura lista ==="
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
echo "Grafana: http://localhost:3001 (admin/pokemon123)"
echo "Prometheus: http://localhost:9090"
echo ""
echo "Iniciando API y Web..."
pnpm dev
```

### 3.2 Script para Docker completo

**Archivo:** `scripts/start-docker.sh`

```bash
#!/bin/bash
set -e

echo "=== Pokemon Marketplace - Docker Full Stack ==="

# Build y levantar todo
docker-compose -f monitoring/docker-compose.yml up -d --build

# Esperar a la API
echo "Esperando a que la API este lista..."
until curl -s http://localhost:3000/health > /dev/null 2>&1; do
    sleep 2
done

echo ""
echo "=== Todo listo ==="
echo "API: http://localhost:3000"
echo "Web: http://localhost:5173 (ejecutar: pnpm --filter web dev)"
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
echo "Grafana: http://localhost:3001"
echo "Prometheus: http://localhost:9090"
```

### 3.3 Script para detener

**Archivo:** `scripts/stop.sh`

```bash
#!/bin/bash
echo "Deteniendo servicios..."
docker-compose -f monitoring/docker-compose.yml down
echo "Servicios detenidos"
```

### 3.4 Actualizar package.json

**Archivo:** `package.json`

Agregar scripts:
```json
{
  "scripts": {
    "start:local": "bash scripts/start-local.sh",
    "start:docker": "bash scripts/start-docker.sh",
    "stop": "bash scripts/stop.sh"
  }
}
```

**Verificacion:**
```bash
pnpm start:local
# Verificar que todos los servicios esten corriendo
```

---

## 6. Fase 4: URL Publica con ngrok

### 4.1 Instalacion de ngrok

**Windows:**
```powershell
# Con Chocolatey
choco install ngrok

# O descargar de https://ngrok.com/download
```

### 4.2 Configuracion

```bash
# Registrarse en ngrok.com y obtener authtoken
ngrok config add-authtoken YOUR_TOKEN
```

### 4.3 Script para tuneles

**Archivo:** `scripts/ngrok-tunnel.sh`

```bash
#!/bin/bash

echo "=== Iniciando tuneles ngrok ==="
echo ""
echo "Opcion 1: Solo API"
echo "  ngrok http 3000"
echo ""
echo "Opcion 2: Solo Web"
echo "  ngrok http 5173"
echo ""
echo "Opcion 3: Ambos (requiere ngrok Pro o dos terminales)"
echo "  Terminal 1: ngrok http 3000"
echo "  Terminal 2: ngrok http 5173"
echo ""

read -p "Que tunel iniciar? (api/web/ambos): " choice

case $choice in
    api)
        ngrok http 3000
        ;;
    web)
        ngrok http 5173
        ;;
    ambos)
        echo "Iniciando API en background..."
        ngrok http 3000 &
        sleep 2
        echo "Iniciando Web..."
        ngrok http 5173
        ;;
    *)
        echo "Opcion invalida"
        ;;
esac
```

### 4.4 Documentacion

**Archivo:** `docs/ngrok-setup.md`

Documentar:
- Instalacion
- Configuracion de cuenta
- Uso basico
- Limitaciones del plan gratuito
- Alternativas (Cloudflare Tunnel, localtunnel)

**Verificacion:**
```bash
ngrok http 3000
# Copiar URL generada y acceder desde otro dispositivo
```

---

## 7. Fase 5: MCP Browser Tools

### 5.1 Instalacion

1. Abrir Chrome
2. Ir a chrome://extensions/
3. Buscar "MCP Browser Tools" o instalar desde:
   - Chrome Web Store
   - O extension local si es development

### 5.2 Configuracion

1. Click en el icono de la extension
2. Configurar conexion con Claude Code
3. Verificar que aparezca "Connected"

### 5.3 Uso

Comandos disponibles:
- Navegar a URL
- Tomar screenshot
- Obtener DOM
- Click en elementos
- Input de texto

**Verificacion:**
```
Pedirle a Claude que navegue a http://localhost:5173
y tome un screenshot de la pagina principal
```

---

## 8. Fase 6: Revision Visual

### 6.1 Paginas a verificar

| Pagina | URL | Verificaciones |
|--------|-----|----------------|
| Home | / | Layout, navegacion, estado inicial |
| Login | /login | Boton Google, flujo OAuth |
| Shop | /shop | Grid de items, precios, compra |
| Collection | /collection | Lista Pokemon, filtros, equipo |
| Pokedex | /pokedex | Progreso, estadisticas |
| Trades | /trades | Lista, crear trade |
| Profile | /profile | Info usuario, monedas |

### 6.2 Checklist visual

- [ ] Logo y branding correcto
- [ ] Navegacion funciona en todas las paginas
- [ ] Responsive en mobile (375px)
- [ ] Responsive en tablet (768px)
- [ ] Responsive en desktop (1920px)
- [ ] Colores y tipografia consistentes
- [ ] Estados de loading visibles
- [ ] Mensajes de error claros
- [ ] Accesibilidad basica (contraste, focus)

### 6.3 Grafana

- [ ] Login funciona (admin/pokemon123)
- [ ] Dashboard local-api visible
- [ ] Metricas actualizandose
- [ ] Graficos renderizando correctamente

**Verificacion:**
Documentar issues encontrados con screenshots

---

## 9. Fase 7: Auditoria de Seguridad

### 7.1 Auditoria de dependencias

```bash
pnpm audit
```

Resolver vulnerabilidades HIGH y CRITICAL

### 7.2 OWASP Top 10 Checklist

#### A01: Broken Access Control
- [ ] Verificar que usuarios solo acceden a sus Pokemon
- [ ] Verificar que trades validan ambos usuarios
- [ ] Verificar que no se puede modificar Pokemon ajenos

#### A02: Cryptographic Failures
- [ ] Verificar que passwords no se loguean
- [ ] Verificar HTTPS en produccion
- [ ] Verificar tokens JWT seguros

#### A03: Injection
- [ ] Verificar queries Prisma parametrizadas
- [ ] Revisar uso de $queryRaw
- [ ] Verificar sanitizacion de inputs

#### A04: Insecure Design
- [ ] Verificar rate limiting efectivo
- [ ] Verificar limites de paginacion
- [ ] Verificar validacion de entrada

#### A05: Security Misconfiguration
- [ ] Verificar headers de seguridad (Helmet)
- [ ] Verificar CORS configurado correctamente
- [ ] Verificar variables de entorno no expuestas

#### A06: Vulnerable Components
- [ ] Ejecutar pnpm audit
- [ ] Actualizar dependencias con CVEs
- [ ] Verificar versiones de Node/Docker

#### A07: Authentication Failures
- [ ] Verificar tokens expiran correctamente
- [ ] Verificar refresh token funciona
- [ ] Verificar logout invalida sesion

#### A08: Data Integrity Failures
- [ ] Verificar transacciones atomicas
- [ ] Verificar integridad de trades
- [ ] Verificar balance de monedas consistente

#### A09: Logging Failures
- [ ] Verificar que errores se loguean
- [ ] Verificar que info sensible no se loguea
- [ ] Verificar logs accesibles para debug

#### A10: SSRF
- [ ] Verificar que no hay fetches a URLs de usuario
- [ ] Verificar PokeAPI calls son seguros

### 7.3 Reporte de seguridad

**Archivo:** `docs/security-audit.md`

Documentar:
- Fecha de auditoria
- Herramientas usadas
- Vulnerabilidades encontradas
- Severidad y estado
- Recomendaciones

**Verificacion:**
```bash
# Ejecutar todas las verificaciones
pnpm audit
# Revisar reporte generado
```

---

## 10. Fase 8: Tests

### 8.1 Tests unitarios a crear

**Archivo:** `apps/api/src/services/shop.service.test.ts`
- Test compra exitosa
- Test balance insuficiente
- Test stock agotado
- Test item no existe

**Archivo:** `apps/api/src/services/trade.service.test.ts`
- Test crear trade valido
- Test aceptar trade
- Test rechazar trade
- Test trade con Pokemon en otro trade
- Test trade expirado

**Archivo:** `apps/api/src/services/pokemon.service.test.ts`
- Test obtener coleccion
- Test actualizar equipo
- Test marcar favorito
- Test filtros funcionan

**Archivo:** `apps/api/src/middleware/auth.test.ts`
- Test token valido
- Test token expirado
- Test token invalido
- Test modo mock

### 8.2 Crear vitest.integration.config.ts

**Archivo:** `apps/api/vitest.integration.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/integration-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### 8.3 Tests E2E a crear

**Archivo:** `apps/web/e2e/auth-flow.spec.ts`
- Test flujo login completo
- Test logout
- Test sesion persistida

**Archivo:** `apps/web/e2e/purchase-flow.spec.ts`
- Test comprar Pokemon
- Test comprar Huevo
- Test balance actualizado

### 8.4 Ejecutar tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage
pnpm test -- --coverage
```

**Verificacion:**
- Coverage > 50% en services
- Todos los tests pasan
- E2E sin errores

---

## 11. Verificacion Final

### Checklist de verificacion

#### Sin Docker (API local)
- [ ] `pnpm install` exitoso
- [ ] `pnpm db:migrate` exitoso
- [ ] `pnpm db:seed` exitoso
- [ ] `pnpm dev` inicia sin errores
- [ ] http://localhost:3000/health retorna OK
- [ ] http://localhost:3000/metrics retorna metricas
- [ ] http://localhost:5173 carga frontend

#### Con Docker (API en contenedor)
- [ ] `docker-compose up -d --build` exitoso
- [ ] Todos los contenedores running
- [ ] API responde en :3000
- [ ] PostgreSQL accesible
- [ ] Redis accesible
- [ ] Grafana accesible en :3001
- [ ] Prometheus accesible en :9090
- [ ] Dashboards muestran datos

#### URL Publica
- [ ] ngrok instalado
- [ ] Tunel API funciona
- [ ] Tunel Web funciona
- [ ] Accesible desde otro dispositivo

#### Visual
- [ ] Todas las paginas cargan
- [ ] Sin errores en consola
- [ ] Responsive funciona
- [ ] Grafana dashboards OK

#### Seguridad
- [ ] pnpm audit sin HIGH/CRITICAL
- [ ] OWASP checklist completado
- [ ] Reporte documentado

#### Tests
- [ ] Unit tests pasan
- [ ] Integration tests pasan
- [ ] E2E tests pasan
- [ ] Coverage aceptable

---

## Commits Sugeridos

1. `feat(api): register /metrics endpoint for Prometheus`
2. `feat(docker): add Dockerfile for API`
3. `feat(docker): add API service to docker-compose`
4. `fix(prometheus): correct scrape target for local development`
5. `feat(grafana): add local API dashboard with Prometheus metrics`
6. `feat(scripts): add startup scripts for local and docker development`
7. `docs: add ngrok setup guide`
8. `test(api): add shop service unit tests`
9. `test(api): add trade service unit tests`
10. `test(api): add pokemon service unit tests`
11. `test(api): add auth middleware tests`
12. `test(api): add integration test config`
13. `test(web): add auth flow e2e tests`
14. `test(web): add purchase flow e2e tests`
15. `docs: add security audit report`
16. `chore: update package.json with new scripts`

---

## Tiempo Estimado

| Fase | Duracion |
|------|----------|
| Fase 1: Config Base | 30-45 min |
| Fase 2: Grafana | 45-60 min |
| Fase 3: Scripts | 20-30 min |
| Fase 4: ngrok | 15-20 min |
| Fase 5: MCP Browser | 10-15 min |
| Fase 6: Visual | 30-45 min |
| Fase 7: Seguridad | 45-60 min |
| Fase 8: Tests | 90-120 min |
| **TOTAL** | **5-7 horas** |

---

## Contacto

Para dudas sobre este plan, revisar el contexto original de la conversacion con Claude.
