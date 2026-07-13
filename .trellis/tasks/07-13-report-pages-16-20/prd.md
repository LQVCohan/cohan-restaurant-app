# Report pages 16–20

## Scope
- Customer creation and guest synchronization.
- Customer analytics actions and exact customer/order navigation.
- Promotion recipient/restaurant scoping and plain Vietnamese copy.
- Review error privacy and broken-image resilience.
- Remaining customer-history and technical-alert findings from quality review.

## Acceptance
- Guest creation returns the authoritative record to the list refresh path.
- Registered account status remains backend-controlled.
- Raw GraphQL/Apollo/internal identifiers never reach customer-facing errors.
- Customer recent-order and analytics actions open the correct customer context.
- Promotion offers cannot cross restaurant scope and unsupported scheduling cannot be selected.

## Final quality gate
- Analytics action labels match their actual destination.
- Added and changed flows are covered by focused regression tests.
- Merge only after the latest frontend and backend CI jobs complete successfully.
