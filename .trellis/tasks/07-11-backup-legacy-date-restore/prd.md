# Handle legacy date placeholders during config restore

## Current behavior and root cause

- The table schema stores `tableQrGeneratedAt`, `tableQrExpiresAt`, `mergedAt`, and `viewLock.expiresAt` as Mongoose `Date` fields.
- New configuration snapshots already serialize JavaScript `Date` values as ISO strings.
- Clone mode already removes source-only table runtime fields before writing to the target restaurant.
- Older snapshots created before that fix may contain `{}` where a Date existed.
- In `same_restaurant_restore`, `merge`, and `replace` modes, those legacy placeholders still reach `Table.findOneAndUpdate`, causing `Cast to date failed`, including the reported `tableQrExpiresAt` failure.

## End-to-end flow

1. `models/table.model.js` defines the affected Date fields.
2. `restaurantConfigBackup.service.js` decodes, previews, remaps floors, and writes table payloads.
3. `graphql/resolvers/backup/index.js` validates `backup.import`, decodes the file, and calls the service.
4. `backup.graphql` exposes `ImportRestaurantConfigBackupInput` and the import mutations.
5. `BackupManagement.jsx` sends the selected mode and displays the backend error.

## Files changing

- `cohan-restaurant-backend/src/services/restaurantConfigBackup.service.js`
  - normalize legacy empty-object table date placeholders before every table import mode;
  - preserve valid ISO date values;
  - keep clone runtime-field cleanup and status/view-lock behavior unchanged.
- `cohan-restaurant-backend/tests/services/restaurant-config-backup-date.service.test.js`
  - cover `same_restaurant_restore` with a legacy `{}` date placeholder;
  - verify valid ISO dates still reach Mongoose while invalid placeholders do not.

## Acceptance criteria

- A legacy snapshot containing `tableQrExpiresAt: {}` restores without a Mongoose date-cast error.
- Empty-object placeholders are not forwarded for `tableQrGeneratedAt`, `tableQrExpiresAt`, `mergedAt`, or `viewLock.expiresAt`.
- Valid ISO date strings remain unchanged.
- Clone mode still strips source QR, view-lock, and active merge runtime state, resets status to `available`, and clears the target `viewLock`.
- GraphQL contracts, permissions, conflict handling, audit logs, checksums, and frontend behavior remain unchanged.

## Validation plan

```bash
npm --prefix cohan-restaurant-backend test -- tests/services/restaurant-config-backup-date.service.test.js
npm --prefix cohan-restaurant-backend test -- tests/services/restaurant-config-backup.service.test.js
npm --prefix cohan-restaurant-backend test -- tests/resolvers/backup-config.resolver.test.js
```

## Out of scope

- Changing the snapshot schema version.
- Rewriting or migrating files on disk.
- Restoring operational QR sessions, table locks, or merge sessions across restaurants.
- Frontend redesign or GraphQL schema changes.
