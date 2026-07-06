# Restaurant operational status control

## Scope

Replace the manager restaurant form's deprecated `status` control with the modern `operationalStatus` field.

## Current behavior and root cause

The page labels the control as a business/open-close state but reads and writes legacy `status`. The availability service prioritizes `operationalStatus`, so changing legacy `status` does not reliably pause ordering on modern restaurant documents.

## End-to-end flow

`Restaurant.operationalStatus` -> `Restaurant` GraphQL field -> `GetRestaurantDetail` -> manager form -> operational-status select -> `UpdateRestaurantInput.operationalStatus` -> `updateRestaurant` -> `computeRestaurantAvailability` -> `canOrder` / `canReserve`.

## Files

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: remove legacy status usage, bind the form and preview to `operationalStatus`, send it in the update payload, and verify it after refetch.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: prove that selecting paused saves `operationalStatus: "paused"` and omits legacy `status`.

## Acceptance criteria

- The control is labelled `Trạng thái vận hành`.
- It supports `normal`, `paused`, `maintenance`, and `holiday` values already defined by the model.
- Saving sends `operationalStatus` and no longer sends deprecated `status`.
- Header/summary/preview derive their open or closed presentation from `operationalStatus`.
- Persisted-value verification checks `operationalStatus`.
- Existing remote-order capability behavior remains unchanged.

## Validation

- Run the targeted component test.
- Run GraphQL operation validation.
- Run the frontend build if available.

## Out of scope

- Changing `businessStatus` or `publicationStatus`.
- Editing opening schedules or special hours.
- Adding backend enums or mutations.
- Autosaving the status control.
