# Table detail content and assistant repair

## Current behavior

- The modal exposes X/Y coordinates and detailed 3D metadata that managers do not need for normal table operations.
- Labels mix Vietnamese with `Tags`, `zone`, `swap code`, `Promotion`, and `VR` terminology.
- `usePromotions()` chooses the first restaurant from `AuthContext` and requests drafts/expired promotions, even when the table belongs to another restaurant.
- Table assistant requests omit the restaurant ID and authentication headers required by `aiRouteGuard`.
- Merge suggestions read `table.tables`, although the real table collection is already passed through the modal's `tables` prop.
- Frontend-generated fallback text hides API failures and makes a failed request appear successful.

## Acceptance criteria

1. X/Y inputs and coordinate summary are absent; existing stored positions remain unchanged.
2. Internal 3D fields such as model key, source, license, placement, and saved timestamp are not shown in the normal detail modal.
3. User-facing wording is natural Vietnamese without unexplained implementation terms.
4. Promotion choices come from the table's restaurant and include only currently valid promotions.
5. Promotion loading, empty, and error states are visible inside the modal.
6. Assistant requests include `restaurantId`, access credentials, the current table, available same-floor tables, and active promotions.
7. API failures show an error instead of a fabricated suggestion.
8. The backend route returns a suggestion when authentication and permissions pass; without Gemini configuration it may use the existing deterministic fallback.
9. Focused frontend and backend tests pass, and the frontend build is attempted.

## Out of scope

- Changing promotion calculation/payment business rules.
- Replacing Gemini or changing prompt strategy.
- Redesigning the entire table-management page.
- Changing persisted table coordinates or floor-plan behavior.
