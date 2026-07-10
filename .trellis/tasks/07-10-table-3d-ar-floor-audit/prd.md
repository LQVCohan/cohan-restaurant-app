# Table 3D and AR floor preview audit

## Current behavior

The manager-level table preview lazy-loads a global 3D catalog and renders the selected asset with `model-viewer`. The preview is read-only and opens native AR through one shared action boundary.

The previous stability follow-up forced WebXR-only and `ar-scale="fixed"` immediately before launch. That reduced visible resizing drift, but it also removed the requested two-finger scaling and made floor acquisition harder on the tested Android device.

## End-to-end trace

1. **Persistence/schema**: the global preview intentionally does not update `Table.position` or `visualConfig`.
2. **Server upload**: `POST /table-3d-assets/upload` validates and returns the public model URL.
3. **Frontend import**: `CustomTableModelBuilderModal` accepts `.glb/.gltf` URLs or uploads a `.glb` file.
4. **Catalog**: `useTable3DModels` merges catalog and restaurant-scoped custom models.
5. **Viewer**: `Table3DSimulatorModalV2` renders `model-viewer`, checks `canActivateAR`, and calls `activateAR()`.
6. **UI action**: `Table3DActionBarV2` prepares the active viewer immediately before the native AR handoff.
7. **Tests**: focused component tests cover the modal and shared launch boundary.

## Root cause

Plane tracking is ultimately handled by the device AR runtime, but the shared launch boundary was making the tested path less usable by forcing WebXR-only and fixed physical scale. The smallest correction is to reuse the native AR modes already supported by `model-viewer`, prioritize Scene Viewer for the Android scan path, keep floor placement explicit, and restore automatic scaling.

## Scope

- Keep one primary native AR action.
- Keep `ar-placement="floor"` explicit.
- Use `ar-modes="scene-viewer webxr quick-look"` at launch.
- Restore `ar-scale="auto"` so users can resize with two fingers.
- Remove the temporary `setAttribute` interception that rewrote `auto` back to `fixed`.
- Improve floor-scan guidance for lighting, slower movement and textured reference points.
- Update direct action-bar tests.

## Acceptance criteria

- The modal contains no **Xem camera 2D** control or camera-overlay fallback.
- The selected model still supports rotate, zoom, framing, offset and scale in the 3D viewer.
- Launching AR configures `ar-placement="floor"` and `ar-scale="auto"`.
- Android native Scene Viewer is attempted before WebXR, with Quick Look retained for supported Apple devices.
- Two-finger scaling is available after the model is placed.
- Native AR remains disabled while the model is loading or when `canActivateAR` is false.
- Clicking native AR still rechecks viewer capability before invoking `activateAR()`.
- Guidance tells the user how to scan a better-lit, textured floor area before placement.
- No table mutation, coordinate save, dependency or backend contract is added.

## Out of scope

- Persisting AR coordinates to a table or floor plan.
- Replacing `model-viewer` or building a custom WebXR renderer.
- Guaranteeing physical-device plane detection from unit or desktop browser tests.
- Correcting malformed model units, origins or pivots inside uploaded GLB/GLTF files.

## Validation plan

- Targeted Vitest for the action bar and global modal.
- Conflict-marker check and frontend build.
- Manual test on a supported Android/iOS device over HTTPS for camera permission, floor scan, pinch scaling, placement drift and physical scale.
