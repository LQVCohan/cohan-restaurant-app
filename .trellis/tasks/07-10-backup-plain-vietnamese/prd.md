# Plain Vietnamese for backup management

## Current behavior and root cause

The backup page exposes implementation language directly to managers. Visible examples include `snapshot`, `audit log`, `JSON`, permission codes such as `backup.read`, internal keys such as `restaurantProfile`, English conflict reasons, and wording such as `checklist`, `xung đột`, or `nhà hàng đích` that is harder than necessary.

The model, GraphQL schema, resolver, service, permission checks, restaurant scope, audit logging, and export/import payload are correct. The root cause is the client copy and fallback mapping in `BackupManagement.jsx`: several server labels/reasons/errors are rendered directly instead of passing through user-facing Vietnamese labels.

## End-to-end flow

1. `BackupRun` stores status, checklist, selected scope, note, restaurant and operator metadata.
2. `backup.graphql` exposes readiness, run history, export preview, import preview, conflict resolution and restore mutations.
3. `graphql/resolvers/backup/index.js` validates permissions and restaurant access, calls `restaurantConfigBackup.service.js`, and records audit entries.
4. `BackupManagement.jsx` maps those responses into page labels, messages, filters, actions and confirmation text.
5. `ManagerLayout.jsx` supplies the manager navigation title and page description.
6. `BackupManagement.test.jsx` covers scope, export/import, duplicate-data handling, action feedback and payloads.

## Direction

A calm manager-facing workflow using familiar Vietnamese: “việc cần kiểm tra”, “nội dung được lưu”, “dữ liệu bị trùng”, “nhà hàng nhận dữ liệu”, and direct action verbs. Internal identifiers remain in code and payloads but are never shown to users.

## Files to change

- `src/components/Dashboard_Manager/Backup/BackupManagement.jsx`
  - replace technical visible terms across headers, labels, helper text, permission states, buttons, result summaries and history;
  - map backend section labels, conflict reasons, warnings and errors to plain Vietnamese;
  - stop showing internal keys, checksum wording and raw English messages.
- `src/components/Dashboard_Manager/Backup/BackupManagement.test.jsx`
  - update assertions for the new wording;
  - cover a singleton conflict without a label and verify no internal key or English reason is displayed;
  - keep payload/permission/scope behavior tests unchanged.
- `src/layouts/ManagerLayout.jsx`
  - align the navigation title and description with the page wording.

## Acceptance criteria

- No visible `snapshot`, `audit log`, `JSON`, `backup.read`, `backup.write`, `backup.export`, `backup.import`, or internal section key appears on the backup page.
- The main workflow is understandable without technical knowledge.
- English server reasons and unknown technical errors are replaced with useful Vietnamese fallback messages.
- Section names come from the page's Vietnamese mapping rather than backend implementation labels.
- Existing GraphQL operations, variables, permissions, restaurant scoping, mutation payloads, file type and audit behavior remain unchanged.
- Existing export, preview, restore, duplicate-data resolution, save and cancel actions continue to work.

## Validation plan

- `npm run check:conflicts`
- targeted Vitest for `BackupManagement.test.jsx`
- frontend lint/build and smoke checks through GitHub Actions

## Out of scope

- Changing backend error contracts or database labels.
- Changing the JSON backup file format or extension.
- Changing permission codes, resolver behavior, audit log behavior or import strategies.
- Redesigning the page layout or adding a translation framework.
