# Design

## Flow traced

- Table persistence and contract: `table.model.js` -> `floor_table.graphql` -> table mutation/query -> `useTableManagement`.
- Promotion data: `Promotion` -> `promotionsByRestaurant` -> `usePromotions` -> modal checkbox list.
- Assistant request: modal button -> authenticated REST request -> `aiRouteGuard` -> `aiTable.service` -> Gemini or existing fallback.

## Minimal design

- Keep coordinate data internal. Remove its form state and payload field from the modal so updates do not overwrite the saved floor-plan position.
- Reuse `usePromotions` with optional restaurant/active-only options instead of creating another query.
- Reuse `toApiUrl` and `getToken`, matching the repository's existing API/auth patterns.
- Build assistant context from the modal's real `tables` prop and include only available tables on the same floor.
- Keep backend AI behavior unchanged; the server already provides deterministic fallback when Gemini is unavailable.
- Add one focused modal test and extend the existing endpoint-auth test.
