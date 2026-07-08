# Persist and reopen uploaded table 3D models

## Current behavior

A manager can upload a valid `.glb` model and preview it in the catalog. When the 3D/AR modal is opened from an existing table, pressing **Apply 3D model** still enters the add-table flow instead of updating that table. Reopening the same table also selects the first catalog model rather than the model stored in `table.visualConfig`.

The camera preview is intentionally a 2D overlay fallback. The real 3D and native/WebXR AR flow already exists in `Table3DSimulatorModalV2` and must receive the persisted model.

## Root cause

1. `TableManagement.handleApply3DTemplate` does not branch between the generic template browser and a concrete selected table.
2. `Table3DSimulatorModalV2` builds its model list only from the catalog and browser-local custom models, then always selects the first item. It does not reconstruct the model already persisted in `table.visualConfig`.

## End-to-end flow

1. `Table.visualConfig` is a persisted Mixed field in Mongoose.
2. `UpdateTableInput.visualConfig` accepts the payload.
3. The resolver checks `TABLE_WRITE`, sanitizes asset URLs, updates the table, and writes an audit event.
4. `useTableManagement` queries and mutates `visualConfig`.
5. `TableManagement` opens the simulator with the concrete raw table.
6. Applying a model must update that table and refetch it.
7. Reopening the table must rebuild the saved model item from `visualConfig` and select it in the real `<model-viewer>`/AR flow.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`: update an existing selected table instead of opening the add-table modal.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`: prove the selected table receives the uploaded model configuration.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.jsx`: prepend the persisted table model to the available models.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.test.jsx`: prove a persisted model outside the catalog is selected and rendered.

## Acceptance criteria

- Applying a 3D model from a concrete table calls `updateTable` with that table ID and the selected model `visualConfig`.
- The table list is refetched and the simulator closes after success.
- The generic header simulator still opens the existing add-table flow.
- Reopening a table with `visualConfig.modelUrl` selects and renders that exact model, even when it is not in the current catalog/localStorage.
- Existing permissions, backend sanitization, audit logging, AR placement, and camera-preview fallback remain unchanged.

## Out of scope

- Replacing the intentional camera thumbnail overlay with surface-tracked 3D.
- Adding new dependencies or changing the backend contract.
- Persisting the whole custom catalog server-side.
- Physical Android WebXR validation.

## Validation plan

```bash
npx vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.test.jsx
npm run build
```
