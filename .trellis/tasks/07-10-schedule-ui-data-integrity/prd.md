# Manager schedule UI and availability data integrity

## Current behavior

The manager schedule page already loads staff, schedule periods, availability windows, and submissions from GraphQL. The screenshots show an interface that is visually dense and a registered-availability modal that can appear empty even when the page is still resolving data.

The audit found these concrete defects:

1. The modal displays submissions for the schedule week, but its loading, error, and manual refresh paths are wired to the next-week registration queries and unrelated lazy queries.
2. Availability windows are matched by exact millisecond timestamps in the page, so equivalent week boundaries with timezone or end-of-day differences can fail to match.
3. Explicit part-time `unavailable` slots are rendered as “not registered”.
4. The missing-registration KPI excludes `probation` and `contract` employees even though the GraphQL contract and modal treat them as registration-based employment types.
5. The header and toolbar duplicate the automatic scheduling action.
6. The final sage stylesheet targets class combinations that are not present in the JSX, so intended action emphasis is not applied.
7. Modal filters expose raw enum values, controls are shorter than the 44 px interaction target, and no-staff/loading/filter-empty states are not clearly separated.

## End-to-end flow

`AvailabilityRegistrationWindow` and `StaffAvailabilitySubmission` Mongoose models → `availability.graphql` → availability query resolvers plus restaurant/role guards → `GET_STAFF_LIST`, `GET_AVAILABILITY_WINDOWS`, and `GET_AVAILABILITY_SUBMISSIONS` in `ScheduleManagement` → current-week data props → `AvailabilitySnapshotModal` → manager opens “Lịch rảnh đã chốt”.

The backend schema, restaurant scoping, role checks, and submission contract are correct. The root causes are in client query wiring, client normalization, and presentation; no backend change is required.

## Visual direction

Compact operational dashboard using the existing sage manager palette, clearer information hierarchy, one automatic-scheduling action, 44 px controls, and a readable data-first availability matrix.

## Implementation

- Match availability periods by calendar date keys instead of exact milliseconds.
- Bind the modal to current-week staff/window/submission loading, error, and refetch states.
- Refresh the same current-week data that the modal actually renders.
- Include all registration-based employment types in the missing-registration KPI.
- Preserve explicit unavailable slots as unavailable.
- Remove the duplicate automatic scheduling action from the header.
- Show Vietnamese filter labels and enum labels, result counts, distinct no-staff/filter-empty/loading/error states, accessible cell labels, and Escape-to-close behavior.
- Replace purple modal accents with existing sage/neutral styling and make controls/touch targets at least 44 px.
- Fix final CSS selectors to match the existing toolbar classes.
- Add focused component coverage for unavailable slots, localized options, empty data, and keyboard dismissal.

## Files

- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.scss`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx`
- `src/styles/schedule-manager-sage-upgrade.css`

## Acceptance criteria

- “Lịch rảnh đã chốt” refreshes and displays staff, windows, and submissions for the week shown in the modal.
- Loading and errors come from those exact queries, not the next-week panel or auto-schedule lazy queries.
- Equivalent week boundaries match despite timezone/end-of-day timestamp differences.
- Part-time unavailable slots display as unavailable, not missing registration.
- Part-time, seasonal, probation, and contract employees are counted consistently.
- The automatic scheduling action appears once in the operational toolbar.
- The modal uses the manager sage language, visible labels, keyboard dismissal, readable states, 44 px controls, and horizontal table scrolling without page overflow.
- Existing restaurant scoping, role permissions, scheduling lifecycle, and backend contracts remain unchanged.
- Focused component tests, conflict check, GraphQL validation, and production build pass.

## Out of scope

- Changing availability approval/status rules.
- Creating registration windows automatically.
- Changing backend permissions or restaurant scoping.
- Adding a component library, dependency, font, or new color system.
- Rewriting the full scheduling page.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx`
- `npm run check:conflicts`
- `npm run check:graphql`
- `npm run build`
- Review the PR diff and GitHub Actions results; authenticated desktop/mobile visual confirmation remains manual when no live browser session is available.
