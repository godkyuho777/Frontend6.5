# tradelab-frontend

React + Vite + tRPC + Tailwind 4 + shadcn UI for Tradelab. Auth via Supabase,
deployed to Vercel.

## Local development

```bash
cp .env.example .env   # then fill in Supabase project keys
pnpm install
pnpm dev               # http://localhost:5173, /api proxied to :3000
```

The dev server proxies `/api/*` to `VITE_DEV_API_URL` (default
`http://localhost:3000`), so run `tradelab-backend` first.

## Type sharing

The backend's tRPC `AppRouter` is consumed via the local file dependency:

```json
"@tradelab/backend": "file:../tradelab-backend"
```

This works for solo development with both repos cloned side-by-side.
**Before deploying to Vercel**, swap the dependency to a git URL so Vercel
can fetch the backend's types:

```json
"@tradelab/backend": "github:OWNER/REPO#main"
```

The backend's `prepare` script runs `pnpm build:types`, which emits the
type artifact Vercel reads at build time.

## Deploy (Vercel)

1. Update `vercel.json` `destination` with your Railway domain.
2. Switch the `@tradelab/backend` dependency to a github reference.
3. Push to GitHub and import the project in Vercel.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars.
5. Deploy.
