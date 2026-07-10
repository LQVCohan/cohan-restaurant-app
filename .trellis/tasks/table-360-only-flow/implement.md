# Implementation plan — table 360-only flow

1. Update shared GraphQL client fragments to stop requesting `visualConfig`.
2. Simplify `TableManagement` state and handlers:
   - remove model mapping, simulator state, AR save and template-apply handlers;
   - remove 3D header/card actions and badges;
   - add a single 360 card action;
   - remove 3D fields from table form, draft sanitization and create payload.
3. Refine the add-table modal markup and its existing SCSS layer.
4. Remove legacy model/camera branches from `TableActionsLiteModal` while preserving 360 upload/link/save behavior.
5. Restrict customer `FloorMap` previews to photos and 360 links.
6. Update direct component tests for the new contract.
7. Review the diff for remaining reachable strings/callers: `3D / AR`, `Mô phỏng 3D`, `onSaveArPosition`, `visualTemplate`, `visualConfig` in active table UI.
8. Run focused tests, GraphQL checks and build when execution is available.