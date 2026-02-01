# Pokemon Marketplace - Project Overview

## Quick Summary

A full-stack Pokemon trading and collection platform where users can buy, collect, evolve, and trade Pokemon using a coin-based economy.

**Live URL**: https://pokemon-marketplace-7a781.web.app (frontend only - needs backend deployed)

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI library |
| Vite | 5.1 | Build tool |
| TailwindCSS | 3.4 | Styling |
| React Router | 6.22 | Client routing |
| TanStack Query | 5.0 | Server state |
| Zustand | 4.5 | Client state |
| Firebase SDK | 10.8 | Authentication |
| TypeScript | 5.4 | Type safety |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Fastify | 4.26 | Web framework |
| Prisma | 5.0 | ORM |
| PostgreSQL | 15 | Database |
| Redis | 7 | Caching |
| Firebase Admin | 12.0 | Auth verification |
| Zod | 3.22 | Validation |
| TypeScript | 5.4 | Type safety |

### Infrastructure
| Service | Purpose | Current Status |
|---------|---------|----------------|
| Firebase Hosting | Frontend hosting | **Deployed** |
| Firebase Auth | Google OAuth | **Active** |
| PostgreSQL | Database | **Needs deployment** |
| Redis | Cache/Rate limiting | **Optional** |

---

## Features

### Core Features
- **User Authentication** - Google OAuth via Firebase
- **Pokemon Collection** - Buy, view, filter, favorite Pokemon
- **Shop System** - Purchase Pokemon directly or via eggs (randomized)
- **Pokedex Tracking** - Track completion by generation/type
- **Team Management** - Build a team of 6 Pokemon
- **Evolution System** - Level up and evolve Pokemon
- **Daily Rewards** - Streak-based coin rewards (100-200/day)

### Trading Features
- **Want Listings** - Post what Pokemon you want with offers
- **Direct Accept** - Accept listings instantly
- **Counter Offers** - Negotiate with different terms
- **Trade History** - Track all completed trades

### Economy
| Item | Price |
|------|-------|
| Common Pokemon | 100 coins |
| Uncommon Pokemon | 250 coins |
| Rare Pokemon | 500 coins |
| Epic Pokemon | 1,000 coins |
| Legendary Pokemon | 5,000 coins |
| Mythical Pokemon | 10,000 coins |
| Common Egg | 75 coins |
| Rare Egg | 350 coins |
| Legendary Egg | 2,500 coins |
| Mystery Egg | 500 coins |

---

## Project Structure

```
pokemon-marketplace/
├── apps/
│   ├── api/                 # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth & logging
│   │   │   └── lib/         # Firebase, Prisma, Redis
│   │   ├── prisma/          # Database schema & migrations
│   │   └── Dockerfile       # Container build
│   │
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── pages/       # Route components
│       │   ├── components/  # Reusable UI
│       │   ├── hooks/       # React Query hooks
│       │   ├── store/       # Zustand stores
│       │   └── services/    # API client
│       └── Dockerfile       # Container build (nginx)
│
├── packages/
│   └── shared/              # Shared types & constants
│
└── scripts/                 # Local dev helper scripts
```

---

## API Endpoints

### Authentication
- `POST /auth/authenticate` - Verify Firebase token & login/register

### Users
- `GET /users/me` - Get current user profile
- `POST /users/me/daily-reward` - Claim daily coins

### Pokemon Collection
- `GET /pokemon` - List user's Pokemon (with filters)
- `GET /pokemon/team` - Get user's team
- `PUT /pokemon/team` - Update team
- `POST /pokemon/:id/sell` - Sell Pokemon
- `POST /pokemon/:id/evolve` - Evolve Pokemon

### Shop
- `GET /shop/items` - List shop items
- `POST /shop/purchase` - Buy item

### Pokedex
- `GET /pokedex` - Get Pokedex entries
- `GET /pokedex/stats` - Completion stats

### Trading
- `GET /want-listings` - Browse listings
- `POST /want-listings` - Create listing
- `POST /want-listings/:id/accept` - Accept listing
- `POST /counter-offers` - Make counter offer
- `POST /counter-offers/:id/accept` - Accept counter offer

---

## Environment Variables

### Backend Required
```env
DATABASE_URL=postgresql://user:pass@host:5432/pokemon_marketplace
REDIS_URL=redis://host:6379
PORT=3000
NODE_ENV=production
FIREBASE_PROJECT_ID=pokemon-marketplace-7a781
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
CORS_ORIGIN=https://pokemon-marketplace-7a781.web.app
```

### Frontend Required
```env
VITE_API_URL=https://your-api-url.com
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=pokemon-marketplace-7a781.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pokemon-marketplace-7a781
```

---

## Deployment Options

### Option 1: Railway (Recommended)
**Pros**: Easy setup, free tier, includes PostgreSQL & Redis
**Cons**: Free tier has limits

Services needed:
- 1x Web Service (API)
- 1x PostgreSQL
- 1x Redis

Estimated cost: Free tier available, ~$5-10/month for basic usage

### Option 2: Render
**Pros**: Free tier, auto-deploy from GitHub
**Cons**: Free tier sleeps after inactivity

Services needed:
- 1x Web Service (API)
- 1x PostgreSQL (free tier available)
- Redis (external or upgrade needed)

### Option 3: Fly.io
**Pros**: Good performance, global edge
**Cons**: More complex setup

### Option 4: Supabase + Vercel
**Pros**: Managed PostgreSQL, serverless
**Cons**: Need to adapt Fastify to serverless

---

## Deployment Simplification Options

### Remove Redis Dependency (Optional)
Redis is used for:
- Rate limiting state
- Optional caching

**Impact**: Can remove without breaking core functionality
**How**: Use in-memory rate limiting or disable

### Current Simplified Stack
- API server (Fastify)
- PostgreSQL database
- Redis (optional)

**Removed**: Monitoring (Prometheus/Grafana), Terraform, GitHub Actions

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| users | User accounts & profiles |
| pokemon_species | All 1,025 Pokemon data |
| user_pokemon | Pokemon owned by users |
| user_pokedex | Pokedex completion tracking |
| shop_items | Shop inventory |
| trades | Direct trade offers |
| want_listings | "I want X" listings |
| counter_offers | Responses to want listings |
| coin_transactions | Economy audit trail |

---

## Pre-Deployment Checklist

- [ ] PostgreSQL database provisioned
- [ ] Redis provisioned (or removed)
- [ ] Firebase service account key exported
- [ ] Environment variables configured
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] Database seeded with Pokemon (`npx prisma db seed`)
- [ ] CORS configured for production domain
- [ ] Frontend VITE_API_URL updated

---

## Commands

```bash
# Development
pnpm dev              # Run all dev servers
pnpm build            # Build all packages
pnpm test             # Run tests

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed Pokemon data
pnpm db:studio        # Open Prisma Studio

# Production build
cd apps/api && pnpm build
cd apps/web && pnpm build
```

---

## Known Issues / Tech Debt

1. **No backend deployment** - Currently localhost only
2. **Redis dependency** - Could be optional
3. **Some test mocks outdated** - Pre-existing auth tests need update
4. **No email notifications** - Trading notifications are in-app only

---

## Next Steps for Deployment

1. **Choose hosting provider** (Railway recommended)
2. **Provision PostgreSQL**
3. **Decide on Redis** (keep or remove)
4. **Deploy API**
5. **Update frontend env vars**
6. **Redeploy frontend to Firebase**
7. **Test end-to-end**
