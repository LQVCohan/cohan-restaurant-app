# Staff header stat layout

## Current behavior

The staff header keeps four metric cards in a fixed row inside a narrow middle column. The effective styles come from `StaffPremiumBoard.scss`, which is imported after the header component styles and therefore overrides the earlier responsive correction.

That stylesheet also forces a maximum card height, single-line labels and suffixes, hides suffixes below 1320px, and positions the collapse button over the top-right control area. As a result, some headings or values are clipped and the collapse button can cover the search field.

## Flow

`StaffManagement.jsx` imports `StaffHeader` and then `StaffPremiumBoard.scss` -> `StaffHeader.jsx` passes stats and controls to `ManagementPageHeader` -> `ManagementPageHeader.jsx` renders `.mph-stats-grid`, `.mph-controls-row`, and `.mph-toggle` -> the last-loaded staff board stylesheet controls the final layout.

## Files changing

- `src/components/Dashboard_Manager/Staff/StaffPremiumBoard.scss`: correct the effective stat and toggle layout at the last overriding stylesheet.

## Scope

- Make metric cards respond to the width available inside the header.
- Allow Vietnamese labels, values, and suffixes to wrap safely.
- Keep the collapse button clear of the search field.
- Keep the existing header hierarchy, actions, data, and navigation.

## Acceptance criteria

- Metric text does not overlap another card or the controls area.
- Four metrics form fewer columns automatically when space is limited.
- Labels and suffixes remain readable instead of being hidden or ellipsized.
- The collapse button does not cover a search or select control.
- No GraphQL, staff data, permission, or action behavior changes.

## Validation

- Run the narrowest available frontend build or SCSS compilation check.
- Inspect desktop and narrow manager layouts.

## Out of scope

- Changing staff statistics or queries.
- Redesigning the staff list and detail panels.
