# Pokemon Marketplace

Marketplace donde los usuarios pueden comprar, coleccionar e intercambiar Pokemon.

## Funcionalidades

- **Autenticacion con Google** - Login simple via OAuth
- **Sistema de monedas** - Recompensas diarias con streak bonus
- **Tienda** - Comprar Pokemon especificos o huevos random
- **Coleccion** - Ver y organizar tus Pokemon
- **Equipo** - Armar un equipo de 6 para mostrar en tu perfil
- **Pokedex** - Trackear tu progreso de completado
- **Intercambios** - Tradear Pokemon con otros usuarios

---

## Sistema de Rareza y Precios

Los Pokemon tienen rareza calculada del `capture_rate` de PokeAPI:

| Rareza | Capture Rate | Precio | Prob. en Huevo Misterio |
|--------|-------------|--------|-------------------------|
| Common | > 200 | 100 | 50% |
| Uncommon | 100-200 | 250 | 25% |
| Rare | 45-99 | 500 | 15% |
| Epic | 3-44 | 1,000 | 7% |
| Legendary | is_legendary | 5,000 | 2.5% |
| Mythical | is_mythical | 10,000 | 0.5% |

### Ejemplos de Pokemon por Rareza

```
COMMON (100 monedas):
- Pidgey, Rattata, Caterpie, Weedle, Zubat

UNCOMMON (250 monedas):
- Pikachu, Bulbasaur, Charmander, Squirtle

RARE (500 monedas):
- Eevee, Dratini, Lapras, Snorlax

EPIC (1,000 monedas):
- Dragonite, Tyranitar, Salamence

LEGENDARY (5,000 monedas):
- Mewtwo, Lugia, Ho-Oh, Rayquaza, Dialga

MYTHICAL (10,000 monedas):
- Mew, Celebi, Jirachi, Deoxys, Arceus
```

---

## Sistema de Huevos

Los huevos son una **apuesta**: pagas menos pero el resultado es random.

| Huevo | Precio | Pool | Distribucion |
|-------|--------|------|--------------|
| Comun | 75 | Common + Uncommon | 70% / 30% |
| Raro | 350 | Rare + Epic | 70% / 30% |
| Legendario | 2,500 | Legendary + Mythical | 90% / 10% |
| **Misterio** | **500** | **TODOS** | Weighted (ver tabla arriba) |

### Por que comprar huevos?

**Huevo Misterio por 500 monedas:**
- Valor esperado: ~187.5 monedas (malo)
- PERO: 2.5% chance de un Legendary (5,000) o 0.5% de Mythical (10,000)
- Es una apuesta, no una inversion

**Huevo Legendario por 2,500 monedas:**
- Guarantizado un Legendary o Mythical
- Ahorro potencial de 2,500-7,500 monedas si sale Mythical
- 90% Legendary, 10% Mythical

---

## Sistema de Monedas Diarias

| Dias consecutivos | Monedas |
|-------------------|---------|
| Dia 1 | 100 |
| Dia 2 | 150 |
| Dia 3 | 175 |
| Dia 4 | 200 |
| Dia 5+ | 200 (cap) |

*Si pierdes un dia, el streak se resetea a dia 1*

---

## Arquitectura

```
Usuario
   |
   v
CloudFront (CDN) --> S3 (Frontend React)
   |
   v
API Gateway --> Lambda (Fastify API)
                  |
    +-------------+-------------+
    |             |             |
    v             v             v
PostgreSQL    Redis        Cognito
(RDS)        (Cache)       (Auth)
```

### Stack Tecnologico

**Frontend:**
- React 18 + Vite
- TailwindCSS
- TanStack Query
- Zustand

**Backend:**
- Node.js 20 + Fastify
- TypeScript
- Prisma ORM

**Infraestructura (AWS):**
- Lambda (serverless compute)
- RDS PostgreSQL Serverless v2
- ElastiCache Redis
- S3 + CloudFront
- Cognito (auth)

**IaC:**
- Terraform (modular, multi-environment)

---

## Modelo de Datos

