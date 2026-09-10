# Deployment Guide

The app runs entirely on managed free tiers. There is no server to SSH into.

| Layer | Provider | Notes |
|---|---|---|
| Frontend | **Vercel** static hosting | Vite build → `dist/` |
| API | **Vercel** serverless function | `api/index.js` wraps the Express app in `server/app.js` |
| Database | **Neon** (Postgres) | `DATABASE_URL` + SSL |
| File storage | **Vercel Blob** | store `everything-files` (public); browser uploads direct to Blob |

- **Live URL:** https://projecteverything.vercel.app
- **Vercel project:** `matts-projects-4cc0b5df/project_everything` (linked to GitHub `mhaney93/Project_Everything`)

---

## Deploying

### Normal path — git push

```bash
git push origin main
```

Vercel auto-builds and deploys `main` to production. Watch it in the dashboard or:

```bash
npx vercel ls          # recent deployments + status
npx vercel inspect <url>
```

### Manual deploy (no commit)

```bash
npx vercel deploy --prod     # production
npx vercel deploy            # throwaway preview URL
```

### Rollback

Dashboard → Deployments → pick a previous **Ready** production deploy → **Promote to Production**. Or `npx vercel promote <old-deployment-url>`.

---

## How routing works

`vercel.json` rewrites `/api/*` and `/health` to the single function `api/index.js`.
Everything else is served as static files, with SPA fallback to `index.html` (Vite preset).
The Express app in `server/app.js` does its own routing on `req.url`, so `/api/auth/*`,
`/api/maps/*`, `/api/files/*` all resolve inside the one function.

Local dev is unchanged: `npm run dev` (frontend) + `cd server && npm run dev` (API on :5000).

---

## Environment variables

Managed in Vercel (Settings → Environment Variables), **not** in any committed file.

| Var | Where it's used |
|---|---|
| `DATABASE_URL` | Neon pooled connection string, `?sslmode=require` |
| `JWT_SECRET` | signs the auth cookie (`server/middleware/auth.js`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (auto-added when the store was linked) |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail + app password for password-reset mail |
| `FRONTEND_URL` | `https://projecteverything.vercel.app` — used in reset-email links and CORS |
| `NODE_ENV` | `production` — gates `secure` cookie flag and CORS allow-list |

CLI:

```bash
npx vercel env ls
npx vercel env add   <NAME> production      # prompts for value (stdin)
npx vercel env rm    <NAME> production
npx vercel env pull  .env.local             # sync down for local scripts (gitignored)
```

### Rotating a secret

```bash
npx vercel env rm  JWT_SECRET production preview
printf '%s' "$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")" \
  | npx vercel env add JWT_SECRET production
# repeat for preview, then:
npx vercel deploy --prod
```

Rotating `JWT_SECRET` invalidates every existing login cookie (everyone re-logs-in once).

---

## Database

```bash
psql "$DATABASE_URL"                       # DATABASE_URL is in .env.local after `vercel env pull`
```

Schema lives in `server/db/schema.sql`; migrations in `server/db/*.sql`. Apply against Neon
manually (`psql "$DATABASE_URL" -f server/db/<file>.sql`) — there is no automated migration step.
Node **label** migrations are separate and run client-side (see [SETUP.md](SETUP.md#data-migrations)).

---

## Files / Vercel Blob

- Uploads: the browser calls `POST /api/files/upload` for a scoped token, then uploads bytes
  straight to Blob (`@vercel/blob/client`), then `POST /api/files/complete` writes the DB row.
  This bypasses the 4.5 MB serverless request-body limit, so large videos work.
- `files.file_path` stores the Blob URL. `view`/`download` auth-check the row then 302-redirect
  to Blob; `delete` removes the Blob object.
- One-time legacy import script: `scripts/migrate-files-to-blob.mjs` (already run for the
  original 15 files; kept for reference).

---

## Logs & debugging

```bash
npx vercel logs <deployment-url>          # runtime logs
npx vercel logs <deployment-url> --follow
```

Or Vercel dashboard → the deployment → **Runtime Logs** / **Build Logs**.

---

## History

Migrated off a self-managed AWS EC2 + Docker Compose stack in Sept 2026 (Neon first, then
Vercel + Blob). The EC2 instance, Elastic IP, and Route 53 zone were torn down. Earlier
AWS/Docker instructions previously here — and the stale AWS section still in `SETUP.md` — no
longer apply.
