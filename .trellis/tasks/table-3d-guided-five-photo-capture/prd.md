# Guide five-photo capture for AI table generation

## Current behavior

The AI table builder uses one `multiple` file input and validates 3–4 images. The upload route rejects a fifth image, and the Hi3D adapter also rejects more than four images. Users receive no capture order or angle guidance.

## Root cause

The reference-image count is duplicated across the frontend, upload route, and provider adapter. The frontend also treats the images as an unordered batch, so it cannot guide the user through repeatable capture angles.

## End-to-end flow

1. `CustomTableModelBuilderModal` gathers ordered reference photos and posts repeated `images` fields.
2. `/table-3d-ai/generate` validates and saves the uploaded images.
3. `requestTableModelGeneration` selects the configured provider.
4. Hi3D maps each ordered input to repeated `multi_images` and creates the task.
5. Existing job polling downloads the completed GLB and returns the current catalog-item contract.

## Scope

- Present five ordered capture steps: front, left 45°, right 45°, rear, and top-down.
- Use native file inputs with `capture="environment"`; mobile browsers can open the rear camera, while desktop browsers can select files for demo/testing.
- Require all five guided slots before frontend submission.
- Allow the shared upload route to receive five files.
- Allow Hi3D to accept 3–5 references so existing callers remain compatible, while the new UI sends five.
- Keep Meshy's existing 3–4 image contract unchanged.

## Files to change

- `src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.jsx`
- `src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx`
- `cohan-restaurant-backend/src/server/plugins/upload.route.js`
- `cohan-restaurant-backend/src/services/table3d/table3dAiGeneration.service.js`
- `cohan-restaurant-backend/tests/services/table3dAiGeneration.service.test.js`

## Acceptance criteria

- AI mode renders exactly five numbered capture steps with clear angle guidance.
- Each slot stores one image and supports replacing that image.
- The generate button is unavailable until all five slots contain valid images.
- Submission contains five ordered `images` multipart entries.
- The upload route does not reject the fifth valid image.
- Hi3D submission contains five `multi_images` entries.
- Meshy continues enforcing 3–4 references.
- Existing file type and 5 MB per-image validation remains active.

## Out of scope

- WebRTC camera preview, automatic shutter, object segmentation, or image-quality scoring.
- Changing job storage, provider credentials, polling, or GLB download behavior.
- Adding a new dependency.

## Validation plan

```bash
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm --prefix cohan-restaurant-backend test -- tests/services/table3dAiGeneration.service.test.js
npm run build
```
