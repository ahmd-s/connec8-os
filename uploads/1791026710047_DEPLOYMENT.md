# Connec8 OS — Deploying to Vercel

## Readiness status

| Component | Local (now) | On Vercel | Notes |
|---|---|---|---|
| Next.js 16 App Router | ✅ | ✅ works as-is | Hash routing needs zero server config |
| All API routes | ✅ | ✅ works as-is | Standard Node runtime, no disk deps |
| **Database (SQLite file)** | ✅ | ❌ **BLOCKER** | Vercel's filesystem is ephemeral — the DB file resets on every deployment |
| **File uploads (local disk)** | ✅ | ❌ **BLOCKER** | Same reason — now solved: uploads auto-switch to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set |
| Prisma generate on build | — | ✅ **fixed** | `postinstall: prisma generate` added to package.json |

**Bottom line:** the code is deployment-ready. The only required change before deploying is pointing Prisma at a hosted database (one schema line + one env var). Follow Option A below — it takes ~15 minutes.

---

## Option A (recommended): Neon Postgres + Vercel Blob

[Neon](https://neon.tech) is serverless Postgres with a generous free tier; it's also what Vercel Postgres runs on. No driver-adapter code changes needed.

### 1. Create the database
1. Sign up at [neon.tech](https://neon.tech) → create project `connec8-os`
2. Copy the pooled connection string (looks like `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/connec8?sslmode=require`)

### 2. Switch the schema provider (one line)
In `prisma/schema.prisma`:
```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

### 3. Push the schema and seed it
```bash
export DATABASE_URL="postgresql://...your-neon-url..."
npx prisma db push        # creates all 17 tables
bun prisma/seed.ts        # loads Ahmd + Prasanna, demo leads, DentOS, etc. (optional)
```

### 4. Create the Blob store
Vercel dashboard → your project → **Storage** tab → **Create Database → Blob**. This injects `BLOB_READ_WRITE_TOKEN` automatically on deploy. (Skippable if you don't need file attachments on day one — the app works without it.)

### 5. Deploy
```bash
npm i -g vercel
vercel          # first run: link project, accept defaults (Framework: Next.js)
vercel env add DATABASE_URL production     # paste the Neon pooled URL
# + vercel env add BLOB_READ_WRITE_TOKEN production  (if using Blob)
vercel --prod
```
Or push the repo to GitHub and import it at [vercel.com/new](https://vercel.com/new) → add the same env vars in Project Settings → Environment Variables.

> **Build settings:** leave Vercel's defaults (Build Command `next build`, Install Command default). `prisma generate` runs automatically via the `postinstall` script. Do **not** set the build command to `npm run build` — that script's `cp` steps are for standalone/Docker mode only.

### 6. Verify
Open the deployed URL → dashboard should render with (seeded) live data → upload an attachment on any lead → reload to confirm persistence.

---

## Option B: Vercel Postgres (via Vercel dashboard)
Same as Option A but the database lives inside Vercel: project → **Storage** → **Create Database → Postgres (Neon)**. Vercel injects `DATABASE_URL` (and `POSTGRES_URL`) for you — you still make the one-line provider switch and run `npx prisma db push` locally against the injected URL (`vercel env pull .env.production` to fetch it).

## Option C: Supabase
Works identically (Postgres connection string). Bonus: Supabase Storage could replace Vercel Blob later, but Vercel Blob is already wired — keep it simple.

## Option D (advanced): Turso / libSQL — keep SQLite
[Turso](https://turso.tech) hosts SQLite-compatible databases over HTTP. Keeps the SQLite dialect but **requires code changes** (Prisma `libsql` provider + driver adapter in `src/lib/db.ts` + `@libsql/client`). Only pick this if you specifically want Turso; Option A is the standard path.

---

## After first deploy — strongly recommended

1. **Gate access.** The app currently has a client-side user switcher, not a login. On a public URL anyone with the link can read your pipeline. Cheapest fix: **Vercel Dashboard → Deployment Protection** (Requires Authentication — included on Pro/Enterprise, or use Shareable Links to control access). Proper per-user auth: NextAuth.js v4 (already in package.json) — say the word and it will be wired in.
2. **Backups.** Neon free tier includes point-in-time restore; Supabase has daily backups on paid tiers. For an internal business OS, enable at least one.
3. **Migrations over pushes.** For ongoing schema changes after go-live, prefer `npx prisma migrate dev --name <change>` locally + `npx prisma migrate deploy` (can be added to Vercel build command) instead of `db push`, for a reviewable history.
4. **Custom domain.** Vercel → Settings → Domains.

## Known limitations on serverless

- `/api/files` proxies Blob files through a serverless function so attachments stay private — fine for internal-team traffic.
- The `uploads/` disk fallback still exists for local development; it is simply unused once `BLOB_READ_WRITE_TOKEN` is present.
- `output: "standalone"` in `next.config.ts` only affects self-hosting/Docker; Vercel ignores it.
- Dashboard/analytics queries run on every request (live, no cache) — perfectly fine at founder-team scale; add caching only if usage grows.

## Environment variables reference

| Var | Where | Required |
|---|---|---|
| `DATABASE_URL` | Neon / Supabase / Vercel Postgres connection string | ✅ always |
| `BLOB_READ_WRITE_TOKEN` | Injected by Vercel when a Blob store is attached | for file uploads |
