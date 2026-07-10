# Global table 3D and AR preview

## Current behavior

The manager table screen keeps each concrete table on the existing 360-only customer-facing flow. The repository already contains a shared 3D catalog, online model URL import, authenticated `.glb` upload, camera preview, and native AR support, but there was no active manager-level caller after the old per-table model/position flow was removed.

The previous 3D modal also mixed two jobs:

1. previewing a model in 3D, camera, and AR;
2. applying model metadata or saving AR-derived coordinates to a concrete table.

This feature restores only the first job.

## End-to-end trace

1. **Persistence/schema**: no table document change is required. The preview does not write `visualConfig` or table `position`.
2. **Server/upload**: `POST /table-3d-assets/upload` already authenticates the user, rate-limits requests, validates `.glb`, enforces size limits, stores the asset, and returns a model URL.
3. **Client catalog**: `useTable3DModels` merges the local catalog with an optional online catalog.
4. **Custom models**: `CustomTableModelBuilderModal` supports direct `.glb/.gltf` URLs and local `.glb` upload, then stores the resulting catalog item in restaurant-scoped custom model storage.
5. **Preview/AR**: `Table3DSimulatorModalV2` renders the selected model with `model-viewer`, supports camera preview, and calls `activateAR()` with WebXR / Scene Viewer / Quick Look modes.
6. **UI caller**: `Table3DPreviewLauncher` adds one scoped action to the existing table-manager header and lazy-loads the heavy preview modal only after the user opens it.
7. **Tests**: direct component tests cover the launcher, action bar, global preview modal, custom-model selection, camera fallback, native AR handoff, and the mobile Playwright smoke path.

## Root cause

The required capabilities already existed but the manager-level caller had been removed together with the obsolete per-table 3D/AR placement flow. Re-enabling the old wrapper would also restore apply and coordinate-save actions. The smallest complete fix is one preview-only caller plus a preview-only modal/action bar that reuse the existing catalog, import, upload, camera, and AR infrastructure.

## Implemented behavior

- The table manager shows a secondary action named **Xem thử bàn**.
- The action follows the currently selected restaurant and opens one full preview modal.
- The modal is lazy-loaded, so other pages do not load the 3D workflow until it is requested.
- The user can choose a model from the built-in/online catalog.
- **Tạo mẫu mới** exposes the existing URL `.glb/.gltf` and local `.glb` upload flows.
- The selected model can be rotated, zoomed, repositioned, and scaled in the 3D viewer.
- **Xem camera 2D** provides the existing camera-overlay fallback.
- **Mở camera AR** calls the native `model-viewer` AR handoff when HTTPS/localhost and the selected asset permit it.
- AR readiness no longer requires selecting a concrete table.
- No apply-to-table, table-placement, coordinate-save, or GraphQL mutation action is rendered.

## Changed files

- `src/App.jsx`
  - mounts the route-aware launcher inside the existing providers/router.
- `src/components/Dashboard_Manager/Table/Table3DPreviewLauncher.jsx`
  - adds the table-header action, restaurant-scope sync, portal mounting, and lazy modal loading.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.jsx`
  - converts the reachable experience to global preview/import/camera AR only.
- `src/components/Dashboard_Manager/Table/Table3DActionBarV2.jsx`
  - keeps only camera fallback and native AR actions.
- `src/components/Dashboard_Manager/Table/Table3DReadiness.jsx`
  - requires a concrete table only when a caller explicitly supplies a placement readiness item.
- `src/components/Dashboard_Manager/Table/Table3DQuickGuide.jsx`
  - removes the obsolete apply/save-position guidance.
- Direct Vitest files for the launcher, modal, and action bar.
- `tests/e2e/table-ar-mobile.spec.js`
  - verifies the new mobile manager entry point and absence of persistence actions.

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

- `vitest run src/components/Dashboard_Manager/Table/Table3DPreviewLauncher.test.jsx`
- `vitest run src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.test.jsx`
- `vitest run src/components/Dashboard_Manager/Table/Table3DActionBarV2.test.jsx`
- `playwright test tests/e2e/table-ar-mobile.spec.js`
- `npm run check:graphql` because no GraphQL operation should change.
- `npm run build` when a runnable checkout is available.
- Manual HTTPS/localhost check with a real AR-capable phone remains required for camera permission and the native Scene Viewer / Quick Look handoff.
