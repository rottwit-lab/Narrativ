# Narrativ — Base44 Dev Environment

## Stack
- **Frontend**: Vite + React 19 + Tailwind CSS 4 (via `@tailwindcss/vite` plugin), served by an Express server (`server.ts`) running Vite in middleware mode.
- **Backend**: Express (`server.ts`, ~30KB monolith) — all API routes under `/api/*`, including Gemini TTS and AI scriptwriting endpoints. Runs via `tsx server.ts` on port 3000, bound to `0.0.0.0`.
- **No database** — the app uses browser `localStorage` (see `src/utils/storage.ts`) for persistence.

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
- Single `app` service (node:22-slim), source bind-mounted at `/app`, `node_modules` in a named volume (so host deps don't shadow container's).
- `npm install` runs at container start; deps are cached in the `node_modules` volume.
- `DISABLE_HMR=true` disables Vite HMR/file-watching (matches AI Studio behavior); backend changes need `docker compose -f docker-compose.base44.yml restart app`, then `reload_preview`.
- Health endpoint: `GET /api/health` (returns `hasGeminiKey`).
- Frontend changes are picked up on browser refresh; Vite compiles on demand in middleware mode.

## Secrets
- `GEMINI_API_KEY` (optional at boot): delivered via `/run/base44/app.env`, consumed by `server.ts` through `dotenv`. Without it, TTS endpoints return fallback acoustic previews (`isFallback: true`) and scriptwriting endpoints degrade gracefully. Placeholder lives in `.env.base44-defaults` (empty string) — real key overrides via env file precedence.
- `APP_URL`: placeholder in `.env.base44-defaults`; not critical for dev preview.

## Quirks
- `vite.config.ts` sets `server.host: true` and `allowedHosts: true` (required for the preview's external proxy hostname). Preserve these.
- `bun.lock` exists but the dev script uses `tsx`; the compose uses `npm install` — package.json is the source of truth for deps.
- The repo has an Electron entrypoint (`electron-main.cjs`) — irrelevant for the web preview; don't try to run it.
- No tests or linters beyond `npm run lint` (`tsc --noEmit`).

## Verification
```bash
curl -sf http://localhost:3000/api/health          # {"status":"ok",...}
curl -sf -H "Host: any.example.com" http://localhost:3000/ | grep main.tsx  # dev source served
```
