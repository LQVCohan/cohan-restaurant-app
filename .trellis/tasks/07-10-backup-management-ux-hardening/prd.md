# Backup management UX and scope hardening

## Current behavior and root cause

- `BackupRun` is persisted in MongoDB and the existing config snapshot service builds real data from restaurant, floor/table, menu, inventory, promotion, settings, and chatbot collections.
- Backend resolvers already enforce restaurant access plus `backup.read`, `backup.write`, `backup.export`, or `backup.import`, and preserve checksum validation and audit logs.
- `BackupManagement` selects `AuthContext.restaurants[0]` independently from the canonical manager scope, so the global branch selector and backup queries can point at different restaurants.
- Apollo data and selected run state are not guarded against a restaurant change, so the screen can temporarily show readiness/history from the previous branch.
- A valid import preview remains accepted after changing target restaurant, mode, or selected sections. The later import payload may therefore differ from what the user reviewed.
- The screen repeats a management header, oversized hero, KPI cards, and process cards before the actual work area, making the page long and visually noisy.
- UI actions do not clearly reflect granular backup permissions and allow zero selected sections to reach backend validation.

## End-to-end flow

1. `models/backup-run.model.js` stores readiness checklist, scope, status, operator, and timestamps.
2. `restaurantConfigBackup.service.js` builds sanitized snapshots, calculates/verifies checksums, previews conflicts, and applies selected sections.
3. `graphql/resolvers/backup/index.js` checks permissions and restaurant scope, reads/writes `BackupRun`, invokes the service, and records audit logs.
4. `backup.graphql` exposes readiness, run history, preview/export, preview import, and import operations.
5. `useManagerRestaurantSelection.js` owns the canonical manager brand/restaurant scope used by the global header.
6. `BackupManagement.jsx` manages checklist state, section selection, file reading, preview confirmation, conflict decisions, export download, and restore actions.

## Visual direction

Compact operational dashboard using the existing sage and warm-neutral manager palette, one concise header, a shared readiness strip, and two clearly separated backup/restore workflows. Secondary history and risk detail remain available without pushing primary actions below the fold.

## Files to change

- `src/components/Dashboard_Manager/Backup/BackupManagement.jsx`
  - consume the canonical restaurant scope;
  - ignore stale readiness/history;
  - reset target/preview state safely when scope or restore inputs change;
  - add permission-aware and section/file validation states;
  - remove duplicated decorative content while preserving every operation.
- `src/components/Dashboard_Manager/Backup/BackupManagement.scss`
  - compact the current visual hierarchy;
  - reduce redundant cards/borders and oversized spacing;
  - preserve focus, touch targets, responsive behavior, and reduced motion.
- `src/components/Dashboard_Manager/Backup/BackupManagement.test.jsx`
  - cover canonical scope variables;
  - cover stale scope protection and preview invalidation;
  - keep existing export/import/conflict regression coverage.

## Acceptance criteria

- The backup page always follows the manager restaurant selected in the global header.
- Switching restaurant cannot expose readiness, history, or a selected run from the previous restaurant.
- Changing file, target restaurant, import mode, or import sections after preview requires a new preview and confirmation before import.
- Actions are disabled with clear guidance when the account lacks the required granular permission.
- Export/import cannot run with zero selected sections; invalid or oversized files receive inline feedback.
- Existing snapshot checksum, sensitive-field filtering, conflict resolution, audit logging, and backend authorization semantics remain unchanged.
- The page is compact and readable at 375, 390, 430, 768, 1024, and 1440 px without horizontal overflow.

## Validation plan

- `npm run check:conflicts`
- `npm run check:graphql`
- `vitest run src/components/Dashboard_Manager/Backup/BackupManagement.test.jsx`
- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/backup-config.resolver.test.js tests/services/restaurant-config-backup.service.test.js`
- `npm run build`

## Out of scope

- Full database backups or runtime order/payment history exports.
- Changing snapshot schema version or supported configuration sections.
- Rewriting the import service into a new transaction framework.
- Adding cloud storage, scheduling, encryption-at-rest, or new dependencies.
