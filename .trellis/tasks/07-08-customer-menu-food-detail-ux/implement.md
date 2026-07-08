# Implementation plan

1. Align the live-state GraphQL input/output contract and preserve the existing stock/hold calculations.
2. Make active applicable modifier groups public while retaining permission checks for inactive/internal data.
3. Extend cart schema/model/resolver output with validated modifier snapshots and server-authoritative pricing.
4. Preserve modifier IDs through checkout so existing order-item hydration applies price and inventory rules.
5. Add safe ingredient-name resolution from Recipe/Ingredient.
6. Replace the customer food-detail route with `FoodDetailV2` using existing contexts, Apollo operations and SCSS conventions.
7. Replace the customer menu list/card implementations to keep details viewable when ordering is paused and to improve search, price and status copy.
8. Add focused backend/frontend regression tests.
9. Run conflict, GraphQL, targeted test and build checks; review the diff for contract drift and duplicated logic.
