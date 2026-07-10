# Staff performance action layout

## Current behavior

`StaffManagement` already renders the shared staff header and sub-page navigation. `StaffPerformancePage` added another large hero containing the same page identity plus three actions with different scopes.

## Real flow

- `StaffManagement` maps employees and renders `StaffPerformancePage`.
- Period dates are local state used by `useStaffPerformance`.
- `Kỳ hiện tại` only resets the two date fields.
- `Xuất CSV` exports the currently filtered table rows.
- `Tính lại hiệu suất kỳ này` calls the existing recalculation mutation through `useStaffPerformance`.

No schema, resolver, service, GraphQL operation, permission, or restaurant-scope change is required.

## Root cause

The hero duplicated navigation-level information and grouped unrelated actions by visual convenience rather than by task context. The date reset belongs with period filters; export and recalculation belong with the performance table.

## Scope

- Remove the duplicated performance hero.
- Move `Kỳ hiện tại` into the period filter group.
- Move `Xuất CSV` and `Tính lại hiệu suất kỳ này` into the table header.
- Keep loading, disabled, export, recalculation, filters and data behavior unchanged.
- Keep responsive wrapping, touch targets and visible focus states.

## Acceptance criteria

1. No `.performance-hero` is rendered.
2. The current-period reset appears beside the date controls.
3. Export and recalculation appear in the table header.
4. Buttons preserve existing disabled/loading behavior.
5. Narrow layouts stack controls without horizontal page overflow.
6. No backend or data-contract files change.

## Implementation result

- The duplicated hero was removed from `StaffPerformancePage`.
- The current-period reset now sits with the date and restaurant filters.
- CSV export, loading feedback and full-period recalculation now sit in the performance table header.
- The responsive override reuses manager sage tokens, preserves visible focus, uses 44px mobile targets and honors reduced motion.
- A focused component test verifies the new action locations and the absence of the hero.

## Files

- `StaffPerformancePage.jsx`: relocate actions and remove duplicated hero.
- `StaffPerformanceResponsive.scss`: style the contextual action groups and responsive states.
- `StaffPerformancePage.layout.test.jsx`: verify action placement, hero removal and no-restaurant state.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformancePage.layout.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Browser review at desktop and 390/430px mobile widths.
