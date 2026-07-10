# Staff performance action layout

## Current behavior

`StaffManagement` already renders the shared staff header and sub-page navigation. `StaffPerformancePage` adds another large hero containing the same page identity plus three actions with different scopes.

## Real flow

- `StaffManagement` maps employees and renders `StaffPerformancePage`.
- Period dates are local state used by `useStaffPerformance`.
- `Kỳ hiện tại` only resets the two date fields.
- `Xuất CSV` exports the currently filtered table rows.
- `Tính lại hiệu suất kỳ này` calls the existing recalculation mutation through `useStaffPerformance`.

No schema, resolver, service, GraphQL operation, permission, or restaurant-scope change is required.

## Root cause

The hero duplicates navigation-level information and groups unrelated actions by visual convenience rather than by task context. The date reset belongs with period filters; export and recalculation belong with the performance table.

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

## Files

- `StaffPerformancePage.jsx`: relocate actions and remove duplicated hero.
- `StaffPerformancePage.scss`: style contextual controls and table actions.
- `StaffPerformanceResponsive.scss`: remove obsolete hero rules and adapt new action groups.
- `StaffPerformancePage.layout.test.jsx`: verify action placement and hero removal.
