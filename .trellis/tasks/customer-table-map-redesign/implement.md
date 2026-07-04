# Implementation plan

1. Keep GraphQL operations, table-lock behavior and booking modal flow unchanged.
2. Add derived current-floor statistics in `TableBooking.jsx` and restructure only presentation markup.
3. Replace the final product CSS layer with one cohesive visual system; leave legacy SCSS as the base to avoid a broad rewrite.
4. Update `FloorMap.jsx` to Pointer Events and keyboard-operable table controls; remove the duplicate inner legend.
5. Restyle `FloorMap.scss` around the existing layout types and table statuses.
6. Add one focused component test covering accessible table names, keyboard selection and unavailable-table behavior.
7. Run targeted Vitest, conflict check and build; then review desktop and mobile smoke states.
