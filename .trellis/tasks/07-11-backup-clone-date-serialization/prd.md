# Fix restaurant config clone date serialization

## Current behavior and root cause

- The manager backup page reads a JSON snapshot as base64 and sends it through `ImportRestaurantConfigBackupInput` without changing document fields.
- `graphql/resolvers/backup/index.js` validates access, decodes the snapshot, and delegates preview/import to `restaurantConfigBackup.service.js`.
- `buildRestaurantConfigSnapshot()` sanitizes Mongoose lean documents recursively. Because `sanitizeDocument()` treats every object as a plain object, JavaScript `Date` instances have no enumerable properties and are exported as `{}`.
- Table fields such as `tableQrGeneratedAt`, `tableQrExpiresAt`, `mergedAt`, and `viewLock.expiresAt` can therefore become `{}`. Mongoose then throws `Cast to date failed` while applying the snapshot.
- In clone mode, table QR metadata, view locks, and active merge relationships belong to the source restaurant's runtime state and must not be copied to the target restaurant.

## End-to-end flow

1. `models/table.model.js` defines table QR, lock, merge, and date fields.
2. `restaurantConfigBackup.service.js` reads Mongoose documents, sanitizes them, builds/checksums the snapshot, previews conflicts, remaps floor IDs, and upserts target tables.
3. `graphql/resolvers/backup/index.js` enforces `backup.import` and restaurant access before calling the service.
4. `backup.graphql` exposes `previewRestaurantConfigImport` and `importRestaurantConfigBackup`.
5. `BackupManagement.jsx` reads the selected JSON file, sends base64 content, and displays the backend result.

## Files to change

- `cohan-restaurant-backend/src/services/restaurantConfigBackup.service.js`
  - serialize `Date` values as ISO strings at the shared snapshot boundary;
  - remove source-only table QR, view-lock, and active merge runtime fields before clone upserts;
  - preserve existing target runtime state when a clone conflict is merged.
- `cohan-restaurant-backend/tests/services/restaurant-config-backup-date.service.test.js`
  - cover ISO date serialization;
  - cover cloning an older snapshot containing `{}` runtime date placeholders without forwarding them to Mongoose.

## Acceptance criteria

- A newly exported configuration snapshot stores date fields as valid ISO strings rather than `{}`.
- Copying floor/table configuration to another restaurant does not copy source QR URLs/images/timestamps, view locks, or active merged-table references.
- An older snapshot whose table runtime dates are `{}` can still be cloned because those runtime fields are removed before the table write.
- Floor remapping, table status reset, conflict handling, checksums, permissions, audit logging, GraphQL operations, and UI behavior remain unchanged.

## Validation plan

- `npm --prefix cohan-restaurant-backend test -- tests/services/restaurant-config-backup-date.service.test.js tests/services/restaurant-config-backup.service.test.js`
- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/backup-config.resolver.test.js`
- `npm run check:graphql`

## Out of scope

- Changing the snapshot schema version.
- Copying live table sessions, QR access tokens, view locks, or active table-merge state between restaurants.
- Redesigning the backup page or changing GraphQL inputs/outputs.
- Adding dependencies or a new serialization framework.
