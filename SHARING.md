# CollabDocs — Deployment & Sharing Guide

Real-time collaborative editing across **any browser, Windows, and Mac** — all syncing live.

---

## Architecture

```
Browser / Windows .exe / Mac .dmg
         ↕ WebSocket (real-time sync)
   Hocuspocus Server (Railway / Render)
         ↕ Prisma ORM
   PostgreSQL Database (Supabase / Railway)
         ↕ HTTP API
   Next.js Frontend (Vercel)
```

---

## Step 1 — Set up the Database (Supabase — free)

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Copy your **Connection String** (Settings → Database → Connection string → URI)
3. It looks like: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

---

## Step 2 — Deploy the Hocuspocus WebSocket Server (Railway — free)

The WebSocket server needs a persistent process — Vercel serverless can't do this.

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select this repository
3. Set **Start Command**: `npx ts-node -P tsconfig.server.json server/index.ts`
4. Add environment variables in Railway dashboard:

```
DATABASE_URL=postgresql://...   (from Supabase)
JWT_SECRET=<random-32-chars>
PORT=<Railway assigns this automatically>
```

5. Copy your Railway deployment URL (e.g. `https://collabdocs-server.up.railway.app`)
6. Your WebSocket URL will be: `wss://collabdocs-server.up.railway.app`

---

## Step 3 — Deploy the Web App (Vercel — free)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select this repository
3. Add environment variables in Vercel dashboard:

```
NEXT_PUBLIC_WS_URL=wss://collabdocs-server.up.railway.app
JWT_SECRET=<same secret as Railway>
DATABASE_URL=postgresql://...   (same Supabase URL)
```

4. Deploy → Vercel gives you a URL like `https://collabdocs.vercel.app`

✅ **Anyone with this URL can now use the app in real-time from any browser.**

---

## Step 4 — Desktop App (Windows + Mac)

The Electron app loads the **cloud Vercel URL**, so desktop users sync with web users automatically.

### Build for Windows
```bash
# On a Windows machine:
COLLAB_DOCS_URL=https://collabdocs.vercel.app npm run electron-build
# Output: dist/CollabDocs-Setup.exe
```

### Build for Mac
```bash
# On a macOS machine:
COLLAB_DOCS_URL=https://collabdocs.vercel.app npm run electron-build
# Output: dist/CollabDocs.dmg
```

Distribute the `.exe` or `.dmg` file to your users — they connect to the same cloud backend as web users.

---

## Environment Variables Reference

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | ✅ Both | `postgresql://...@supabase.co/postgres` |
| `JWT_SECRET` | ✅ Both | 32-char random string |
| `NEXT_PUBLIC_WS_URL` | ✅ Frontend | `wss://your-server.railway.app` |
| `PORT` | ✅ Railway | Set automatically by Railway |
| `COLLAB_DOCS_URL` | Electron build | `https://your-app.vercel.app` |

---

## Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd collabdocs
npm install

# 2. Set up env
cp .env.example .env
# Edit .env with your local DB and jwt secret

# 3. Set up database
npx prisma migrate dev

# 4. Run both servers
npm run dev:all   # Next.js on :3000 + Hocuspocus on :1234

# 5. Open http://localhost:3000
```
