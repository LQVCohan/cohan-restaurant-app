# Table AR mobile demo readiness

## Current behavior

The manager table page already contains a complete 3D simulator, native model-viewer AR, WebXR placement flow, camera preview, GraphQL update mutation, backend sanitizer, permission check, and audit logging. However, the page-level handler that selects a concrete table for AR is not connected to any visible table-card action. The header simulator opens with `table=null`, so AR placement cannot save a table position from that entry point.

The AR geofence reads `restaurant.address.lat/lng`, but the shared `RestaurantFields` fragment does not request those schema fields. The model catalog hook also attempts `fetch("")` when no online catalog URL is configured, then shows a fallback warning even though the local catalog is the intended default.

## Root causes

1. `handleOpenArPlacementForTable` is dead UI code: it selects the raw table and floor correctly, but no table action calls it.
2. The frontend GraphQL fragment is narrower than the backend `Address` contract, so valid stored coordinates never reach the AR modal.
3. `useTable3DModels` does not distinguish "no remote catalog configured" from "remote catalog failed".

## End-to-end flow

1. `Table` Mongoose schema stores required `position` and optional sanitized `visualConfig`.
2. `UpdateTableInput` accepts both fields.
3. `updateTable` checks `TABLE_WRITE`, sanitizes `visualConfig`, validates the update, and writes an audit event.
4. `useTableManagement` requests and mutates `position` plus `visualConfig`.
5. `TableManagement` maps the selected table, opens `Table3DSimulatorModal`, and saves through `updateTable`.
6. `ArTablePlacementModal` checks HTTPS/WebXR/model/geolocation, reads restaurant coordinates, maps the AR hit point to floor coordinates, and returns the save payload.
7. Component and Playwright tests are the nearest automated caller boundaries; a real Android phone remains required for actual WebXR hardware validation.

## Scope

- Add a visible `3D / AR` action to every table card and open the existing simulator with that exact table and floor.
- Request `postalCode`, `lat`, and `lng` in the shared restaurant fragment.
- Use the local 3D catalog immediately when no public catalog URL is configured, without issuing an empty fetch or displaying a false warning.
- Update the closest component and mobile Playwright smoke tests.
- Update the manual checklist for ngrok HTTPS, restaurant coordinates, Android Chrome/Edge, ARCore, and the per-table entry point.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`: connect the existing per-table AR handler to a table-card button.
- `src/hooks/useRestaurant.js`: align `RestaurantFields.address` with the existing backend fields used by AR geofencing.
- `src/hooks/useTable3DModels.js`: treat an empty remote catalog URL as an intentional local-catalog configuration.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`: prove the selected table/floor reaches the 3D modal.
- `tests/e2e/table-ar-mobile.spec.js`: exercise the concrete table AR entry and include restaurant coordinates in the GraphQL mock.
- `docs/AR_MOBILE_TEST_CHECKLIST.md`: document the stable mobile/ngrok demo procedure.

## Acceptance criteria

- Every rendered table card has a keyboard-accessible `3D / AR` action.
- Clicking the action opens the simulator with the correct raw table and floor rather than the generic no-table state.
- The shared restaurant query returns `address.lat` and `address.lng` when stored by the backend.
- With no `VITE_TABLE_3D_PUBLIC_CATALOG_URL`, the hook uses the local catalog with `loading=false` and no fallback error.
- The existing generic header simulator remains available for browsing/applying templates.
- Existing table status actions, permissions, mutation validation, audit logging, and refetch behavior remain unchanged.
- Automated tests cover the concrete table selection path; real WebXR is explicitly left to a physical Android phone checklist.

## Out of scope

- Replacing the external GLTF/GLB catalog with new binary assets.
- Changing the backend schema, resolver, permissions, sanitizer, audit log, or geofence radius.
- Automating ngrok installation or committing a tunnel URL.
- Mocking a real immersive WebXR hardware session in Playwright.
- Completing the separate Hi3D provider task.

## Validation plan

- Run targeted `TableManagement.test.jsx`.
- Run `tests/e2e/table-ar-mobile.spec.js` when Playwright/browser dependencies are available.
- Run `npm run check:graphql`.
- Run `npm run build`.
- Review the diff for duplicate table actions, GraphQL contract drift, and mobile card overflow.
