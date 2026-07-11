# Print management UI refresh

## Current behavior and UX problems

- The page already has the correct restaurant scope, permissions and queue behavior, but the presentation is visually dense and several sections compete at the same hierarchy level.
- The static workflow strip consumes vertical space without helping the user identify the current operational priority.
- Devices, routing, templates and jobs use similar card treatments, so failed jobs and unassigned stations are not visually prominent enough.
- Icon-only device actions are 38px in the base stylesheet, below the preferred 44px touch target.
- Desktop scroll regions and mobile stacking need clearer spacing, stronger section rhythm and safer overflow behavior.
- The page mixes the older brown base surface with the newer sage polish; the final layer should unify the page without changing the component contract.

## Real flow and preserved boundaries

1. `ManagerLayout.jsx` lazy-loads `PrintManagement.jsx` for the `print-management` page.
2. `PrintManagement.jsx` reads the canonical restaurant scope, queries print settings, enforces read-only/write UI states and renders devices, station routing, templates and print jobs.
3. `PrintManagement.scss` provides the base layout and component states.
4. `PrintManagementPolish.scss` is imported last and is the intended visual override boundary.
5. Existing component tests protect canonical scope, read-only controls and status wording.

## Visual direction

Compact operational dashboard using warm neutral surfaces, sage status accents, stronger section hierarchy, denser desktop information and touch-safe mobile controls.

## Files changing and why

- `src/components/Dashboard_Manager/PrintManagement/PrintManagementPolish.scss`
  - Rework the final visual layer only: page shell, process ribbon, cards, device rows, routing rows, templates, job timeline, focus states and responsive behavior.
- `.trellis/tasks/07-12-print-management-ui-refresh/task.json`
  - Record scope and validation status.
- `.trellis/tasks/07-12-print-management-ui-refresh/prd.md`
  - Record the audit, direction, constraints and acceptance criteria.

## Acceptance criteria

- The four operational areas are immediately distinguishable without changing their React behavior.
- Failed print jobs, offline devices and unassigned stations are easier to scan than normal states.
- Primary and destructive actions remain visually distinct and disabled/read-only states remain understandable.
- Interactive targets are at least 44px where used as icon-only controls.
- The page has no horizontal overflow at phone widths and stacks in a logical order.
- Desktop remains compact and useful at 1024–1440px without hiding important actions.
- Focus indicators and reduced-motion behavior remain visible and supported.
- No GraphQL operation, permission rule, queue mutation, dependency or component API changes.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/PrintManagement/PrintManagement.test.jsx`
- `npm run build`
- Manual review at 390x844, 430x932, 768px, 1024px and 1440px.

## Out of scope

- Real printer discovery, LAN handshakes or print-agent implementation.
- New tabs, filters, pagination or queue persistence changes.
- Rewriting `ManagementPageHeader` or the printer settings modal.
- Changing the existing manager color system or adding a design dependency.
