# Deployment Guide - Hybrid Approach

Deploy the Pokemon Marketplace with:
- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Fastify + PostgreSQL)

---

## Prerequisites

- GitHub account (repo already pushed)
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- Firebase project configured (already done)

---

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Project

1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `CavalloFede/pokemon-marketplace`
5. Railway will detect the monorepo

### Step 2: Configure the API Service

1. Click on the deployed service
2. Go to **Settings** → **Build**
3. Set:
   - **Root Directory**: `apps/api`
   - **Builder**: Dockerfile
4. Railway will rebuild using the Dockerfile

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for it to provision
4. Click on PostgreSQL → **"Variables"**
5. Copy the `DATABASE_URL`

### Step 4: Configure Environment Variables

Click on the API service → **"Variables"** → Add:

```
DATABASE_URL=<paste from PostgreSQL service>
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=https://your-app.vercel.app

# Firebase (get from Firebase Console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=pokemon-marketplace-7a781
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"pokemon-marketplace-7a781",...}
```

**Important**: For `FIREBASE_SERVICE_ACCOUNT_KEY`, paste the entire JSON as a single line.

### Step 5: Run Database Migrations

Option A - Using Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway link
railway run npx prisma migrate deploy
railway run npx tsx prisma/seed.ts
```

Option B - Using Railway Shell:
1. Click on API service → **"Shell"**
2. Run:
```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### Step 6: Get Your API URL

1. Go to API service → **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://pokemon-marketplace-api-production.up.railway.app`)

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Project

1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import `CavalloFede/pokemon-marketplace`

### Step 2: Configure Build Settings

1. **Framework Preset**: Vite
2. **Root Directory**: `apps/web`
3. **Build Command**: `pnpm build`
4. **Output Directory**: `dist`
5. **Install Command**: `cd ../.. && pnpm install`

### Step 3: Set Environment Variables

Add these in Vercel's Environment Variables section:

```
VITE_API_URL=https://your-railway-api-url.up.railway.app
VITE_FIREBASE_API_KEY=AIzaSyCaQTFLeQWDBRUhFKhEemS0z9llDr5AWQ8
VITE_FIREBASE_AUTH_DOMAIN=pokemon-marketplace-7a781.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pokemon-marketplace-7a781
VITE_FIREBASE_STORAGE_BUCKET=pokemon-marketplace-7a781.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=620203135967
VITE_FIREBASE_APP_ID=1:620203135967:web:e94f82ec27e9fc05282a6a
```

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Get your Vercel URL (e.g., `https://pokemon-marketplace.vercel.app`)

### Step 5: Update Railway CORS

Go back to Railway and update the `CORS_ORIGIN` variable:
```
CORS_ORIGIN=https://pokemon-marketplace.vercel.app
```

---

## Part 3: Firebase Auth Configuration

Add your Vercel domain to Firebase authorized domains:

1. Go to Firebase Console → Authentication → Settings
2. Under **Authorized domains**, add:
   - `pokemon-marketplace.vercel.app`
   - `your-custom-domain.com` (if applicable)

---

## Verification Checklist

- [ ] Railway API health check: `https://your-api.railway.app/health`
- [ ] Database connected (health check shows `database: healthy`)
- [ ] Frontend loads at Vercel URL
- [ ] Google Sign-In works
- [ ] Can view shop items
- [ ] Can purchase Pokemon
- [ ] Can view collection

---

## Optional: Add Redis (For Caching)

Redis is optional but improves performance:

1. In Railway, click **"+ New"** → **"Database"** → **"Redis"**
2. Copy the `REDIS_URL` from Redis service variables
3. Add to API service variables:
   ```
   REDIS_URL=redis://default:xxx@xxx.railway.internal:6379
   ```
4. Redeploy

---

## Troubleshooting

### "Failed to fetch" on login
- Check CORS_ORIGIN matches your Vercel URL exactly
- Check Firebase authorized domains includes your Vercel URL

### Database connection errors
- Verify DATABASE_URL is set correctly
- Run migrations: `railway run npx prisma migrate deploy`

### 500 errors on API
- Check Railway logs: Click service → "Logs"
- Verify FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON

### Pokemon not showing in shop
- Run seed: `railway run npx tsx prisma/seed.ts`

---

## Cost Summary

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Railway | $5 credit/month | Usually enough for hobby |
| Vercel | 100GB bandwidth | Generous free tier |
| Firebase Auth | 50k MAU | More than enough |

**Total for hobby project**: Free (within limits)

---

## URLs After Deployment

- **Frontend**: `https://pokemon-marketplace.vercel.app`
- **Backend API**: `https://pokemon-marketplace-api.up.railway.app`
- **Health Check**: `https://pokemon-marketplace-api.up.railway.app/health`
