# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run locally
node index.js

# Install dependencies
npm install

# Deploy to Fly.io (production)
fly deploy
```

No build step, no tests, no linter. The entire service is a single file (`index.js`).

## Architecture

A minimal Node.js HTTP server (no framework) deployed on Fly.io as `wilowilo-api`. It serves as a thin backend for the **wilowilo-pwa** app.

### Environment variables required

| Variable | Purpose |
|---|---|
| `FIREBASE_API_KEY` | Verifies Firebase ID tokens via Google REST API |
| `ANTHROPIC_API_KEY` | Calls Claude Haiku for AI features |
| `WILO_FOODS_API_URL` | Base URL for wilo-foods-api (default: Railway URL) |
| `WILO_FOODS_API_KEY` | API key for wilo-foods-api |

### Endpoints

**GET (no auth required)**
- `GET /food/search?q=<query>` — proxies food search to wilo-foods-api, returns OFFProduct-shaped JSON
- `GET /food/search/extended?q=<query>` — extended search variant
- `GET /food/barcode/<barcode>` — barcode lookup via wilo-foods-api

**POST (Firebase ID token required in `Authorization: Bearer <token>`)**
- `POST /` with `{ food: string }` — AI macro breakdown of a described meal → `{ items: [{name, kcal, protein, carbs, fat, satfat, fiber, ultra}] }`
- `POST /` with `{ type: "suggest", remaining: {kcal, protein, carbs, fat} }` — AI meal suggestions for remaining macros → `{ suggestions: [{name, description, kcal, protein, carbs, fat}] }`
- `POST /` with `{ type: "plan", kcal, protein, carbs, fat, notes? }` — AI meal plan for given targets → same `suggestions` shape

### Key implementation details

- **Auth**: Firebase tokens are verified by calling `identitytoolkit.googleapis.com/v1/accounts:lookup` (no Firebase Admin SDK). GET routes skip auth entirely.
- **Rate limiting**: In-memory, per Firebase UID, 30 requests/hour. Resets after 1-hour window. Not persistent across restarts.
- **Food data shape**: `wfaToOff()` maps wilo-foods-api food records to the `OFFProduct` shape expected by `wilowilo-pwa`'s `foodDatabaseService.ts`. The `unique_scans_n` field is faked to influence sort order (verified foods rank highest).
- **Cache**: wilo-foods-api responses cached in-memory for 5 minutes.
- **CORS**: Hardcoded allowlist — add new origins to `ALLOWED_ORIGINS` array.
- **AI model**: `claude-haiku-4-5-20251001`, max 800 tokens. All three AI prompts return JSON only (no markdown).

### Deployment

Fly.io app `wilowilo-api`, region `fra`, 256MB shared VM. Auto-start/stop enabled (cold starts possible). Deploy with `fly deploy` from the repo root.
