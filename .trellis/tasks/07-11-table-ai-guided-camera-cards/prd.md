# Guided AI table photo capture

## Current behavior

`CustomTableModelBuilderModal` already collects five ordered photos and submits them as repeated `images` fields. Each step is currently a compact text row with a native file input. On a phone the input can open the rear camera, but the UI does not look or behave like a guided capture flow.

## End-to-end trace

1. `Table3DSimulatorModalV2` opens `CustomTableModelBuilderModal` and persists the returned catalog item.
2. `CustomTableModelBuilderModal` stores five `File` objects in the fixed `front`, `left`, `right`, `rear`, `top` order.
3. Each native image input uses `capture="environment"`, so supported mobile browsers open the rear camera.
4. `handleSubmitAi` validates all five images and appends them unchanged to the existing `FormData` request.
5. The backend and Hi3D integration consume the same image order and need no contract change.

## Root cause

The capture capability exists, but the presentation layer exposes the raw browser file control. There is no visual frame, no angle instruction inside the frame, no obvious shutter action, and no captured-image preview. Users therefore cannot confidently follow the five-shot sequence.

## Visual direction

A compact guided camera checklist using the existing warm-neutral table-builder palette: each step has a camera frame, short angle instruction over the frame, one clear camera button, preview confirmation, and a completed state.

## Files changing

- `src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.jsx`: render reusable guided capture cards around the existing native rear-camera inputs and show object-URL previews.
- `src/styles/CustomTableBuilderResponsiveFix.css`: style camera frames, overlays, capture actions, completion states and mobile layout.
- `src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx`: verify five real camera controls, guidance text, capture attributes and unchanged submission order.

## Acceptance criteria

- Five capture cards appear in the required order.
- Each card shows its angle name and a concise direction inside the image frame before capture.
- Each card has an explicit `Mở camera` action that triggers its native input with `capture="environment"`.
- After selecting or taking an image, the frame shows a preview and the action changes to `Chụp lại`.
- The completed state is communicated by text/icon, not color alone.
- The final AI request still sends exactly five images in `front`, `left`, `right`, `rear`, `top` order.
- Mobile controls remain at least 44 px and do not overflow at 390x844 or 430x932.
- No new dependency, backend, GraphQL, provider or storage change is introduced.

## Out of scope

- Custom WebRTC camera preview or in-browser shutter implementation.
- Automatic angle detection, segmentation, blur scoring or background removal.
- Changing Hi3D request fields, credentials, polling or generated-model storage.

## Validation plan

```bash
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run check:conflicts
npm run build
```

Manual responsive checks remain required at 390x844 and 430x932 when a browser/device session is available.
