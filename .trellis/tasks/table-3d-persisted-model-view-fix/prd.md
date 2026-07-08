# Persist and reopen uploaded table 3D models

## Current behavior

A manager can upload a valid `.glb` model and preview it in the catalog. When the 3D/AR modal is opened from an existing table, pressing **Apply 3D model** still enters the add-table flow instead of updating that table. Reopening the same table also selects the first catalog model rather than the model stored in `table.visualConfig`.

The camera preview is intentionally a 2D overlay fallback. The real 3D and native/WebXR AR flow already exists in `Table3DSimulatorModalV2` and must receive the persisted model.

## Root cause

The compatibility wrapper forwards every apply action to the generic add-table callback and does not restore the model already persisted in `table.visualConfig` into the browser-local custom catalog before mounting V2.

## End-to-end flow

1. `Table.visualConfig` is persisted by Mongoose.
2. `UpdateTableInput.visualConfig` accepts the payload.
3. The resolver checks `TABLE_WRITE`, sanitizes asset URLs, updates the table, and writes an audit event.
4. `useTableManagement` queries and mutates `visualConfig`.
5. `TableManagement` already passes the concrete table and an `onSaveArPosition` callback that updates/refetches it.
6. The wrapper must use that callback for an existing table, while keeping the generic `onApply` path for the header template browser.
7. Before mounting V2, the wrapper must rebuild the saved model from `table.visualConfig` and upsert it into the same scoped custom catalog that V2 already loads.

## Files to change

- `src/components/Dashboard_Manager/Table/Table3DSimulatorModal.jsx`: route apply actions correctly and rehydrate the persisted model before mounting V2.
- `src/components/Dashboard_Manager/Table/Table3DSimulatorModal.test.jsx`: prove both the existing-table and generic-template paths.

## Acceptance criteria

- Applying a 3D model from a concrete table calls the existing table-save callback with the selected model `visualConfig` and closes the simulator after success.
- The generic header simulator still calls the existing add-table callback.
- Reopening a table with `visualConfig.modelUrl` upserts that exact model into the scoped custom catalog before V2 mounts, so the real `<model-viewer>`/AR flow can select it.
- Existing permissions, backend sanitization, audit logging, refetch behavior, AR placement, and camera-preview fallback remain unchanged.

## Out of scope

- Replacing the intentional camera thumbnail overlay with surface-tracked 3D.
- Adding dependencies or changing the backend contract.
- Persisting the whole custom catalog server-side.
- Physical Android WebXR validation.

## Validation plan

```bash
npx vitest run src/components/Dashboard_Manager/Table/Table3DSimulatorModal.test.jsx src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.test.jsx
npm run build
```
