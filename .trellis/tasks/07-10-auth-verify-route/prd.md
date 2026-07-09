# Fix account verification REST route

## Current behavior

Opening `/verify-email/confirm?token=...` and pressing the verification button posts to `/api/auth/verify-account`, but the running backend can answer `Route not found`.

## Root cause

The frontend flow is:

1. `VerifyAccountConfirm.jsx` reads `token` from the URL.
2. `verifyAccountByToken()` posts `token` and `channel` to `toApiUrl("/auth/verify-account")`, which resolves to `/api/auth/verify-account`.
3. Backend should call `verifyAnyTokenAndIssueAuth()` from `accountVerification.service.js`.
4. The route currently lives inside `src/server/plugins/upload.route.js`, even though it is an auth endpoint.
5. If that upload plugin route is unavailable/stale, Fastify falls through to the global not-found handler.

## Scope

- Register `POST /api/auth/verify-account` directly in `createServer.js` beside `/api/auth/refresh` and `/api/auth/logout`.
- Reuse `verifyAnyTokenAndIssueAuth()` unchanged.
- Remove the misplaced auth route and unused import from `upload.route.js`.
- Add a backend route smoke test so this endpoint cannot disappear silently.

## Acceptance criteria

- `POST /api/auth/verify-account` no longer returns Fastify `Route not found`.
- Missing/invalid token still returns a verification error payload, not a 404.
- Existing token verification service behavior remains unchanged.
- Upload, chatbot stream, refresh, and logout routes remain unchanged.

## Out of scope

- Changing token generation, token TTL, email template, or activation policy.
- Changing frontend verification page UI.
- Changing GraphQL verification mutations.

## Validation plan

- Run `node --check cohan-restaurant-backend/src/server/createServer.js`.
- Run `node --check cohan-restaurant-backend/src/server/plugins/upload.route.js`.
- Run `cd cohan-restaurant-backend && npm test -- tests/server/auth-cookie-endpoints.test.js`.
