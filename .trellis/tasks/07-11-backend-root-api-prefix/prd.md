# Backend REST API prefix fix

## Current behavior

The AI table screen submits five images through `toBackendRootUrl("/table-3d-ai/generate")`. With the mobile/ngrok development setup, the helper returns `/table-3d-ai/generate`, so Vite serves a 404 instead of forwarding the request to Fastify.

## End-to-end trace

1. `CustomTableModelBuilderModal` calls `toBackendRootUrl("/table-3d-ai/generate")`.
2. `getBackendRootUrl` removes or omits the `/api` segment.
3. Mobile development uses `VITE_API_URL=/graphql` and a same-origin Vite proxy.
4. Fastify registers `upload.route.js` using `{ prefix: "/api" }`.
5. The actual route is `/api/table-3d-ai/generate`; the generated `/table-3d-ai/generate` URL never reaches the route.
6. The same shared helper is used by model upload, avatar upload, account verification and chatbot streaming routes from the same plugin.

## Root cause

The frontend helper contract drifted from the backend route registration. It treats non-GraphQL routes in `upload.route.js` as backend-root routes, while the backend mounts every route in that plugin below `/api`.

## Scope

- Make `getBackendRootUrl` and `toBackendRootUrl` resolve to the mounted `/api` base.
- Update the focused helper regression test to assert the real route contract.
- Preserve upload asset URL normalization, which still exposes static files under `/uploads` rather than `/api/uploads`.

## Acceptance criteria

- `toBackendRootUrl("/table-3d-ai/generate")` resolves to `/api/table-3d-ai/generate` for same-origin mobile development.
- Absolute GraphQL backends resolve the same route against their origin with `/api`.
- Upload, verification and chatbot callers using the helper receive the corrected prefix.
- Static `/uploads/*` asset URLs remain outside `/api`.
- No backend, Hi3D, authentication or multipart request contract changes.

## Out of scope

- Changing Hi3D credentials or provider behavior.
- Adding duplicate backend root aliases without `/api`.
- Reworking Vite proxy entries that already proxy `/api`.

## Validation plan

```bash
npx vitest run src/lib/apiBaseUrl.test.js src/lib/apiBaseUrl.test.ts
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run build
```
