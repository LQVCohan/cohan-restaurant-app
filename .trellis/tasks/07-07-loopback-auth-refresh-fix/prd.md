# Fix local auth refresh across loopback hosts

## Current behavior and root cause

The manager page can be opened at `http://127.0.0.1:5173`, while `.env.development` and generated local `.env` point GraphQL to `http://localhost:4000/graphql`.

The backend issues a host-only HttpOnly refresh cookie with `SameSite=Lax` and path `/api/auth`. `127.0.0.1` and `localhost` are different sites, so the browser does not send that cookie from the page at `127.0.0.1` to the refresh endpoint at `localhost`. `/api/auth/refresh` then returns `401`, an expired access token cannot be renewed, and authenticated GraphQL queries such as `overtimeRequests` cannot load.

The repository already has a Vite proxy for `/graphql` and `/api`. The smallest shared fix is to use that same-origin proxy only when a local browser hostname and a configured local API hostname are both loopback hosts but do not match.

## Flow traced

`OvertimeRequest model -> overtimeRequest.service view and restaurant-scope guards -> staff overtimeRequests resolver -> useOvertimeManagement Apollo query -> OvertimePanel`.

Authentication precedes that flow:

`GraphQL request -> Apollo auth/error links -> refreshAccessTokenOnce -> getRefreshUrl/getGraphqlUrl -> /api/auth/refresh -> rotateRefreshToken`.

The overtime contract, role checks, restaurant scope, date filter, and UI action are correct. The failure is at the shared API URL boundary.

## Files changing

- `src/lib/apiBaseUrl.ts`: normalize mismatched `localhost`/`127.0.0.1` development API origins to same-origin `/graphql`.
- `src/lib/apiBaseUrl.test.ts`: add a regression test for a `127.0.0.1` page with a `localhost` API configuration.

## Acceptance criteria

- A page opened at `127.0.0.1` with `VITE_API_URL=http://localhost:4000/graphql` uses `/graphql` and `/api/auth/refresh` through the Vite proxy.
- Matching hosts and non-local production API URLs remain unchanged.
- Existing relative API URL behavior remains unchanged.
- No overtime schema, resolver, service, permission, filter, or UI behavior changes.

## Validation

- `npx vitest run src/lib/apiBaseUrl.test.ts`
- `npm run build`

## Out of scope

- Changing refresh-token security policy or production cookie settings.
- Changing overtime business logic.
- Hiding authentication failures or fabricating empty overtime data.
