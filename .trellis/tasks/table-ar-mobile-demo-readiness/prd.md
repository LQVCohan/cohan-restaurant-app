# Table AR mobile demo readiness

## Current behavior

The manager table page already contains a complete 3D simulator, native model-viewer AR, WebXR placement flow, camera preview, GraphQL update mutation, backend sanitizer, permission check, and audit logging. However, the page-level handler that selects a concrete table for AR was not connected to any visible table-card action. The header simulator opens with `table=null`, so AR placement cannot save a table position from that entry point.

The AR geofence reads `restaurant.address.lat/lng`, but the shared `RestaurantFields` fragment did not request those schema fields. The model catalog hook also attempted `fetch("")` when no online catalog URL was configured, then showed a fallback warning even though the local catalog was the intended default.

## Root causes

1. `handleOpenArPlacementForTable` selected the raw table and floor correctly, but no table action called it.
2. The frontend GraphQL fragment was narrower than the backend `Address` contract, so valid stored coordinates never reached the AR modal.
3. `useTable3DModels` did not distinguish "no remote catalog configured" from "remote catalog failed".

## End-to-end flow

1. `Table` Mongoose schema stores required `position` and optional sanitized `visualConfig`.
2. `UpdateTableInput` accepts both fields.
3. `updateTable` checks `TABLE_WRITE`, sanitizes `visualConfig`, validates the update, and writes an audit event.
4. `useTableManagement` requests and mutates `position` plus `visualConfig`.
5. `TableManagement` maps the selected table, opens `Table3DSimulatorModal`, and saves through `updateTable`.
6. `ArTablePlacementModal` checks HTTPS/WebXR/model/geolocation, reads restaurant coordinates, maps the AR hit point to floor coordinates, and returns the save payload.
7. Component and hook tests cover the new caller boundaries. Existing Playwright smoke tests still validate the generic mobile route and modal flow, while a real Android phone remains required for immersive WebXR hardware validation.

## Implemented scope

- Added a visible `3D / AR` action to every table card and connected it to the existing handler with the exact table and floor.
- Requested `postalCode`, `lat`, and `lng` in the shared restaurant fragment.
- Used the local 3D catalog immediately when no public catalog URL is configured, without issuing an empty fetch or displaying a false warning.
- Added focused component coverage for selecting the concrete table/floor.
- Added focused hook coverage for the local-catalog path.
- Updated the manual checklist for ngrok HTTPS, restaurant coordinates, Android Chrome/Edge, ARCore, and the per-table entry point.

## Changed files

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`: connects the existing per-table AR handler to a table-card button.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`: proves the selected raw table and floor reach the 3D modal.
- `src/hooks/useRestaurant.js`: aligns `RestaurantFields.address` with the existing backend fields used by AR geofencing.
- `src/hooks/useTable3DModels.js`: treats an empty remote catalog URL as an intentional local-catalog configuration.
- `src/hooks/useTable3DModels.test.jsx`: proves the empty URL path does not call `fetch` and does not show an error.
- `docs/AR_MOBILE_TEST_CHECKLIST.md`: documents the stable mobile/ngrok demo procedure.

## Acceptance criteria

- Every rendered table card has a keyboard-accessible `3D / AR` action.
- Clicking the action opens the simulator with the correct raw table and floor rather than the generic no-table state.
- The shared restaurant query returns `address.lat` and `address.lng` when stored by the backend.
- With no `VITE_TABLE_3D_PUBLIC_CATALOG_URL`, the hook uses the local catalog with `loading=false` and no fallback error.
- The existing generic header simulator remains available for browsing/applying templates.
- Existing table status actions, permissions, mutation validation, audit logging, and refetch behavior remain unchanged.
- Automated tests cover the concrete table selection and local-catalog paths; real WebXR is explicitly left to a physical Android phone checklist.

## Out of scope

- Replacing the external GLTF/GLB catalog with new binary assets.
- Changing the backend schema, resolver, permissions, sanitizer, audit log, or geofence radius.
- Automating ngrok installation or committing a tunnel URL.
- Mocking a real immersive WebXR hardware session in Playwright.
- Adding a new per-table Playwright scenario in this patch; the existing generic mobile smoke suite remains unchanged.
- Completing the separate Hi3D provider task.

## Validation completed

GitHub CI run `28805215357` passed:

- unresolved conflict marker check;
- frontend lint;
- frontend unit tests;
- menu RBAC test;
- changed component tests;
- frontend production build;
- existing Playwright smoke tests;
- backend lint, tests, menu RBAC, and build.

Manual validation still required before the live presentation:

- run the actual frontend through a live ngrok HTTPS URL;
- test camera permission, geolocation, ARCore and immersive WebXR on the target Android phone;
- verify the demo restaurant coordinates match the physical test location;
- scan the floor, pin a table, save it, refresh the page, and confirm persistence on the floor map.
