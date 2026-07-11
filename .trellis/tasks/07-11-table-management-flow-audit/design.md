# Design

## Direction

Harden the existing shared boundaries instead of adding UI guards at every caller. Keep the current GraphQL contract and active resolver composition.

## Backend changes

### Scoped floor lookup

Replace the unscoped floor-level helper with a lookup that loads `restaurantId` and `level`, then rejects a floor whose restaurant differs from the table input. This keeps the check next to the database boundary used by `createTable`.

### Atomic table-code swap

Use the existing Mongoose transaction pattern already used by composite table merge/split:

1. Validate IDs and reject `aId === bId`.
2. Load both tables inside the transaction with restaurant/floor scope.
3. Move A to a unique temporary code.
4. Move B to A's original code and clear B's QR data.
5. Move A to B's original code and clear A's QR data.
6. Require one modified row for each write; otherwise abort.
7. Commit, then write the audit event with corrected before/after values.

The unique table-code index remains the final concurrency guard.

### Literal search

Escape regex metacharacters once before constructing case-insensitive regexes. Apply one normalized safe limit helper to manager and public list queries.

## Frontend changes

Remove optimistic responses from table update and move mutations. Their mutation selections already return the authoritative fields and existing `update` handlers write those results into Apollo cache. This deletes the dependency on `window.__APOLLO_CLIENT__` and avoids sparse optimistic entities.

## Tests

Add a focused backend resolver test with mocks for:

- cross-restaurant floor rejection on create;
- literal regex search and safe limit clamp;
- self-swap rejection;
- transactional successful swap and corrected audit metadata;
- transaction abort propagation without partial success.

Extend the hook test to inspect mutation options and prove update/move no longer register optimistic-response functions while retaining cache update handlers.

## Compatibility

No GraphQL fields, operation names, routes, roles, status rules, QR behavior, composite merge behavior or 360 behavior change.
