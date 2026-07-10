# AR load and scale fix

## Current behavior

On Android, the native AR cube control can open Scene Viewer while the visible `Mở camera AR` action remains disabled and the loading overlay stays at 0%. Native AR also opens oversized models that are difficult to place because scaling is locked.

## Root cause

1. The modal attaches `load` and AR listeners after render but does not reconcile an already-loaded `model-viewer` instance.
2. `canActivateAR` is sampled once during `load`, while model-viewer selects its AR mode asynchronously.
3. `ar-scale="fixed"` disables native AR resizing.
4. The default model-viewer AR button remains visible, creating two competing entry points.

## Smallest correct change

- Reconcile `viewer.loaded` immediately after listeners attach.
- Retry capability synchronization briefly while model-viewer finishes selecting WebXR, Scene Viewer, or Quick Look.
- Keep only the existing external AR action by replacing the default slot with a hidden element.
- Use `ar-scale="auto"` so the model can be resized in native AR.
- Clarify the pre-launch floor-scanning guidance.

## Acceptance criteria

- A cached/fast model does not remain at 0% after it is already loaded.
- The external AR button becomes enabled when the device-supported AR mode is ready.
- The default cube AR control is not shown.
- Android Scene Viewer/WebXR allows pinch resizing.
- The UI tells the user to scan a clear, well-lit floor from farther away.

## Out of scope

- Replacing native Scene Viewer plane detection.
- Building a new custom WebXR renderer.
- Persisting AR coordinates to the floor plan.
- Re-authoring third-party GLTF geometry or origins.
