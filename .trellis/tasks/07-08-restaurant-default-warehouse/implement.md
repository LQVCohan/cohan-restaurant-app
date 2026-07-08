# Implementation plan

1. Update `createRestaurant` to start one Mongoose session and create both the restaurant and `Kho chính` in the same transaction.
2. Extend the focused restaurant mutation test mocks and assert both documents use the same session.
3. Export the existing `createWarehouse` GraphQL operation to the storage UI.
4. Add a zero-warehouse recovery state to `StorageManagement`; authorized users create `Kho chính`, refetch warehouses, and select it immediately.
5. Add focused styles and component coverage for the recovery action.
6. Run the narrowest backend resolver test, storage component test, GraphQL check, conflict check, and build when available; review the final diff for scope and duplicate logic.
