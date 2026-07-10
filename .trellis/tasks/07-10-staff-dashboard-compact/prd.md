# Compact staff dashboard

## Current behavior

`StaffLayout` already shows the current page, description and signed-in employee. `StaffDashboardPage` repeats the same identity and greeting, then stacks a hero with four links, a shift card, five task reminders, nine action cards, role-specific tools, profile data and four static reminder cards. At phone widths this becomes a very long page with duplicated information and no clear primary action.

## Direction

Compact operational dashboard using the existing sage palette: one primary shift command, concise high-frequency actions, role-specific tools, and native progressive disclosure for secondary utilities.

## Caller flow

`AppRouter /staff/dashboard` -> `StaffLayout` -> `StaffDashboardPage` -> `frontendRoleAccess` role checks -> React Router links to schedule, attendance, leave, notifications, orders, kitchen and account pages.

No schema, resolver, Apollo query or mutation is involved in this screen. The redesign must not invent shift data or change route permissions.

## Files

- `src/components/Staff/StaffDashboardPage.jsx`: remove duplicated identity/static previews and rebuild the information hierarchy.
- `src/components/Staff/StaffDashboardPage.scss`: compact responsive layout using existing tokens and scope the shorter phone shell only while this dashboard is mounted.
- `src/components/Staff/StaffDashboardPage.test.jsx`: assert the new hierarchy and retained links.

## Acceptance criteria

- Dashboard no longer repeats the employee identity or a second oversized page heading.
- The first content block presents one clear action to open the personal schedule.
- Schedule, attendance, leave and notifications remain directly accessible.
- Order and kitchen tools remain role-gated exactly as before.
- Profile, payslips, performance, contacts and settings remain available in a collapsed native details section.
- Phone layout has no one-column chain of large decorative cards and no horizontal overflow.
- Touch targets remain at least 44 px and focus states remain visible.
- No new dependency, API call or backend change.

## Out of scope

- Loading real shift status or notification counts.
- Changing role/permission rules.
- Redesigning other staff subpages.
