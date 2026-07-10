# Table 360-only visual flow

## Current behavior before the change

The manager table screen exposed two separate visual concepts for every table:

1. `vrUrl` / uploaded panorama used by the 360 viewer.
2. `visualConfig` used by the table 3D catalog, camera preview and AR placement flow.

`TableManagement` could open the 3D simulator from the page header or from an individual table card. Applying a model pre-filled the add-table form and persisted `visualConfig`. The AR placement callback could also update the table's floor-map `position`.

## Requested product behavior

- Creating a table asks only for code, capacity, floor and area.
- A table has one customer-facing visual feature: photos / a 360 panorama of the surroundings.
- The product no longer exposes model selection, camera model placement, WebXR/AR placement, calibration, real-world marker selection or saving AR-derived coordinates.
- Floor-map coordinates remain supported for the manual floor designer and normal move-table behavior.

## End-to-end flow checked

1. The `Table` Mongoose schema stores operational `position`, `vrUrl`, `photos` and the legacy `visualConfig` field.
2. `floor_table.graphql` accepts regular position updates and still exposes the legacy field for backward compatibility.
3. `useTableManagement` owned table create/update/move mutations and previously queried `visualConfig`.
4. `useFloorManagement` provided manager/customer floor-map data and previously queried `visualConfig`.
5. `TableManagement` owned all reachable model selection, AR placement and AR-derived coordinate persistence entry points.
6. `TableActionsLiteModal` already owns the supported 360 link/upload/preview workflow.
7. Customer `FloorMap` consumes the public table fragment from `useFloorManagement`.

## Root cause

The 3D/AR feature was spread across the manager screen, create form and shared client data contract. Hiding one button would leave model metadata and the AR update signature available elsewhere.

The root-cause fix removes the feature from the owning manager component, removes model metadata from shared queries and rejects legacy `visualConfig` mutation fields at the shared table hook boundary. The backend field remains only to avoid a destructive migration of historic records.

## Implemented files

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
  - removed simulator import/state/handlers/rendering;
  - removed the header 3D action, per-table 3D badge and `3D / AR` action;
  - replaced them with `Xem 360°` / `Thêm ảnh 360°`;
  - creates tables without model metadata;
  - upgraded the add-table modal to a focused operational form.
- `src/components/Dashboard_Manager/Table/TableAddModal360.css`
  - final desktop/mobile modal styling and 360 action states.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModal.jsx`
  - compatibility kill switch returning `null`, preventing stale callers from reopening WebXR/AR.
- `src/hooks/useTableManagement.js`
  - removed `visualConfig` from the active table fragment;
  - strips legacy model fields from create/update payloads;
  - drops a paired position when a legacy AR-style update contains `visualConfig`;
  - preserves manual `moveTable` position updates.
- `src/hooks/useFloorManagement.js`
  - manager/public floor-map queries now contain only operational fields, photos and `vrUrl`.
- Focused tests for the manager UI, simulator kill switch and mutation boundary.

## Acceptance result

- Manager UI has no `Mô phỏng 3D`, `3D / AR`, AR placement or 3D badge entry point.
- Add-table state, draft and mutation contain no `visualTemplate` / `visualConfig`.
- Table cards expose only the 360 visual action.
- Existing table details continue to provide link/upload/preview/removal of 360 content.
- Customer floor maps receive photos and 360 data only; legacy model data is not part of the active query contract.
- Manual floor designer positions, move-table behavior and normal table operations remain available.
- No dependency or destructive backend migration was introduced.

## Out of scope

- Dropping `visualConfig` from MongoDB/GraphQL or migrating historic records.
- Deleting all independent legacy 3D source files immediately; the public compatibility component is disabled and no active product caller reaches the feature.
- Replacing local panorama storage with object storage.
- Changing the manual floor-plan designer.

## Validation record

- Added focused Vitest coverage for the manager 360-only UI, disabled simulator and legacy mutation guard.
- No GitHub Actions workflow was associated with the implementation commit.
- Component tests, GraphQL checks, production build, 390×844 / 430×932 browser checks and a physical-phone panorama check could not be run through the GitHub connector.