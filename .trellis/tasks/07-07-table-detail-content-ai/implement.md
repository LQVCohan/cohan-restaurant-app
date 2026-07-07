# Implementation plan

1. Add optional `restaurantId`, `activeOnly`, and `showErrorBanner` settings to `usePromotions` without changing existing callers.
2. Simplify `TableActionsLiteModal`: remove coordinate/technical fields, update Vietnamese labels, use correctly scoped promotions, and send authenticated assistant requests with real table context.
3. Add a focused component test for hidden technical fields, promotion scope, and assistant request payload/authentication.
4. Extend the existing backend endpoint test with an authorized success case.
5. Run focused frontend/backend tests, GraphQL validation, and build; review the final diff for unrelated files.
