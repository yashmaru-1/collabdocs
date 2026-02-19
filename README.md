# CollabDocs

A **real-time collaborative document editor** — like Google Docs, but yours.

- ✍️ Live multiplayer editing (Y.js + Hocuspocus)  
- 🌐 Works in any browser — Chrome, Firefox, Safari, Edge
- 🖥️ Native desktop app for Windows and Mac (Electron)
- 💾 Auto-saves to PostgreSQL (never lose work)
- 🔒 JWT-authenticated, rate-limited, production-hardened

---

## Quick Start (Local Dev)

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env: add DATABASE_URL and JWT_SECRET

# Set up DB
npx prisma migrate dev

# Run everything
npm run dev:all
```

Open **http://localhost:3000** — start collaborating.

---

## Cloud Deployment

Point the desktop app and any browser at the same cloud backend.
See **[SHARING.md](./SHARING.md)** for the full step-by-step guide:
- 🗄️ Database → Supabase (free)
- ⚡ WebSocket server → Railway (free tier)
- 🌍 Web app → Vercel (free)
- 📦 Desktop → `.exe` (Windows) & `.dmg` (Mac)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tiptap v2 |
| Real-time | Y.js + Hocuspocus WebSocket |
| Database | PostgreSQL + Prisma |
| Auth | JWT (localStorage identity) |
| Desktop | Electron 40 |

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev:all` | Start Next.js + Hocuspocus together |
| `npm run dev` | Next.js only |
| `npm run electron-dev` | Electron dev (loads localhost) |
| `npm run electron-build` | Build desktop installer |
