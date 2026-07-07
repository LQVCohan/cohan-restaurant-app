# Design

Flow: `Table` model -> GraphQL table schema -> table resolver -> `useTableManagement` -> `TableManagement` -> `TableActionsLiteModal`.

Planned changes:

- Add the table-detail fields already used by the modal to the persisted contract.
- Read split target IDs before clearing their group and return that exact set.
- Resolve the open modal table from the latest query result by ID.
- Give the 3D/AR action a compact modifier class in the existing SCSS.

Checks: GraphQL schema and operations, focused table component test, focused resolver test, and build.
