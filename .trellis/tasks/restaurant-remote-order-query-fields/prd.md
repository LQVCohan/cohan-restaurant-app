# Restaurant remote-order query fields

## Scope

Update the manager restaurant information GraphQL operations so they request the existing remote-order and operational fields.

## Current behavior

`RestaurantInfoManagement.jsx` only requests the legacy `status` field. The backend already exposes `businessStatus`, `operationalStatus`, `capabilities`, and `orderPolicy`, but the manager screen cannot read them yet.

## Flow

`Restaurant` Mongoose fields -> `Restaurant` GraphQL type -> `restaurant` / `updateRestaurant` operations -> `RestaurantInfoManagement`.

## Files

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: add the existing fields to the detail query and update mutation selection set.

## Acceptance criteria

- `GetRestaurantDetail` requests `businessStatus`, `operationalStatus`, `capabilities`, and `orderPolicy`.
- `UpdateRestaurantInfo` returns the same four fields.
- No UI control or mutation input behavior is added in this task.
- Existing query fields remain unchanged.

## Validation

- Run the narrowest available GraphQL operation validation.
- Confirm both operation selection sets contain the same remote-order fields.

## Out of scope

- Adding the manager switch.
- Updating form state or save payload.
- Replacing the legacy restaurant status control.
