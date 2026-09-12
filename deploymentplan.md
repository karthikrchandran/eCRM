# Zero-to-Low-Cost Deployment Guide: eCRM + SignalLoop

**Date**: 2026-08-18  
**Target Cost**: ~$0–$20/month for first 3 months (then ~$20–$50/month)

---

## Overview

| Component | Platform | Cost | Notes |
|-----------|----------|------|-------|
| **eCRM Frontend** | Vercel | Free | Auto-deploy on GitHub push |
| **SignalLoop Web** | Vercel | Free | Same free tier |
| **SignalLoop API + Workers** | Railway | Free ($5 credit/mo) | ~2-3 months free |
| **PostgreSQL (eCRM)** | Supabase | Free | One Supabase project/database per customer cell. Do not share ARA Global and AI Consulting in one database. |
| **PostgreSQL (SignalLoop)** | Railway | Free | Included in free tier |
| **Redis** | Railway | Free | Included; used by SignalLoop workers |
| **CI/CD** | GitHub Actions | Free | Public repo only |
| **DNS/CDN** | Cloudflare | Free | Optional; adds WAF + caching |

**Total: ~$0/month for 3 months, then $20–50/month as you scale**

---

## Pre-Deployment Checklist

- [ ] Both repos pushed to GitHub (public or private with Deploy keys)
- [ ] GitHub account created
- [ ] Vercel account (sign in with GitHub)
- [ ] Railway account (sign in with GitHub)
- [ ] Supabase account (sign in with GitHub)
- [ ] `.env` files prepared (never commit secrets)

---

## Part 1: Deploy eCRM customer cells (Next.js + Supabase)

**Customer-cell rule:** create one Supabase project/database and one app deployment per customer cell. For tomorrow's demos, use `ecrm-ara-global-demo` with `CELL_ID=cell_ara_global` and `CELL_KEY=ara-global`, plus `ecrm-ai-consulting-demo` with `CELL_ID=cell_ai_consulting` and `CELL_KEY=ai-consulting`. Do not put ARA Global and AI Consulting into the same Supabase database; the eCRM business schema is dedicated-cell, not pooled multi-tenant.

Seed the demos with `npm run prisma:seed:tenant`, never with `npm run prisma:seed` or `npx prisma db seed` against Supabase. The tenant seed creates `karthik@ara-global.demo.local`, `yamini@ara-global.demo.local`, `padma@ara-global.demo.local`, and `atchaya@ara-global.demo.local` in the ARA cell, and a separate `karthik@ai-consulting.demo.local` plus `aishwarya@ai-consulting.demo.local` in the AI Consulting cell.

### Step 1.1: Prepare Supabase Databases

