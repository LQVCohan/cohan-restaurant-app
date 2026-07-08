# Design

## Backend boundary

Keep the invariant at `createRestaurant`, the earliest shared mutation used by all current restaurant creation callers. Start one Mongoose session, create the restaurant and `Warehouse { restaurantId, name: "Kho chính", code: "MAIN", isActive: true }` inside `withTransaction`, then return the existing Restaurant payload. Do not change GraphQL schema or caller fragments.

## Client recovery

Reuse the existing `createWarehouse` GraphQL contract. When the warehouse query resolves successfully with an empty list, replace the operational tab body with one setup panel. Authorized users create the default warehouse; the mutation result becomes the selected warehouse and the warehouses query is refetched. Read-only users receive explanatory text only.

## UI direction

Use the existing warm neutral inventory visual system, one warehouse icon, concise copy, visible focus, and the existing `sm-btn` controls. Avoid a modal because the recovery action has no user choices.

## Error handling

Backend transaction failure propagates through GraphQL and rolls back both writes. Frontend maps the mutation error through the existing inventory action error mapper and leaves the setup state available for retry.
