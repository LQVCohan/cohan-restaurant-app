# Inventory audit UI redesign

## Current behavior

The inventory tab renders every workflow as one long vertical page. Summary cards, count creation, count execution, stock overview, document reconciliation, and movement history compete for attention. On narrow screens, tables remain desktop-first and secondary lists become dense single-column blocks.

## Scope

- Redesign the complete inventory audit tab without changing GraphQL operations or business rules.
- Clarify the order of work: review health -> create/select count -> enter actual quantities -> close count -> reconcile documents -> inspect movements.
- Improve loading, error, empty, keyboard-focus, and responsive states.
- Keep the existing React, Apollo, Lucide, and SCSS stack.

## Acceptance criteria

- Important stock alerts are immediately visible and distinguishable without relying only on color.
- The active inventory count exposes period, status, completion, variance, and close action in one control area.
- Stock filters and sort labels use clear Vietnamese copy.
- Inventory and count tables remain usable on desktop and become readable cards on phone widths.
- Document reconciliation and movement history have stable, aligned information structures.
- Existing queries and mutations continue to receive the same variables.
- Reduced-motion and visible keyboard focus are preserved.

## Out of scope

- Backend, GraphQL schema, permissions, inventory calculations, or database changes.
- Redesigning ingredient, supply, or recipe tabs.
- Adding dependencies or a new component system.

## Validation

- Review JSX and SCSS diff for query/mutation contract drift.
- Run the narrowest available component test and build when a runtime is available.
- Manually inspect 1440px, 900px, 430x932, and 390x844 layouts when a browser runtime is available.
