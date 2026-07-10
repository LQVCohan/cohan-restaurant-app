# Backup run action feedback

## Current behavior and root cause

- The three checklist actions work, but their labels are ambiguous: `Tạo lần chuẩn bị`, `Lưu`, and `Hủy lần này` do not clearly describe what record is created or changed.
- Success/error feedback is rendered near the page header. When the user operates the checklist lower on the page, the result can be outside the viewport.
- Save and cancel share the same `updateBackupRun` completion message, so cancelling can be reported as “Đã lưu checklist an toàn”.
- Cancel runs immediately without explaining that it only marks the current preparation run as cancelled and does not delete restaurant configuration or backup files.

## End-to-end flow

1. `BackupRun` stores checklist, scope, note, status, restaurant, and operator metadata.
2. `createBackupRun` and `updateBackupRun` resolvers validate `backup.write`, restaurant ownership, status, and audit-log the change.
3. `BackupManagement.jsx` calls the existing GraphQL mutations from the three checklist controls.
4. Mutation completion updates the selected run, refetches readiness/history, and currently writes one page-level notice.
5. Component tests mock the Apollo mutations and verify the submitted payload.

## Visual direction

Compact contextual action group: explicit Vietnamese verbs, one-line explanation of each action, local live feedback directly below the controls, and native confirmation for the destructive cancel action.

## Files to change

- `src/components/Dashboard_Manager/Backup/BackupManagement.jsx`
  - rename the three actions to describe their result;
  - distinguish create/save/cancel completion messages;
  - render run feedback beside the controls instead of only at the page top;
  - ask for confirmation before cancelling and explain that configuration is not deleted.
- `src/components/Dashboard_Manager/Backup/BackupManagement.scss`
  - prevent action labels from collapsing or disappearing;
  - style the compact helper and local success/error feedback.
- `src/components/Dashboard_Manager/Backup/BackupManagement.test.jsx`
  - cover clear labels, contextual feedback, and cancel confirmation.

## Acceptance criteria

- The three controls read: start a new checklist run, save the current checklist, and cancel the current run.
- A concise helper explains the difference between the actions without requiring hover.
- Create, save, and cancel each show a distinct message beside the controls.
- Cancelling requires confirmation and clearly states it does not delete restaurant configuration or downloaded files.
- Existing GraphQL inputs, permission checks, restaurant scoping, audit logs, and refetch behavior remain unchanged.
- Action labels remain visible when the group wraps on narrow widths.

## Validation plan

- `npm run check:conflicts`
- targeted Vitest for `BackupManagement.test.jsx`
- frontend build through CI

## Out of scope

- Changing `BackupRun` schema or status semantics.
- Adding a new global toast framework.
- Changing export/import or snapshot behavior.
