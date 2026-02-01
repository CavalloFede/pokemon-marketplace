# Vercel Deployment Review

## Executive Summary

Deploying the full Pokemon Marketplace to Vercel requires **significant changes** to the backend architecture. Vercel is optimized for serverless functions, while the current backend uses Fastify (a traditional server framework).

**Effort Estimate**: Medium-High (2-4 days of work)

---

## Current Architecture vs Vercel Model

| Component | Current | Vercel Requirement |
|-----------|---------|-------------------|
| Frontend | React + Vite | Works as-is |
| Backend | Fastify server (long-running) | Serverless functions (stateless) |
| Database | PostgreSQL (any provider) | PostgreSQL (Neon/Supabase) |
| Cache | Redis (ioredis) | Upstash Redis (serverless) |
| Auth | Firebase Admin SDK | Works as-is |

---

## What Works Without Changes

### Frontend (apps/web)
- React + Vite builds work perfectly on Vercel
- Just needs `VITE_API_URL` pointed to the API routes
- Firebase client SDK works fine

### Firebase Auth
- Firebase Admin SDK works in serverless
- Token verification is stateless

---

## Required Changes

### 1. Convert Fastify to Vercel Serverless Functions

**Current**: Single Fastify server handling all routes
**Required**: Individual serverless functions per route

#### Option A: Rewrite as API Routes (Recommended)
Create `/api` folder with serverless functions:

```
apps/api/
├── api/                          # New folder for Vercel
│   ├── auth/
│   │   └── authenticate.ts       # POST /api/auth/authenticate
│   ├── users/
│   │   ├── me.ts                 # GET /api/users/me
│   │   └── daily-reward.ts       # POST /api/users/me/daily-reward
│   ├── pokemon/
│   │   ├── index.ts              # GET /api/pokemon
│   │   ├── [id].ts               # GET /api/pokemon/:id
│   │   ├── [id]/sell.ts          # POST /api/pokemon/:id/sell
│   │   └── [id]/evolve.ts        # POST /api/pokemon/:id/evolve
│   ├── shop/
│   │   ├── items.ts              # GET /api/shop/items
│   │   └── purchase.ts           # POST /api/shop/purchase
│   ├── pokedex/
│   │   ├── index.ts              # GET /api/pokedex
│   │   └── stats.ts              # GET /api/pokedex/stats
│   ├── trades/
│   │   ├── index.ts              # GET, POST /api/trades
│   │   └── [id]/
│   │       ├── accept.ts
│   │       ├── reject.ts
│   │       └── cancel.ts
│   ├── want-listings/
│   │   ├── index.ts
│   │   ├── mine.ts
│   │   └── [id]/
│   │       ├── index.ts
│   │       └── accept.ts
│   └── counter-offers/
│       ├── index.ts
│       ├── mine.ts
│       └── [id]/
│           ├── accept.ts
│           ├── reject.ts
│           └── withdraw.ts
```

Each file exports a handler:
```typescript
// api/users/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { verifyAuth } from '../../src/middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userData = await prisma.user.findUnique({
    where: { id: user.id }
  });

  return res.json(userData);
}
```

#### Option B: Use @fastify/aws-lambda adapter
Wrap Fastify app for serverless:
```typescript
// api/index.ts
import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../src/app';

const app = await buildApp();
export default awsLambdaFastify(app);
```

**Pros**: Less rewriting
**Cons**: Cold starts, may hit function size limits, all routes in one function

---

### 2. Database: Switch to Serverless PostgreSQL

**Current**: Any PostgreSQL (local Docker)
**Required**: Serverless-friendly PostgreSQL

#### Recommended: Neon (Free tier available)
```env
DATABASE_URL="postgres://user:pass@ep-xxx.us-east-1.aws.neon.tech/pokemon_marketplace?sslmode=require"
```

#### Alternative: Supabase PostgreSQL
```env
DATABASE_URL="postgres://postgres:pass@db.xxx.supabase.co:5432/postgres"
```

#### Prisma Optimization for Serverless
Add to `schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // For better serverless support
}
```

Create connection pooling wrapper:
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

### 3. Redis: Switch to Upstash

**Current**: ioredis with traditional Redis
**Required**: Upstash Redis (serverless-compatible)

```bash
npm install @upstash/redis
```

Replace `src/lib/redis.ts`:
```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    return redis.get<T>(key);
  },
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } else {
      await redis.set(key, JSON.stringify(value));
    }
  },
  async del(key: string): Promise<void> {
    await redis.del(key);
  }
};
```

