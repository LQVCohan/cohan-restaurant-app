# Simplified AI table metadata

## Current behavior

The AI table flow collects five ordered photos and sends them to the existing REST endpoint. The screen also renders prompt, area, scale and tag inputs even though these values are not useful to the manager during image-based generation.

## End-to-end trace

1. `CustomTableModelBuilderModal` stores five images plus local catalog metadata.
2. `/table-3d-ai/generate` parses metadata and saves the uploaded image files.
3. `table3dAiGeneration.service.js` submits Hi3D `multi_images` with provider technical settings.
4. Hi3D task creation returns a task id; polling returns state, model URL and cover URL.
5. `buildAiGeneratedTableCatalogItem` still needs COHAN's table type and capacity because Hi3D does not return them.
6. `installGuidedAiCaptureCards` already owns the progressive enhancement for this AI-only section and can simplify the same rendered UI without changing the provider or request contract.

## Root cause

The interface exposes metadata inherited from generic URL/upload model forms. Hi3D does not accept the visible prompt and does not return table type or capacity. Scale, area and tags have safe existing defaults and should not be presented as required AI decisions.

## Visual direction

A guided five-photo flow with one compact "Thông tin dùng trong COHAN" group. Keep only optional model name, table type and seat count; explain why those two operational fields remain. Hide technical/default fields.

## Files changing

- `src/utils/installGuidedAiCaptureCards.js`: simplify the AI metadata section, translate table types and add a short provider explanation.
- `src/styles/GuidedAiCaptureCards.css`: style the compact explanation and metadata grid.
- `src/utils/installGuidedAiCaptureCards.test.js`: cover hidden technical fields and retained operational fields.

## Acceptance criteria

- Prompt, area, scale and tag are not visible or keyboard-focusable in AI mode.
- Name remains optional; table type and seat count remain available because Hi3D does not return them.
- Table type option labels are understandable Vietnamese labels.
- Five-photo capture and submission order are unchanged.
- Hi3D request fields, provider settings, polling and catalog persistence remain unchanged.
- No dependency, GraphQL, database or provider contract change is introduced.

## Out of scope

- Automatic image classification of table type or capacity.
- Sending a text prompt to Hi3D, because the integrated Hi3D multipart contract does not expose one.
- Changing default scale calculations or the final model-viewer controls.

## Validation plan

```bash
npx vitest run src/utils/installGuidedAiCaptureCards.test.js
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run check:conflicts
npm run build
```

Manual responsive checks remain required at 390x844 and 430x932 when a browser/device session is available.
