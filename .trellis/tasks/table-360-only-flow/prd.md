# Table 360-only visual flow

## Current behavior

The manager table screen exposes two separate visual concepts for every table:

1. `vrUrl` / uploaded panorama used by the 360 viewer.
2. `visualConfig` used by the table 3D catalog, camera preview and AR placement flow.

`TableManagement` can open the 3D simulator from the page header or from an individual table card. Applying a model pre-fills the add-table form and persists `visualConfig`. The AR placement callback can also update the table's floor-map `position`. Existing visual configuration is then surfaced again in the table-detail modal and in the customer floor-map preview.

The add-table modal therefore contains 3D-derived preview cards that are not part of the core create-table decision and make the form feel heavier than necessary.

## Requested product behavior

- Creating a table only asks for its operational data: code, capacity, floor and area.
- A table has one customer-facing visual feature: photos / a 360 panorama of the surroundings.
- The product no longer exposes per-table model selection, camera model placement, WebXR/AR placement, calibration, real-world marker selection or saving AR-derived coordinates into the floor plan.
- Floor-map coordinates remain supported for the manual floor designer and normal move-table behavior.

## End-to-end flow checked

1. `Table` Mongoose schema stores `position`, `vrUrl`, `photos` and the legacy `visualConfig` field.
2. `floor_table.graphql` exposes the same fields; the table resolver sanitizes `visualConfig` and accepts regular `position` updates.
3. `useTableManagement` queries `visualConfig` and provides create/update/move mutations.
4. `useFloorManagement` also queries `visualConfig` for manager/customer floor maps.
5. `TableManagement` attaches 3D configuration, opens per-table AR, persists AR-derived position and renders 3D controls.
6. `TableActionsLiteModal` renders saved 3D configuration and camera preview controls, while also managing the supported 360 image/link.
7. `FloorMap` offers customers both 360 and 3D preview links.

## Root cause

The legacy 3D/AR feature is not isolated behind one entry point. Its callers are spread across the manager list, create form, detail modal, shared table queries and customer floor-map preview. Hiding a single button would leave the same feature reachable and keep unnecessary data in the client contract.

The smallest complete fix is to remove all reachable frontend callers and stop querying `visualConfig` in the shared hooks. The backend field is retained only for backward compatibility and to avoid a destructive migration; no current UI will create, update or display it.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
  - remove 3D simulator imports/state/handlers/rendering;
  - remove 3D badges and AR actions;
  - replace the visual action with 360 viewing/setup;
  - simplify and upgrade the add-table modal;
  - create tables without `visualConfig`.
- `src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx`
  - remove camera/3D preview imports, state and controls;
  - keep the existing 360 image/link workflow.
- `src/components/Customer/TableBooking/components/FloorMap/FloorMap.jsx`
  - preview only photos and 360 content.
- `src/hooks/useTableManagement.js`
  - remove `visualConfig` from the manager table fragment.
- `src/hooks/useFloorManagement.js`
  - remove `visualConfig` from manager/public floor-map queries.
- `src/components/Dashboard_Manager/Table/TableManagementPolish.scss`
  - apply the final add-table modal layout and responsive treatment using existing styles.
- Direct tests for the changed screens.

## Acceptance criteria

- The manager page has no `Mô phỏng 3D`, `3D / AR`, AR placement or 3D badge entry point.
- Adding a table never reads or submits `visualTemplate` / `visualConfig`.
- The add-table modal is focused, readable and responsive at desktop, 430×932 and 390×844.
- A table card shows `Xem 360°` when configured and `Thêm ảnh 360°` when not configured.
- The detail modal still supports link/upload, preview, removal and persistence of 360 content.
- Customer floor-map preview shows photos and a 360 link only; legacy model data is ignored.
- Manual floor designer positions, move-table behavior, permissions, audit logging and existing booking behavior remain unchanged.
- No new dependency is added.

## Out of scope

- Dropping `visualConfig` from MongoDB/GraphQL or migrating historic records.
- Removing the independent 3D source files and tests that are no longer reachable from the product UI.
- Replacing local panorama storage with cloud/object storage.
- Changing the floor-plan designer or its manually managed coordinates.

## Validation plan

- Run the focused Vitest files for `TableManagement`, `TableActionsLiteModal` and `FloorMap`.
- Run `npm run check:graphql` and `npm run build` when a runnable checkout is available.
- Manually verify desktop, 430×932 and 390×844; real panorama interaction should also be checked on a phone.