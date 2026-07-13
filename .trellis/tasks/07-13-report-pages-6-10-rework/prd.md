# Report pages 6–10 rework

## Scope from the report

1. Make tables created by the floor-plan designer use predictable names derived from the active floor instead of an opaque AI fallback or a highest-number-only sequence.
2. Stop the restaurant profile from flashing blank while it opens and tighten its information hierarchy.
3. Move the current-location action beside the map and reduce the map footprint.
4. Remove false “data not synchronized” save warnings and use the application toast system for save feedback.
5. Split employee details into compact, keyboard-operable tabs.
6. Compact the attendance-correction modal opened from a row action.
7. Make attendance review cases denser and easier to scan.
8. Make the leave-request modal shorter and less emoji/card-heavy.

## Current behavior and root causes

- Smart-layout tables infer a generic naming pattern from the maximum existing suffix. Missing floor-local codes are never reused and an empty floor falls back to `AI-*`, so generated names do not reliably reflect the floor.
- The restaurant map is injected after React renders by a document-wide `MutationObserver`. Leaflet is also imported by `main.jsx`, delaying the application shell and repeatedly observing map DOM mutations. This causes visible instability and unnecessary work.
- Restaurant save immediately refetches and compares many normalized fields. That second request can be stale or differ only by server normalization, producing a false warning even though `updateRestaurant` already returned the saved entity.
- Employee details render every group in one long rail. Attendance correction renders all optional evidence inputs immediately. Attendance review items use full-width stacked cards. Leave type selection uses eight emoji cards in a tall modal.

## End-to-end flow

- Tables: `Table` / `Floor` models -> table/floor resolvers and restaurant permission guard -> floor-plan GraphQL queries/mutations -> `FloorPlanDesigner` smart-layout/save -> `TableManagement` list -> helper and component tests.
- Restaurant profile: `Restaurant` model -> `updateRestaurant` resolver with `RESTAURANT_WRITE` and restaurant scope -> lazy route and manager page shell -> Apollo detail/update operations -> profile form/map/save action -> component and resolver tests.
- Staff detail: staff GraphQL data -> `useStaffManagement` -> `StaffManagement` -> `EmployeeDashboard` -> `EmployeeDetail`.
- Attendance: attendance/timesheet/correction models and services -> `useAttendanceManagement` operations -> `AttendancePage` reconciliation and modal -> component/service tests.
- Leave: staff leave resolver and membership/role checks -> `useLeaveManagement` -> `LeaveManagement` modal -> `LeaveRequestForm` -> component tests.

## Acceptance criteria

- A smart layout on floor 3 creates the first available `T3xx` code (for example `T301`) and never duplicates an existing table code; existing real table names are preserved.
- Opening the restaurant profile does not install a global map observer or load Leaflet in the application entry chunk.
- The map is rendered by React only inside the address tab, has a compact height, and includes the current-location action in its header.
- Saving trusts the successful mutation payload, updates the clean baseline, and reports success/error through the application toast without a redundant immediate consistency warning.
- Employee detail offers Contact, Work, and Account tabs with native tab semantics, visible focus, and a reset when another employee is selected.
- Attendance correction keeps required fields visible and moves optional evidence into progressive disclosure; header, summary, body, and actions fit a normal desktop viewport and remain usable on mobile.
- Attendance review cases use a compact responsive grid without hiding any case.
- The manager leave modal uses a concise native leave-type selector, a narrower shell, and no emoji type-card grid; the staff step-by-step form remains functional.
- No GraphQL schema, permission, restaurant scope, audit, or realtime behavior regresses.
- Targeted tests, conflict check, GraphQL check, lint, and production build pass.

## Out of scope

- Renaming existing persisted table codes.
- Changing restaurant, attendance, or leave authorization rules.
- Replacing Ant Design, Leaflet, or the shared modal/notification systems.
- Redesigning staff pages outside the report screenshots.

## Validation plan

- Targeted Vitest for floor-plan helpers, restaurant profile, employee detail, attendance, and leave request.
- Backend restaurant mutation tests if backend code changes (none planned).
- `npm run check:conflicts`, `npm run check:graphql`, changed component tests, lint, and `npm run build`.
- Review responsive CSS at 390×844, 430×932, tablet, and desktop; run the repository smoke workflow in PR CI.