```sql
-- Usuarios
CREATE TABLE users (
  id UUID PRIMARY KEY,
  cognito_id VARCHAR UNIQUE,
  email VARCHAR UNIQUE,
  display_name VARCHAR,
  avatar_url VARCHAR,
  coins INT DEFAULT 500,
  streak_days INT DEFAULT 0,
  last_daily_claim TIMESTAMP,
  created_at TIMESTAMP
);

-- Especies de Pokemon (sincronizado de PokeAPI)
CREATE TABLE pokemon_species (
  id INT PRIMARY KEY,           -- ID de PokeAPI (1-1025)
  name VARCHAR,
  sprite_url VARCHAR,
  types JSONB,                  -- ["fire", "flying"]
  rarity VARCHAR,               -- common/uncommon/rare/epic/legendary/mythical
  base_price INT,
  capture_rate INT,
  is_legendary BOOLEAN,
  is_mythical BOOLEAN,
  generation INT
);

-- Pokemon que posee un usuario
CREATE TABLE user_pokemon (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  species_id INT REFERENCES pokemon_species(id),
  nickname VARCHAR,
  is_shiny BOOLEAN DEFAULT false,
  is_in_team BOOLEAN DEFAULT false,
  team_position INT,            -- 1-6 si esta en equipo
  is_favorite BOOLEAN DEFAULT false,
  obtained_method VARCHAR,      -- shop_purchase, egg_hatch, trade
  obtained_at TIMESTAMP
);

-- Intercambios
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  initiator_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  status VARCHAR,               -- pending, accepted, rejected, cancelled, expired
  initiator_pokemon_ids UUID[],
  receiver_pokemon_ids UUID[],
  coins_offered INT DEFAULT 0,
  message TEXT,
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Pokedex del usuario
CREATE TABLE user_pokedex (
  user_id UUID REFERENCES users(id),
  species_id INT REFERENCES pokemon_species(id),
  first_obtained_at TIMESTAMP,
  times_obtained INT DEFAULT 1,
  PRIMARY KEY (user_id, species_id)
);
```

---

## Estructura del Proyecto

```
pokemon-marketplace/
├── apps/
│   ├── web/                    # Frontend (React + Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── store/
│   │   └── package.json
│   │
│   └── api/                    # Backend (Fastify)
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── repositories/
│       │   └── middleware/
│       ├── prisma/
│       └── package.json
│
├── packages/
│   └── shared/                 # Tipos y constantes compartidos
│
├── terraform/
│   ├── environments/           # dev, staging, prod
│   └── modules/                # networking, db, cache, api, etc.
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .github/workflows/          # CI/CD
├── tasks.json                  # Tareas atomicas del proyecto
└── README.md
```

---

## API Endpoints

```
# Auth
POST /auth/google/callback    - OAuth callback
POST /auth/refresh            - Refresh token

# Users
GET  /users/me                - Mi perfil
PATCH /users/me               - Actualizar perfil
POST /users/me/daily-reward   - Reclamar monedas diarias
GET  /users/:id               - Perfil publico de otro usuario

# Pokemon
GET  /pokemon                 - Mi coleccion
GET  /pokemon/team            - Mi equipo de 6
PUT  /pokemon/team            - Actualizar equipo
PATCH /pokemon/:id            - Actualizar nickname/favorito

# Pokedex
GET  /pokedex                 - Mi pokedex con status
GET  /pokedex/stats           - Estadisticas de completado

# Shop
GET  /shop/items              - Items disponibles
POST /shop/purchase           - Comprar pokemon o huevo

# Trades
GET  /trades                  - Mis intercambios
POST /trades                  - Crear oferta
POST /trades/:id/accept       - Aceptar
POST /trades/:id/reject       - Rechazar
POST /trades/:id/cancel       - Cancelar (solo initiator)
```

---

## Setup Local

```bash
# Clonar repo
git clone <repo-url>
cd pokemon-marketplace

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Levantar servicios (Docker)
docker-compose up -d

# Correr migraciones
pnpm db:migrate

# Seedear pokemon species
pnpm db:seed

# Desarrollo
pnpm dev
```

---

## Testing

```bash
# Unit tests
pnpm test:unit

# Integration tests (requiere Docker)
pnpm test:integration

# E2E tests
pnpm test:e2e

# Todos los tests
pnpm test
```

---

## Deploy

```bash
# Dev (automatico en push a main)
git push origin main

# Staging (manual con approval)
gh workflow run deploy-staging.yml

# Produccion (manual con approval)
gh workflow run deploy-prod.yml
```
