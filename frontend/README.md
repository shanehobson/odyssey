# Odyssey frontend

React 19 + Vite single-page app for [Odyssey](../README.md). Feature-sliced layout under `src/features/` (auth, trips, billing, profile), shared UI under `src/shared/`, maps under `src/maps/`.

```bash
cp .env.example .env
npm ci
npm run dev        # port 3001; /api and /auth proxied to DEV_PROXY_TARGET
npm test           # vitest + Testing Library
npm run typecheck
npm run e2e        # Playwright (needs .env.e2e)
```

`CLAUDE.md` holds the engineering conventions (strict TypeScript, a test per component, feature modules) and `DESIGN-SYSTEM.md` the Tailwind v4 token setup.

Background photos in `src/assets/images/` are part of the app's look; see the root README for licensing.
