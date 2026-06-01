# Single-Server Deployment Guide

This guide documents the current thesis/demo deployment target for Cohan Restaurant App: one frontend build and one backend process connected to MongoDB on a single server or single VM-style host. It intentionally avoids Redis or multi-instance coordination.

## Deployment scope

- Target deployment: exactly one backend server instance for the foreseeable thesis/demo period.
- Rate limiting: the backend's current in-memory rate limits are acceptable for this single-server model because all protected traffic reaches the same process.
- Not required now: Redis, a shared rate-limit store, or multi-instance session/rate-limit coordination.
- Future scaling note: if the project later runs multiple backend instances behind a load balancer, add Redis or another shared rate-limit store before relying on rate limits across instances.

## System requirements

- Node.js: use a modern Node.js LTS release compatible with Vite 6 and the backend ESM runtime. Node.js 20 LTS or newer is recommended for deployment.
- MongoDB: provide a reachable MongoDB database and a `MONGO_URI` for the backend.
- Package install:
  - Run `npm install` at the repository root for the frontend and shared tooling.
  - Run `npm install` in `cohan-restaurant-backend/` for backend dependencies.

```bash
npm install
npm install --prefix cohan-restaurant-backend
```

## Frontend environment

Create the frontend `.env` on the server or in the frontend hosting environment. Never commit real `.env` files.

Required demo/deployment keys:

```dotenv
VITE_API_URL=https://your-demo-domain.example.com/graphql
VITE_ENABLE_RECAPTCHA=true
VITE_RECAPTCHA_SITE_KEY=replace-with-public-recaptcha-site-key
```

Notes:

- `VITE_API_URL` must point to the deployed backend GraphQL endpoint.
- `VITE_ENABLE_RECAPTCHA` must match the intended backend captcha policy.
- `VITE_RECAPTCHA_SITE_KEY` is required when frontend captcha is enabled.

## Backend environment

Create `cohan-restaurant-backend/.env` directly on the server, through the process manager, or through your hosting secret manager. Never commit real backend secrets.

Required or important keys for the single-server demo deployment:

```dotenv
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=replace-with-strong-random-32-plus-character-secret
TABLE_ACCESS_TOKEN_SECRET=replace-with-different-strong-random-secret
CORS_ORIGINS=https://your-frontend-domain.example.com
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
GRAPHQL_MAX_DEPTH=12
GRAPHQL_MAX_FIELD_COUNT=500
ENABLE_RECAPTCHA=true
ENABLE_EMAIL_VERIFICATION=true
```

Key details:

- `MONGO_URI` must resolve from the deployed backend server and point to the intended demo database.
- `JWT_SECRET` and `TABLE_ACCESS_TOKEN_SECRET` must be strong, random, and different from each other.
- `CORS_ORIGINS` should contain the exact frontend origin(s), not a broad wildcard.
- `ACCESS_TOKEN_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_IN` control access-token and refresh-session duration.
- `GRAPHQL_MAX_DEPTH` and `GRAPHQL_MAX_FIELD_COUNT` should stay at safe defaults unless a tested frontend operation requires adjustment.
- `ENABLE_RECAPTCHA` must align with the frontend captcha setting.
- `ENABLE_EMAIL_VERIFICATION` can be enabled for production-like account activation or disabled for a controlled demo flow.

## Local demo configuration

For a local or classroom demo, external services can be simplified as long as the settings are explicit and consistent.

### Captcha

Captcha may be disabled in development/demo when the demo does not depend on the external reCAPTCHA service:

```dotenv
# frontend .env
VITE_ENABLE_RECAPTCHA=false
VITE_RECAPTCHA_SITE_KEY=

# backend .env
ENABLE_RECAPTCHA=false
```

If captcha is enabled, configure both sides together:

```dotenv
# frontend .env
VITE_ENABLE_RECAPTCHA=true
VITE_RECAPTCHA_SITE_KEY=<valid-site-key>

# backend .env
ENABLE_RECAPTCHA=true
RECAPTCHA_SECRET=<valid-secret>
```

### Email verification

Email verification can be configured or disabled depending on demo needs:

- Enable it when the demo includes registration, verification emails, and SMTP delivery.
- Disable it for a controlled local demo when SMTP is not available and pre-seeded accounts are used.

```dotenv
ENABLE_EMAIL_VERIFICATION=false
```

## Build and start commands

Frontend development/demo server:

```bash
npm run dev
```

Frontend production build:

```bash
npm run build
```

Backend development/demo server:

```bash
npm run dev --prefix cohan-restaurant-backend
```

Backend deployed server:

```bash
NODE_ENV=production npm run start --prefix cohan-restaurant-backend
```

## Production/demo warnings

- Never commit real `.env` files or real secrets.
- Use strong, random `JWT_SECRET` and `TABLE_ACCESS_TOKEN_SECRET` values; keep them different.
- Keep `NODE_ENV=production` for the deployed backend.
- Configure `CORS_ORIGINS` exactly to the frontend origin(s) used in the demo.
- Do not add Redis for the current thesis single-server deployment; add Redis/shared rate-limit storage only if the backend is scaled to multiple instances.
