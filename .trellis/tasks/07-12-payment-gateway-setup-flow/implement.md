# Implementation plan

1. Add a shared payment public-origin/client-IP helper and focused tests.
2. Expose manager-safe provider setup URLs through GraphQL with `PAYMENT_READ` permission.
3. Reuse the helper in active order, reservation and wallet payment creation paths.
4. Bind wallet top-up sessions to the declared platform credential mode.
5. Make credential save synchronize restaurant provider mode/active state and use the correct audit verb.
6. Add the four-step setup guide, copy actions and local-origin warning to the manager page.
7. Update focused frontend/backend tests and run the narrowest available checks.

## Validation targets

- payment request-context unit test
- payment credential resolver/service tests
- payment settings component test
- GraphQL schema check
- frontend/backend build
