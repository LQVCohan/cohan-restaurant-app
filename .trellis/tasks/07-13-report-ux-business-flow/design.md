# Design

## Direction

Compact operational COHAN UI using the existing sage manager system and warm customer system: one clear action per surface, progressive disclosure for secondary details, plain Vietnamese feedback and stable URL/data state.

## Implementation boundaries

- Prefer one shared portal/toast/error mapper fix over dialog-specific patches.
- Prefer URL search params or path state already used by the router over hidden hash/local component state.
- Resolve names and current statuses at the GraphQL/service boundary when the UI currently receives only IDs or ambiguous state.
- Keep future reservation availability separate from the active table service state.
- Preserve current server permission gates and send realtime events only to existing scoped audiences.
- Use native buttons, details, tables, horizontal overflow and form validation before new abstractions.

## Responsive and accessibility contract

- 44px primary touch targets; visible keyboard focus and accessible names.
- Dialogs use a portal, viewport-safe `100dvh`, focus containment and scrollable bodies.
- Dense tables/cards favor compact rows and horizontal containment rather than unreadably small text.
- Errors identify the action/field and expose no internal IDs, GraphQL field names or implementation terminology.
- Status uses text/icon in addition to color and respects reduced motion.

## Validation strategy

For each root-cause boundary, add the smallest regression test plus one real caller. Run GraphQL validation for contract changes, targeted Vitest for components/services, build for CSS/route integration and focused Playwright smoke for critical navigation/table-session flows.