**Or remove Redis entirely** - it's only used for:
- Rate limiting (Vercel has built-in)
- Optional caching (can skip for MVP)

---

### 4. Rate Limiting

**Current**: @fastify/rate-limit with Redis
**Vercel**: Use Vercel's built-in or Upstash Rate Limit

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

// In each handler:
const { success } = await ratelimit.limit(userId);
if (!success) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

---

### 5. Auth Middleware Adaptation

**Current**: Fastify preHandler hook
**Required**: Utility function for each handler

```typescript
// src/middleware/auth.ts
import type { VercelRequest } from '@vercel/node';
import { auth } from '../lib/firebase';

export async function verifyAuth(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await auth.verifyIdToken(token);
    return { id: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
```

---

### 6. Project Structure Changes

```
pokemon-marketplace/
├── apps/
│   ├── api/
│   │   ├── api/              # NEW: Vercel serverless functions
│   │   │   └── [...routes]
│   │   ├── src/              # KEEP: Services, lib, shared logic
│   │   │   ├── services/
│   │   │   ├── lib/
│   │   │   └── middleware/
│   │   ├── prisma/
│   │   └── vercel.json       # NEW: Vercel config
│   │
│   └── web/
│       ├── src/
│       └── vercel.json       # NEW: Vercel config
│
└── vercel.json               # NEW: Root Vercel config (monorepo)
```

---

### 7. Vercel Configuration Files

#### Root `vercel.json`
```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": null
}
```

#### `apps/api/vercel.json`
```json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

#### `apps/web/vercel.json`
```json
{
  "framework": "vite",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist"
}
```

---

### 8. Environment Variables (Vercel Dashboard)

```env
# Database (Neon)
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/pokemon_marketplace

# Redis (Upstash) - Optional
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Firebase
FIREBASE_PROJECT_ID=pokemon-marketplace-7a781
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# App
NODE_ENV=production
CORS_ORIGIN=https://your-app.vercel.app
```

---

## Migration Checklist

### Phase 1: Database & Redis (1 day)
- [ ] Create Neon PostgreSQL database
- [ ] Run migrations on Neon
- [ ] Seed Pokemon data
- [ ] Create Upstash Redis (or remove Redis)
- [ ] Update connection strings

### Phase 2: API Conversion (2-3 days)
- [ ] Create `/api` folder structure
- [ ] Convert auth routes to serverless
- [ ] Convert user routes to serverless
- [ ] Convert pokemon routes to serverless
- [ ] Convert shop routes to serverless
- [ ] Convert pokedex routes to serverless
- [ ] Convert trade routes to serverless
- [ ] Convert want-listing routes to serverless
- [ ] Convert counter-offer routes to serverless
- [ ] Update auth middleware for serverless
- [ ] Update rate limiting

### Phase 3: Frontend Updates (0.5 day)
- [ ] Update API URL to `/api` (same-origin)
- [ ] Test all API calls
- [ ] Update CORS if needed

### Phase 4: Deployment (0.5 day)
- [ ] Configure Vercel project
- [ ] Set environment variables
- [ ] Deploy and test
- [ ] Monitor cold starts

---

## Cost Estimate (Vercel + Services)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 100GB bandwidth, 100hrs compute | $20/mo Pro |
| Neon PostgreSQL | 0.5GB storage, 1 compute | $19/mo |
| Upstash Redis | 10k commands/day | $0.2/100k |

**Total for hobby project**: Free
**Total for production**: ~$40-50/month

---

## Alternative: Simpler Deployment Options

If Vercel's serverless model seems like too much work, consider:

### Railway (Recommended)
- Keeps current Fastify architecture
- Built-in PostgreSQL & Redis
- ~$5-10/month
- **Zero code changes needed**

### Render
- Similar to Railway
- Free tier available
- Supports Fastify as-is

### Fly.io
- Docker-based deployment
- Uses existing Dockerfile
- Edge locations worldwide

---

## Recommendation

**For quick deployment**: Use **Railway** - no code changes needed.

**For Vercel specifically**: Plan for 2-4 days of refactoring work to convert Fastify routes to serverless functions. The main benefits would be:
- Same platform for frontend and backend
- Automatic scaling
- Edge functions (faster globally)
- Simpler deployment pipeline

The decision depends on whether you want to invest time in the serverless conversion or prefer a quicker deployment with Railway/Render.
