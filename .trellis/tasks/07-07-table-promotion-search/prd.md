# Table promotion search

## Current behavior

The table detail modal lists all active promotions for the selected restaurant but has no search control. As the list grows, managers must scan every checkbox manually.

## Flow traced

`Promotion model -> promotionsByRestaurant -> usePromotions(activeOnly) -> TableActionsLiteModal -> promotion checkbox selection -> updateTable.promotionIds`

The server query and saved promotion IDs are already correct. The missing behavior is local filtering in the modal.

## Acceptance criteria

1. Add an explicitly labelled search input above the active promotion list.
2. Match promotion name or code, ignoring case and Vietnamese diacritics.
3. Show a useful no-results state.
4. Searching must not add, remove, or reset selected promotion IDs.
5. Do not change GraphQL, backend promotion rules, or table mutation contracts.
6. Add focused component coverage and run the smallest relevant test and build.

## Files changing

- `src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx`: search state, local filtering, input, count, and no-results UI.
- `src/components/Dashboard_Manager/Table/TableActionsLiteModal.test.jsx`: regression coverage for name/code filtering and preserved selection.
