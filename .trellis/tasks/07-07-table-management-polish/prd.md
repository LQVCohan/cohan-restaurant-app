# Table management polish

## Current behavior

The table card gives the `3D / AR` action the same visual weight as operating actions. The detail modal sends table fields that are not declared in the GraphQL input or Mongoose model. The ALL split resolver updates the right group but returns IDs from the whole restaurant. The open modal also keeps an old table snapshot after merge or split.

## Scope

- Make the card-level `3D / AR` action compact while keeping its text and accessible name.
- Align table detail fields across Mongoose, GraphQL, Apollo, and the modal payload.
- Return only tables actually affected by ALL and PARTIAL split operations.
- Keep the open detail modal synchronized with refetched table data.
- Add focused regression coverage.

## Acceptance criteria

1. `3D / AR` is visibly smaller than the main table workflow action.
2. Saving detail-modal fields does not fail because of undeclared GraphQL input fields.
3. ALL split returns only IDs from the requested join group.
4. PARTIAL split returns only IDs that belonged to the requested group.
5. After merge or split refetches, the open modal receives the latest `joinGroupId`.
6. Existing restaurant permissions and event logging remain unchanged.
7. Focused GraphQL, frontend, backend, and build checks are attempted.

## Out of scope

- Redesigning the entire manager dashboard.
- Combining POS orders as part of table merge.
- Adding dependencies.
- Replacing the modal framework.
