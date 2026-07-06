# Manager remote-order switch

## Scope

Add a manager-facing switch that controls whether the selected restaurant accepts remote customer orders.

## Current behavior and root cause

The backend already stores `capabilities.acceptsOrders`, exposes it through GraphQL, accepts it in `UpdateRestaurantInput`, and uses it when computing `canOrder`. The manager restaurant form now queries `capabilities`, but it does not map that value into local form state, render a control, or send it back when saving.

## End-to-end flow

`Restaurant.capabilities.acceptsOrders` -> `Restaurant` GraphQL JSON field -> `GetRestaurantDetail` -> local restaurant form -> `Nhận đơn từ xa` switch -> `UpdateRestaurantInput.capabilities` -> `updateRestaurant` resolver -> availability `canOrder`.

## Files

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: add capability defaults, form synchronization, the switch, mutation payload, and persisted-value verification.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: verify that disabling the switch saves `acceptsOrders: false` while preserving other capability values.

## Acceptance criteria

- The switch reflects the restaurant's current `capabilities.acceptsOrders` value.
- Toggling it only changes `acceptsOrders` in the local capabilities object.
- Saving sends the complete capabilities object, preserving the existing capability flags.
- A refetch mismatch for `acceptsOrders` keeps the form dirty and warns instead of reporting success.
- Existing restaurant fields and save behavior remain unchanged.

## Validation

- Run the targeted component test.
- Run GraphQL operation validation.
- Run the frontend build if available.

## Out of scope

- Changing business or operational status controls.
- Adding switches for delivery, pickup, reservations, or table orders.
- Changing backend availability rules.
- Immediate autosave when the switch changes.
