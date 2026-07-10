# Enforce backup checklist before config export

## Current behavior and root cause

The manager page stores a `BackupRun` checklist through `createBackupRun` and `updateBackupRun`, but `exportRestaurantConfigBackup` only checks `backup.export` and restaurant access. The export resolver never reads the checklist, so users can download a configuration file whether the checklist is complete or not.

The same input also lets clients mark `exportPrepared`, `operatorRecorded`, and `safeCopyStored` manually before any file is created, so the recorded readiness can be inaccurate.

## Flow traced

`BackupRun model -> backup GraphQL schema -> backup resolver -> Apollo export mutation -> BackupManagement download action -> resolver/component tests`.

No schema change is required because the resolver can use the latest active `BackupRun` for the selected restaurant.

## Files changed

- `cohan-restaurant-backend/graphql/resolvers/backup/index.js`
  - accept only user-controlled checklist fields;
  - require the latest `planned` run and the three pre-export checks before export;
  - mark file creation and operator recording automatically after a successful export;
  - allow safe-copy confirmation only after a file has been created.
- `cohan-restaurant-backend/tests/resolvers/backup-config.resolver.test.js`
  - cover missing/incomplete checklist rejection;
  - cover automatic post-export checklist updates;
  - cover prevention of client-spoofed automatic fields.

## Acceptance criteria

- Export is rejected when there is no active preparation run.
- Export is rejected until reports, payment reconciliation, and important settings are checked and saved.
- A successful export automatically marks `exportPrepared` and `operatorRecorded` on that run.
- `safeCopyStored` cannot be recorded before a successful export.
- The existing export payload, file format, restaurant scoping, permissions, and audit logging remain unchanged.
- Existing import and restore behavior remains unchanged.

## Validation

- `cd cohan-restaurant-backend && npx vitest run tests/resolvers/backup-config.resolver.test.js`
- `cd cohan-restaurant-backend && npm run lint`
- `cd cohan-restaurant-backend && npm run build`

## Out of scope

- Redesigning the manager backup page.
- Changing the GraphQL schema or adding a new export argument.
- Changing snapshot contents or restore conflict handling.
