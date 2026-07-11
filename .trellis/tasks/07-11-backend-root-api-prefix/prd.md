# Table 3D development proxy fix

## Current behavior

The AI table screen submits five images through `toBackendRootUrl("/table-3d-ai/generate")`. In mobile/ngrok development the correct root-relative URL was not included in the Vite proxy table, so Vite returned HTTP 404. A previous attempt changed the URL to `/api/table-3d-ai/generate`, which reached Fastify but returned `Route not found` because that route does not exist.

## End-to-end trace

1. `CustomTableModelBuilderModal` calls `toBackendRootUrl("/table-3d-ai/generate")`.
2. Mobile development uses `VITE_API_URL=/graphql` and sends same-origin requests through Vite/ngrok.
3. `vite.config.js` proxies `/graphql`, `/api`, `/auth`, `/ai`, `/upload` and `/uploads`, but not `/table-3d-ai` or `/table-3d-assets`.
4. `createServer` registers `uploadRoutes` with `{ prefix: "/api" }`.
5. `upload.route.js` is wrapped by `fastify-plugin`; its backend tests register it with the same prefix but successfully call root paths such as `/upload/sign`.
6. Therefore the real generation route is `/table-3d-ai/generate`, and Vite must proxy that root prefix to the backend.

## Root cause

The backend-root URL helper was correct before the previous change. The actual missing boundary was the development proxy configuration: the table 3D route prefixes were absent. Adding `/api` created a second bug by targeting a non-existent Fastify route.

## Scope

- Restore `getBackendRootUrl` and `toBackendRootUrl` to backend-root URL behavior.
- Add Vite proxy entries for `/table-3d-ai` and `/table-3d-assets`.
- Update focused URL helper tests for root-relative and absolute backend configurations.
- Add one focused Vite config test that locks the two proxy entries.
- Preserve static `/uploads/*` handling and all existing backend route contracts.

## Acceptance criteria

- `toBackendRootUrl("/table-3d-ai/generate")` resolves to `/table-3d-ai/generate` for same-origin mobile development.
- Absolute GraphQL backends resolve the route against their origin without an `/api` prefix.
- Vite proxies `/table-3d-ai` and `/table-3d-assets` to `devBackendUrl`.
- Upload, account verification and chatbot callers retain their existing root paths.
- Static `/uploads/*` asset URLs remain outside `/api`.
- No backend, Hi3D, authentication or multipart request contract changes.

## Out of scope

- Adding duplicate `/api/table-3d-*` backend aliases.
- Changing Hi3D credentials, task submission or polling.
- Reworking production reverse-proxy infrastructure.

## Validation plan

```bash
npx vitest run src/lib/apiBaseUrl.test.js src/lib/apiBaseUrl.test.ts vite.config.test.js
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run build
```

A manual retry through the ngrok mobile URL is still required after restarting Vite so the updated proxy table is loaded.
