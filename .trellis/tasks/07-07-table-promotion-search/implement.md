# Implementation

1. Keep the existing restaurant-scoped active-promotion query unchanged.
2. Add ephemeral search state in `TableActionsLiteModal` and filter the already-loaded list by promotion name or code.
3. Normalize case and Vietnamese diacritics locally; do not add a dependency or server query.
4. Preserve selected promotion IDs while the visible list changes.
5. Add one focused component test, then run that test and the frontend build.
