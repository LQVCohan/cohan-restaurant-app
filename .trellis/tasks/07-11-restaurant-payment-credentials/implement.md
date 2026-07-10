# Implementation plan

1. Add encrypted credential model and export.
2. Add payment credential service for encryption, masking, save/disconnect/status and runtime resolution.
3. Extend provider functions to accept explicit credentials and callback verification credentials.
4. Resolve and persist credential references in restaurant payment creation flows; resolve exact credential during callbacks.
5. Extend GraphQL schema/query/mutations with permission checks and secret-free payloads.
6. Add manager page, sidebar entry and manager page wiring.
7. Add focused backend and frontend tests.
8. Run conflict check, GraphQL validation, targeted tests and builds through GitHub CI.

## Validation targets

- backend credential service tests
- payment provider security tests
- payment resolver access tests
- frontend component test for configuration page
- GraphQL schema validation
- frontend and backend build
