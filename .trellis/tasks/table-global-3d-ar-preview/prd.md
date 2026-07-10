# Global table 3D and AR preview

## Current behavior

The table manager intentionally keeps each table on a 360-only customer-facing visual flow. The repository still contains a complete shared 3D catalog, online model URL import, authenticated `.glb` upload, camera preview, and native AR support, but `TableManagement` no longer exposes a caller for that experience.

`Table3DSimulatorModalV2` also mixes two different jobs:

1. previewing a model in 3D/camera/AR;
2. applying model metadata or saving AR-derived coordinates to a concrete table.

The requested feature only needs the first job.

## End-to-end trace

1. **Persistence/schema**: no table document change is required. The preview must not write `visualConfig` or table `position`.
2. **Server/upload**: `POST /table-3d-assets/upload` already authenticates the user, rate-limits requests, validates `.glb`, enforces size limits, stores the asset, and returns a model URL.
3. **Client catalog**: `useTable3DModels` merges the local catalog with an optional online catalog.
4. **Custom models**: `CustomTableModelBuilderModal` already supports direct `.glb/.gltf` URLs and local `.glb` upload, then stores the resulting catalog item in the existing restaurant-scoped custom model storage.
5. **Preview/AR**: `Table3DSimulatorModalV2` renders the selected model with `model-viewer`, supports camera preview, and calls `activateAR()` with WebXR / Scene Viewer / Quick Look modes.
6. **UI caller**: `TableManagement` needs one manager-level button that opens the modal in preview-only mode.
7. **Tests**: component tests exist for `TableManagement`, `Table3DSimulatorModalV2`, and `Table3DActionBarV2`.

## Root cause

The capability already exists but has no active manager-level caller after the per-table 3D/AR flow was removed. Re-enabling the old per-table wrapper would also restore irrelevant apply/placement actions. The smallest correct fix is a preview-only mode in the existing modal and action bar, then one new caller in `TableManagement`.

## Product behavior

- The manager page shows a secondary action named **Xem thử bàn**.
- The action opens one full preview modal for the current restaurant.
- The user can choose a model from the built-in/online catalog.
- The user can add a model by URL or upload a `.glb` file from the device using the existing custom-model dialog.
- The user can rotate, zoom, reposition, and scale the 3D preview.
- The user can open the camera fallback or launch native camera AR when the browser/device supports it.
- The primary AR action is labelled **Mở camera AR**.
- Preview-only mode does not show apply-to-table or save-position controls.
- Closing the modal does not mutate a table, floor position, or GraphQL state.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
  - add one secondary action, modal state, and preview-only modal caller.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.jsx`
  - add preview-only copy/readiness and suppress table-placement/apply behavior.
- `src/components/Dashboard_Manager/Table/Table3DActionBarV2.jsx`
  - support optional placement/apply actions and configurable native AR label.
- Direct tests for those three components.

## Acceptance criteria

- `Xem thử bàn` is visible on the table manager and opens the global modal.
- The modal exposes the existing catalog and custom model creation/import entry point.
- URL and upload flows continue to use existing validation and authenticated backend upload.
- A supported mobile browser can launch `model-viewer.activateAR()` from **Mở camera AR**.
- Unsupported devices keep a clear disabled reason and camera preview fallback.
- No per-table 3D button, 3D badge, `visualConfig` persistence, AR coordinate save, or table mutation is restored.
- No new dependency is added.

## Out of scope

- Persisting a selected preview model to a table.
- Saving AR placement coordinates to the floor plan.
- Changing the backend upload contract or storage provider.
- Building a new 3D renderer or AR engine.

## Validation plan

- `vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `vitest run src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.test.jsx`
- `vitest run src/components/Dashboard_Manager/Table/Table3DActionBarV2.test.jsx`
- `npm run check:graphql` because no GraphQL operation should change.
- `npm run build` when a runnable checkout is available.
- Manual mobile check on HTTPS/localhost with a real AR-capable phone remains required for camera permission and native AR handoff.
