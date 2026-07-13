# PRD

## Current behavior

The previous report pass treated several page 1-5 outcomes as already complete without proving the rendered workflow. On current `main`, the requested capability often exists only as a small control or a read-only view, while the reported UX remains hard to discover or visually unchanged.

- Order detail still uses technical copy, a small status dropdown and a low-emphasis cancellation action instead of a clear kitchen workflow.
- Item detail has the corrected title but retains the old generic information grid and inventory terminology.
- Order history reserves most of the viewport even for one result, and the new-order cart does not provide a prominent table chooser where the operator reviews the order.
- The header opens a read-only menu catalog. It does not clearly lead to the existing create/edit/copy/delete menu workflow, and unassigned items can be repeated across sibling menus in the same time slot.
- Quick stock infers selected rows from partially typed values. Although the payload can contain a subset, the UI still presents every row as required and gives no explicit include/exclude control.
- The table customer panel is injected after the React modal renders and relies on a second DOM observer to be reclassified for the active tab. This timing-sensitive contract is not covered by a late-insertion regression test.
- The table type/space modal uses a large fixed presentation and repeats summary cards, filters and explanatory blocks, leaving too little room for the actual table list at common laptop sizes.

## Acceptance criteria

### Pages 1-2: order operations

- The order modal presents an explicit three-step kitchen status flow with a clear single next action per item.
- Each cancellable item exposes a red `Hủy món` action beside its operational controls; cancellation requires quantity and a human-readable reason and refreshes the selected order.
- Technical labels such as `Timeline`, `POS`, `Note`, raw promotion identifiers and stock deduction wording are replaced with plain Vietnamese.
- Item detail uses the correct dish title, status progress, clear price/quantity summary and user-facing ingredient wording.
- History uses a compact responsive layout without a large empty body.
- The new-order review/cart column contains the table search and clearly blocks saving until a table is chosen.

### Pages 3-4: menus and quick stock

- Menu catalog rows attach only to their actual `menuId`; items without a menu are shown once in a separate unassigned group rather than repeated under sibling menus.
- The catalog exposes an obvious primary route to the full menu-management workflow.
- Quick stock has an explicit include control per row, validates only included rows and submits exactly the selected valid subset.

### Page 5: tables

- The linked-customer panel is visible only in Overview and Linked customers, including when it is inserted after a different tab is already active.
- The table type/space modal prioritizes the searchable list, reduces unused height and remains usable at 390x844, 768, 1024 and 1440 px.

## Constraints

- Start from current `origin/main` and open a new PR.
- Preserve restaurant scoping, permissions, GraphQL contracts, audit/realtime behavior and existing mutations.
- Reuse current React, SCSS, Apollo, modal and manager design tokens; add no dependency.
- Do not alter unrelated report pages.

## Out of scope

- Reworking pages 6-29 of the report.
- New order states, new menu persistence models, new stock accounting rules or a table-management rewrite.
