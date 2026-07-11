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

## Files changed

- `src/utils/installGuidedAiCaptureCards.js`: simplifies the AI metadata section, translates table types and adds a short provider explanation.
- `src/styles/AiTableMetadataSimplification.css`: styles the compact explanation and preserves the existing mobile grid.
- `src/main.jsx`: loads the small scoped presentation layer after the guided capture styles.
- `src/utils/installGuidedAiCaptureCards.test.js`: covers hidden technical fields and retained operational fields.

## Implemented behavior

- Prompt, area, scale and tag fields are hidden from layout, focus order and accessibility tree in AI mode.
- Model name is labelled optional and receives a concrete example placeholder.
- Capacity is renamed to `Số chỗ ngồi` and uses a numeric mobile keyboard hint.
- Table type choices are translated to Vietnamese without changing stored values.
- A concise note explains that Hi3D uses the five photos directly and does not return table type or capacity.
- Existing hidden defaults, five-photo state, request metadata and provider integration are unchanged.

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

## Validation record

- Re-fetched the modified utility, stylesheet, application entry and focused test after writing.
- GitHub connector review confirmed the intended scoped files and no backend/provider file changes.
- Targeted Vitest, conflict check and production build were not run because the GitHub connector does not provide a checkout with installed dependencies.
- Responsive browser checks at 390x844 and 430x932 remain pending because no browser/device session is available.
