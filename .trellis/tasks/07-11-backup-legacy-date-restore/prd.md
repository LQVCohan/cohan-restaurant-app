# Handle legacy date placeholders during config restore

## Current behavior and root cause

- The table schema stores `tableQrGeneratedAt`, `tableQrExpiresAt`, `mergedAt`, and `viewLock.expiresAt` as Mongoose `Date` fields.
- New configuration snapshots already serialize JavaScript `Date` values as ISO strings.
- Clone mode already removes source-only table runtime fields before writing to the target restaurant.
- Older snapshots created before that fix may contain `{}` where a Date existed.
- In `same_restaurant_restore`, `merge`, and `replace` modes, those legacy placeholders reached the Table model and caused `Cast to date failed`, including the reported `tableQrExpiresAt` failure.

## End-to-end flow

1. `models/table.model.js` defines and casts the affected Date fields.
2. `restaurantConfigBackup.service.js` decodes, previews, remaps floors, and writes table payloads.
3. `graphql/resolvers/backup/index.js` validates `backup.import`, decodes the file, and calls the service.
4. `backup.graphql` exposes `ImportRestaurantConfigBackupInput` and the import mutations.
5. `BackupManagement.jsx` sends the selected mode and displays the backend error.

## Files changed

- `cohan-restaurant-backend/models/table.model.js`
  - normalize only legacy empty-object date placeholders to `null` before Mongoose casts them;
  - apply the shared compatibility setter to QR generation/expiry, merge time, and view-lock expiry;
  - preserve valid Date objects and ISO date strings.
- `cohan-restaurant-backend/tests/models/table-legacy-date.model.test.js`
  - cover all four legacy `{}` fields without requiring a database connection;
  - verify valid ISO dates still cast to JavaScript `Date` values.

## Acceptance criteria

- A legacy snapshot containing `tableQrExpiresAt: {}` reaches the Table model without a Mongoose date-cast error.
- Empty-object placeholders become nullable values for `tableQrGeneratedAt`, `tableQrExpiresAt`, `mergedAt`, and `viewLock.expiresAt`.
- Valid ISO date strings continue to cast normally.
- Clone mode remains unchanged and still strips source QR, view-lock, and active merge runtime state, resets status to `available`, and clears the target `viewLock`.
- GraphQL contracts, permissions, conflict handling, audit logs, checksums, and frontend behavior remain unchanged.

## Validation

Focused regression coverage was added at `cohan-restaurant-backend/tests/models/table-legacy-date.model.test.js`.

Planned command:

```bash
npm --prefix cohan-restaurant-backend test -- tests/models/table-legacy-date.model.test.js
```

The command was not run because the GitHub connector provides no repository checkout or installed dependencies, and the direct `main` commit did not create a GitHub Actions workflow run.

## Out of scope

- Changing the snapshot schema version.
- Rewriting or migrating files on disk.
- Restoring operational QR sessions, table locks, or merge sessions across restaurants.
- Frontend redesign or GraphQL schema changes.