1. Go to [supabase.com](https://supabase.com) → Sign up with GitHub
2. Create the ARA Global project:
   - **Name**: `ecrm-ara-global-demo`
   - **Region**: Closest to your users
   - **Password**: Generate strong password (save it)
3. Create the AI Consulting project:
   - **Name**: `ecrm-ai-consulting-demo`
   - **Region**: Closest to your users
   - **Password**: Generate a different strong password (save it)
4. Once both projects are created, go to **Settings → Database** in each project and copy the `Connection string` (Psql):
   ```
   postgresql://postgres:[YOUR_PASSWORD]@[HOST]:[PORT]/postgres
   ```
5. Create `.env.local` in eCRM root for the cell you are migrating or deploying:
   ```
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
   AUTH_SECRET="[GENERATE_32_PLUS_CHAR_SECRET]"
   APP_BASE_URL="https://[THIS_CELL_VERCEL_URL]"
   APP_MODE="cell"
   CELL_ID="[cell_ara_global or cell_ai_consulting]"
   CELL_KEY="[ara-global or ai-consulting]"
   ```

### Step 1.2: Run Prisma Migrations on Supabase

```bash
cd c:\My Workspace\eCRM
# ARA Global cell
$env:DATABASE_URL="postgresql://postgres:[ARA_PASSWORD]@[ARA_HOST]:5432/postgres"
$env:APP_MODE="cell"
$env:CELL_ID="cell_ara_global"
$env:CELL_KEY="ara-global"
npx prisma migrate deploy
$env:TENANT_SEED="ara-global"
$env:TENANT_SEED_ADMIN_PASSWORD="[SECRET_FOR_KARTHIK_ARA]"
$env:TENANT_SEED_SALES_PASSWORD="[SECRET_FOR_ARA_REPS]"
npm run prisma:seed:tenant

# AI Consulting cell
$env:DATABASE_URL="postgresql://postgres:[AIC_PASSWORD]@[AIC_HOST]:5432/postgres"
$env:APP_MODE="cell"
$env:CELL_ID="cell_ai_consulting"
$env:CELL_KEY="ai-consulting"
npx prisma migrate deploy
$env:TENANT_SEED="ai-consulting"
$env:TENANT_SEED_ADMIN_PASSWORD="[SECRET_FOR_KARTHIK_AI_CONSULTING]"
$env:TENANT_SEED_SALES_PASSWORD="[SECRET_FOR_AISHWARYA]"
npm run prisma:seed:tenant

# Verify one cell connection at a time
npx prisma studio  # Opens web interface to see your schema
```

### Step 1.3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"**
3. Select your **eCRM** GitHub repo
4. **Framework Preset**: Next.js (auto-detected)
5. **Environment Variables**: Add from the `.env.local` for exactly one cell:
   ```
   DATABASE_URL = postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   AUTH_SECRET = [strong secret unique to this cell]
   APP_BASE_URL = [this deployment URL]
   APP_MODE = cell
   CELL_ID = [cell_ara_global or cell_ai_consulting]
   CELL_KEY = [ara-global or ai-consulting]
   ```
6. Click **Deploy**
7. Repeat this Vercel setup for the other cell with its own Supabase `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL`, `CELL_ID`, and `CELL_KEY`.
8. You should finish with two separate app URLs, one for ARA Global and one for AI Consulting.
9. After ~5–10 min, each app will be live at its own URL.

### Step 1.4: Monitor & Update

- Vercel auto-deploys on every push to `main`
- View logs: Vercel dashboard → **Project → Deployments**
- Rollback: Vercel dashboard → **Deployments → (previous) → Redeploy**

---

## Part 2: Deploy SignalLoop (FastAPI + Node.js + PostgreSQL + Redis)

SignalLoop lives in the separate repo `C:\Users\K.Ramachandran\eMailVoice`.
For the ARA Global and AI Consulting demos, use two separate SignalLoop
runtime environments/databases, matching the two eCRM customer cells:

| Demo cell | SignalLoop env template | SignalLoop database | Workspace ID | eCRM cell |
| --- | --- | --- | --- | --- |
| ARA Global | `C:\Users\K.Ramachandran\eMailVoice\docs\operations\examples\ara-global.env.example` | `signalloop_ara_global` | `workspace_ara_global` | `cell_ara_global` / `ara-global` |
| AI Consulting | `C:\Users\K.Ramachandran\eMailVoice\docs\operations\examples\ai-consulting.env.example` | `signalloop_ai_consulting` | `workspace_ai_consulting` | `cell_ai_consulting` / `ai-consulting` |

Do not point both SignalLoop demos at the same Postgres database. SignalLoop's
database is separate from the eCRM cell database, but it must be isolated with
the same customer-cell discipline.

After each SignalLoop deployment is running, create the eCRM installation
binding from the SignalLoop workspace admin context:

```powershell
# ARA Global SignalLoop workspace -> ARA Global eCRM cell
PUT /api/v1/ecrm-installations/binding
X-Workspace-Id: workspace_ara_global
{
  "endpoint_id": "ara-global",
  "secret_reference_id": "ara-global-delivery-v1",
  "capabilities": ["SHARED_RECORD", "WORKFLOW_EVENT"],
  "status": "ACTIVE",
  "source_version": 1
}

# AI Consulting SignalLoop workspace -> AI Consulting eCRM cell
PUT /api/v1/ecrm-installations/binding
X-Workspace-Id: workspace_ai_consulting
{
  "endpoint_id": "ai-consulting",
  "secret_reference_id": "ai-consulting-delivery-v1",
  "capabilities": ["SHARED_RECORD", "WORKFLOW_EVENT"],
  "status": "ACTIVE",
  "source_version": 1
}
```

The SignalLoop repo details live in
`C:\Users\K.Ramachandran\eMailVoice\docs\operations\ecrm-installation-projections.md`.

### Step 2.1: Prepare Docker Images

SignalLoop already has `apps/api/Dockerfile`. Ensure it exists and is production-ready:

**File**: `apps/api/Dockerfile` (should exist, verify it has):
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**File**: `apps/web/Dockerfile` (create if missing):
```dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "-m", "vite", "preview", "--host"]
```

### Step 2.2: Set Up Railway Project

1. Go to [railway.app](https://railway.app) → Sign in with GitHub
2. Create new project → **Deploy from GitHub repo**
3. Select your **SignalLoop** repo
4. Railway auto-detects services from `compose.yml`:
   - PostgreSQL
   - Redis
   - API
   - Web
   - sequence-worker

### Step 2.3: Configure Environment Variables in Railway

In Railway dashboard, for each service:

**Database (PostgreSQL)**:
```
POSTGRES_USER=signalloop
POSTGRES_PASSWORD=[GENERATE_STRONG]
POSTGRES_DB=[signalloop_ara_global or signalloop_ai_consulting]
```

**API Service**:
```
POSTGRES_SERVER=db
POSTGRES_USER=signalloop
POSTGRES_PASSWORD=[SAME_AS_ABOVE]
POSTGRES_DB=[signalloop_ara_global or signalloop_ai_consulting]
REDIS_URL=redis://redis:6379/0
FRONTEND_HOST=https://[YOUR_WEB_DOMAIN]
VITE_API_URL=https://[YOUR_API_DOMAIN]
```

**Web Service**:
```
VITE_API_URL=https://[YOUR_API_DOMAIN]
NODE_ENV=production
```

**Sequence Worker**:
```
POSTGRES_SERVER=db
POSTGRES_USER=signalloop
POSTGRES_PASSWORD=[SAME]
POSTGRES_DB=[signalloop_ara_global or signalloop_ai_consulting]
REDIS_URL=redis://redis:6379/0
```

### Step 2.4: Deploy to Railway

1. In Railway dashboard, click **Deploy**
2. Railway reads `compose.yml` and deploys all services
3. Once healthy:
   - **API URL**: `https://[project-id]-api-prod.railway.app`
   - **Web URL**: `https://[project-id]-web-prod.railway.app`

### Step 2.5: Run Initial Migrations

Once API is live, SSH into the API container or use Railway's shell:

```bash
# In Railway dashboard, click API service → Shell tab
cd /app
python -m app.db.migrate
python -m app.db.seed  # Optional
```

---

## Part 3: Connect Frontend to Backend

### Step 3.1: Update eCRM Environment for SignalLoop API

If eCRM needs to call SignalLoop API, add to Vercel:

**Vercel → Project Settings → Environment Variables**:
```
NEXT_PUBLIC_SIGNALLOOP_API_URL=https://[railway-api-url]
```

### Step 3.2: Update SignalLoop Web to Call API

Already configured in Railway if you set `VITE_API_URL` correctly.

### Step 3.3: Enable CORS Between Domains

**SignalLoop API** (`apps/api/app/main.py`):
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ecrm-[random].vercel.app",
        "https://signalloop-[random].railway.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Part 4: Post-Deployment Checklist

### Monitoring

- **eCRM**: Vercel Analytics dashboard
  - Real-time CPU/memory
  - Error tracking
  - Deployment logs
- **SignalLoop**: Railway dashboard
  - Container health
  - Redis memory
  - PostgreSQL connections

### Backup Strategy

**Supabase (eCRM DB)**:
- Automatic daily backups (free tier)
- Manual export: Supabase → **Settings → Backups → Download**

**Railway (SignalLoop DB)**:
- Manual backup: Railway → **PostgreSQL → Shell**
  ```bash
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
  ```

### Custom Domains (Optional, Free with Cloudflare)

1. **eCRM**: Vercel → Settings → Domains → Add `ecrm.yourdomain.com`
2. **SignalLoop API**: Railway -> Settings -> Domains -> Add `api.yourdomain.com`
3. Update Cloudflare DNS to point to Vercel/Railway IPs

---

## Part 5: GitHub Actions for CI/CD (Optional)

### Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy eCRM & SignalLoop

on:
  push:
    branches: [main]

jobs:
  ecrm-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npx vercel --token ${{ secrets.VERCEL_TOKEN }} --prod
        working-directory: c:\My Workspace\eCRM

  signalloop-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway deploy --token ${{ secrets.RAILWAY_TOKEN }}
        working-directory: C:\Users\K.Ramachandran\eMailVoice
```

---

## Cost Timeline

### **Months 1–3 (Free or ~$5/month)**
- **Vercel**: Free tier
- **Railway**: $5 credit/month (effectively free)
- **Supabase**: Free tier
- **Total**: **$0**

### **Month 4+ (As you scale)**
- **Vercel**: $20/month (Pro) if you exceed free tier
- **Railway**: $5–50/month (depending on usage)
- **Supabase**: $25/month (Pro) if you exceed 500 MB
- **Total**: **$20–50/month**

### **When to Upgrade**
- eCRM: When >100 GB bandwidth/month or >50k MAU
- SignalLoop: When >100k requests/month or DB >500 MB
- Supabase: When DB storage >500 MB

---

## Troubleshooting

### eCRM not deploying
```bash
# Local test
npm run build
npm start
# Check: DATABASE_URL in Vercel env vars
```

### SignalLoop API returning 500 errors
```bash
# Check Redis connection in Railway logs
# Check PostgreSQL is healthy: Railway → Services → PostgreSQL → Logs
# Verify POSTGRES_SERVER=db (container name, not localhost)
```

### Database connection timeouts
- Supabase: Check IP whitelist (Settings → Database → Network)
- Railway: Ensure DATABASE_URL uses internal hostname `db`

### Too slow?
- Add Cloudflare caching (free)
- Upgrade Railway to Hobby tier ($5 base)
- Increase Supabase compute ($10)

---

## Summary

**Quick Start**:
1. Create Supabase project → get CONNECTION_STRING
2. `npx prisma migrate deploy` (eCRM)
3. Push eCRM to Vercel
4. Create Railway project -> auto-deploys SignalLoop
5. Set environment variables
6. Done! ✅

**Timeline**: ~30 min to fully deployed  
**Cost**: $0 for 3 months  
**Maintenance**: ~5 min/week (monitor logs, update code)

---

## Next Steps

- Monitor first week for errors
- Set up billing alerts
- Plan DB backups strategy
- Consider domain name + custom email

---

**Questions?** Check:
- Vercel docs: https://vercel.com/docs
- Railway docs: https://docs.railway.app
- Supabase docs: https://supabase.com/docs
