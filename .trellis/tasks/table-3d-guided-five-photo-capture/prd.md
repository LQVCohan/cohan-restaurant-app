# Guide five-photo capture for AI table generation

## Current behavior

The five guided photos are accepted and sent to the configured Hi3D API. Hi3D can complete the task and the backend downloads the GLB into `/uploads/table-3d/models`.

The generated result can still fail at the final catalog/viewer boundary:

- the modal stores user input as `label` and `type`, while catalog builders read `name` and `tableType`;
- the downloaded Hi3D model is returned as a backend-relative `/uploads/...` path, which can resolve against the frontend origin when the two applications use different origins.

## Root cause

The provider path and the frontend catalog use two valid but different field contracts. The catalog builder does not normalize those aliases or backend-relative asset paths before persisting the generated model item.

## End-to-end flow

1. `CustomTableModelBuilderModal` gathers five ordered reference photos and posts repeated `images` fields.
2. `/table-3d-ai/generate` validates and saves the uploaded images.
3. `requestTableModelGeneration` selects Hi3D and submits repeated `multi_images`.
4. Existing job polling downloads the completed GLB into the backend upload directory.
5. `buildAiGeneratedTableCatalogItem` normalizes the modal/result contract and produces a model URL that `model-viewer` can load from the backend.
6. `Table3DSimulatorModalV2` stores and selects the generated catalog item.

## Scope

- Keep the existing five ordered capture steps and Hi3D request mapping.
- Accept `label`/`type` as aliases for `name`/`tableType` in shared custom-model builders.
- Normalize local `/uploads/...` model and thumbnail paths through the existing backend asset URL helper.
- Preserve absolute external CDN URLs unchanged.
- Add focused regression coverage for the Hi3D result contract.

## Files to change

- `src/config/table3dCustomModelBuilder.js`
- `src/config/table3dCustomModelBuilder.test.js`

## Acceptance criteria

- A Hi3D result built from modal fields keeps the entered model name.
- A Hi3D result keeps the selected table type instead of falling back to the default.
- A backend-relative generated GLB path resolves to the backend origin before it reaches `model-viewer`.
- Absolute external model and thumbnail URLs remain unchanged.
- Existing canonical `name`/`tableType` callers remain compatible.

## Out of scope

- WebRTC camera preview, automatic shutter, segmentation, or image-quality scoring.
- Persistent database storage for provider jobs.
- Changing Hi3D credentials, task submission fields, or polling behavior.
- Adding a dependency.

## Validation plan

```bash
npx vitest run src/config/table3dCustomModelBuilder.test.js
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run build
```
