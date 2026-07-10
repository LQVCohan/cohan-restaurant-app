# Fix table management component test regressions

## Current behavior

The frontend component job reports three failures in `TableManagement.test.jsx` and one timeout leak from a modal test.

## Root cause

1. The test imports `AuthContext`, then calls `vi.resetModules()` before dynamically importing `TableManagement`. That creates a second `AuthContext` module instance, so the component reads the default context instead of the provider used by the test.
2. Two assertions still expect older accessible text (`heading: Thêm bàn`, `button: Thanh toán`) while the current compact UI renders a structured modal header and the visible short label `T.Toán`.
3. `Modal.jsx` schedules a 50 ms focus timer in jsdom. The component test can finish before the timer fires, so Vitest reports a leaked timeout.

## End-to-end flow checked

`AuthContext restaurants -> TableManagement selectedRestaurantId -> useFloorManagement/useTableManagement restaurantId -> rendered table actions -> component assertions`.

No GraphQL schema, resolver, mutation, permission, or table workflow change is required.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
  - Import the component once so the provider and consumer share the same `AuthContext` instance.
  - Assert the current structured modal content and compact payment label.
- `src/components/common/Modal.jsx`
  - Focus immediately in jsdom and retain delayed focus in real browsers.

## Acceptance criteria

- The shared manager branch test observes `restaurant-1`, then `restaurant-2` after the existing scope event.
- The create-table test opens the current modal and still verifies the operational-only mutation payload.
- The POS guard test verifies the disabled compact payment action and guard reason.
- No timeout leak is reported from the modal focus timer.
- Production table labels and GraphQL behavior remain unchanged.

## Validation plan

```bash
npx vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx src/components/Dashboard_Manager/Table/TableCameraPlacementPreviewModal.test.js
npm run test:component -- --runInBand
npm run build
```
