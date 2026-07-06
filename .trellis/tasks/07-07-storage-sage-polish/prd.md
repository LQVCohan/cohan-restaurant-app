# Storage sage polish

## Current behavior

The manager shell and dashboard use a shared sage-green palette through `ManagerUnifiedBackground.css`, but the storage page applies a later warm beige/brown visual override. The storage header, cards, filters, active tabs, and primary actions therefore feel disconnected from the rest of the manager workspace.

## Root cause

`StorageManagement.scss` contains a final storage-specific unification layer with hard-coded brown backgrounds, borders, and dark slate actions. Because that layer is loaded with the storage feature, it overrides the shared manager palette. The inventory data flow itself is correct.

## End-to-end flow

1. `ManagerLayout.jsx` lazy-loads `StorageManagement` for the `inventory` manager page.
2. `StorageManagement.jsx` runs the existing Apollo queries and renders Header, KPI cards, Tabs, and the active storage tab.
3. Child components provide their current semantic classes and behavior.
4. A final page-scoped theme stylesheet reuses `--manager-*` tokens to style the complete storage surface.
5. Existing component tests remain the closest behavior check.

No Mongoose schema, resolver, service, GraphQL operation, Apollo variables, permission guard, audit log, or realtime side effect changes.

## Visual direction

- Soft sage-green manager background with translucent near-white surfaces.
- Dark green primary actions and active tabs.
- Green-tinted secondary controls, focus rings, icon containers, and neutral KPI accents.
- Orange and red remain reserved for warning and danger states.
- Moderate radii and restrained shadows matching the manager dashboard.

## Scope

- Add a final storage theme stylesheet scoped under `.storage-management`.
- Reuse the existing manager palette variables with build-safe fallbacks.
- Restyle the header, filters, KPI cards, tabs, main content panel, storage cards, and interactive states.
- Preserve existing responsive layout and reduced-motion rules.

## Files to change

- `src/components/Dashboard_Manager/Storage/StorageManagement.jsx`: import the final storage theme after the existing storage stylesheet.
- `src/components/Dashboard_Manager/Storage/StorageSageTone.scss`: apply the shared manager sage palette across the storage screen.

## Acceptance criteria

- Storage background flows into the shared manager sage canvas instead of replacing it with beige.
- Header, KPI cards, tabs, toolbars, filters, and content cards use the same green family as Dashboard.
- Warning and danger states remain visually distinct and include existing text/icon labels.
- Buttons, tabs, inputs, and selects retain visible keyboard focus.
- The layout remains usable at existing desktop and mobile breakpoints.
- No inventory behavior, query, permissions, or dependencies change.

## Out of scope

- Changing storage data models or operations.
- Rebuilding the component structure.
- Adding animation libraries, design-system dependencies, or new business features.
- Restyling portal modals rendered outside the storage page root.

## Validation plan

- Run `vitest run src/components/Dashboard_Manager/Storage/StorageManagement.test.jsx`.
- Run `npm run build` when a runnable checkout is available.
- Review desktop and mobile layout visually if screenshot tooling is available.
- Verify the diff contains only the two UI files and task records.
