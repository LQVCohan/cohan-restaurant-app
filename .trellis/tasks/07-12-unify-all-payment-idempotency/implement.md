# Implementation plan

1. Add the durable claim model and shared payment idempotency service.
2. Add a resolver-map wrapper around the final composed payment mutation boundary.
3. Require keys in GraphQL payment inputs and preserve the existing wallet contract.
4. Extend Apollo key generation/storage to all payment mutation operation names.
5. Convert reservation deposit creation from REST to GraphQL.
6. Add focused source/behavior tests and review all callers.
7. Re-fetch every target file before writing, inspect the final diff, and report unavailable checks explicitly.
