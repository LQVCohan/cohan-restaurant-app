# Implementation plan

1. Fix helper semantics and tests.
2. Wire authenticated order/reservation success paths to touch recent + membership with session.
3. Normalize recent GraphQL API and legacy self-only deprecation.
4. Keep archive/customer list/notification on `customerRestaurants`/BrandMembership.
5. Fix frontend constant, wording and detail record timing.
6. Harden migration raw comparisons and add behavior tests.
7. Run targeted then full validation commands.
