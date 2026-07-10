# Table 3D and AR floor preview audit

## Current behavior

The manager-level table preview lazy-loads a global 3D catalog and renders the selected asset with `model-viewer`. The footer currently exposes both an image-overlay camera fallback and native AR. The fallback does not place a real 3D object on a detected surface and is not needed for the requested workflow.

The AR path configures WebXR, Scene Viewer, and Quick Look, but the external action is enabled from model URL and secure-context checks only. It does not use `model-viewer.canActivateAR` after the model loads. The viewer also writes the unsupported `model-scale` attribute, so the visible scale control is not connected to the supported scene-graph `scale` contract.

## End-to-end trace

1. **Persistence/schema**: the global preview is intentionally read-only and does not update `Table.position` or `visualConfig`.
2. **Server upload**: `POST /table-3d-assets/upload` authenticates, rate-limits, validates one `.glb` model plus an optional thumbnail, stores the files, and returns public URLs.
3. **Frontend import**: `CustomTableModelBuilderModal` accepts `.glb/.gltf` URLs or uploads a `.glb` file through the existing route.
4. **Catalog**: `useTable3DModels` merges the local catalog with an optional public catalog; restaurant-scoped custom models are merged in the modal.
5. **Viewer**: `Table3DSimulatorModalV2` loads `model-viewer`, renders the model, tracks progress/errors, and calls `activateAR()`.
6. **UI action**: `Table3DActionBarV2` is the only reachable footer action boundary.
7. **Tests**: focused component tests and the mobile Playwright smoke test cover the reachable preview.

## Root cause

The preview retained a legacy 2D camera fallback after its scope became native 3D/AR-only. At the same boundary, the integration assumed AR availability and used a non-existent scale attribute. The root-cause fix belongs in the shared modal/action-bar boundary rather than adding another UI workaround.

## Scope

- Remove the 2D camera action, modal state, capability detection, import, and fallback copy.
- Keep one primary native AR action.
- Use the supported `scale` attribute for the selected model.
- Explicitly configure `ar-placement="floor"`, fixed physical scale, and WebXR environment lighting.
- Read `model-viewer.canActivateAR` after model load and block unsupported devices before calling `activateAR()`.
- Handle failed AR sessions through the existing inline error state.
- Update guidance to tell users to move the device slowly until the floor is detected.
- Update direct tests and the mobile smoke expectation.

## Acceptance criteria

- The modal contains no **Xem camera 2D** control or camera-overlay fallback.
- The selected model still supports rotate, zoom, framing, offset, and scale in the 3D viewer.
- The viewer uses `scale`, `ar-placement="floor"`, `ar-scale="fixed"`, `ar-modes="webxr scene-viewer quick-look"`, and `xr-environment`.
- Native AR remains disabled while the model is loading or when `canActivateAR` is false.
- Clicking native AR rechecks `canActivateAR` before invoking `activateAR()`.
- Unsupported devices receive a concrete reason instead of a silent no-op.
- No table mutation, coordinate save, dependency, or backend contract is added.

## Out of scope

- Persisting the preview model or AR coordinates to a table.
- Replacing `model-viewer` or building a custom WebXR renderer.
- Guaranteeing physical-device plane detection through unit or desktop browser tests.
- Changing the upload/storage provider.

## Validation plan

- Targeted Vitest for the action bar and global modal.
- Existing mobile Playwright smoke path.
- Conflict-marker check and frontend build.
- Manual test on a supported Android/iOS device over HTTPS for camera permission, floor scan, placement stability, and physical scale.
