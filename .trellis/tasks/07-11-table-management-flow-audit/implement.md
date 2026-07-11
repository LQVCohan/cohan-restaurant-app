# Implementation result

## Runtime files

1. `cohan-restaurant-backend/graphql/resolvers/table/integrityMutations.js`
   - owns the active integrity-safe `createTable` and `swapTableCodes` implementations;
   - scopes the selected floor to the restaurant before table creation;
   - normalizes and checks table codes consistently;
   - runs all three swap writes in one Mongoose transaction;
   - rejects self-swap and concurrent write conflicts;
   - clears stale QR credentials and writes corrected audit metadata.
2. `cohan-restaurant-backend/graphql/resolvers/table/index.js`
   - composes the integrity mutations after the base mutation map, following the existing dedicated-resolver override pattern used by merge and move flows.
3. `cohan-restaurant-backend/graphql/resolvers/table/query.js`
   - escapes user search text before constructing a regular expression;
   - clamps manager/public list limits to 1–500.
4. `src/hooks/useTableManagement.js`
   - removes incomplete update and move optimistic responses;
   - preserves authoritative cache updates from server mutation results;
   - keeps the 360-only legacy visual-field guard unchanged.

## Test files

1. `cohan-restaurant-backend/tests/resolvers/table-management-core-audit.test.js`
   - covers cross-restaurant floor rejection, successful scoped creation, self-swap rejection, transactional swap, write-conflict failure, literal search and limit clamping.
2. `src/hooks/useTableManagement.test.jsx`
   - verifies update/move no longer register optimistic responses while retaining cache handlers, merge/split behavior and restaurant-scoped realtime refresh.

## Audited unchanged flows

- composite merge/split/delete in `mergeTables.js`;
- cross-floor move guard in `moveTable.js`;
- active order/reservation guards for status and delete;
- manager and POS callers;
- floor designer/manual coordinates;
- table-customer realtime refresh;
- QR/public table access;
- photos and 360° panorama flow.

## Validation record

- Parsed the changed runtime JavaScript with `node --check`: `integrityMutations.js`, `query.js`, `index.js` and `useTableManagement.js`.
- Executed a focused local check proving regex punctuation is escaped and matched literally.
- Reviewed the repository compare from `bc5ce41a4f9774e556999b7a7425288dc8a10452` through the implementation commits; only the task, table resolver/query/hook and focused tests changed.
- GitHub reported no workflow runs or commit statuses for the implementation head.
- Could not run Vitest, GraphQL validation, backend integration tests or the Vite build because the GitHub connector does not provide a runnable repository checkout and the container could not resolve `github.com`.

## Review checklist

- No GraphQL schema change.
- No 3D/AR flow restored.
- No new dependency.
- No duplicated UI guard added.
- Restaurant scope, permission, audit and Apollo cache contracts remain aligned.
