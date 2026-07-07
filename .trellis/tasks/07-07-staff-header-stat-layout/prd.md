# Staff header stat layout

## Current behavior

The staff header keeps four metric cards in a fixed row inside a narrow middle column. The manager sidebar reduces the page width without triggering the viewport breakpoint, so metric labels are clipped or overlap nearby content.

## Scope

- Make metric cards respond to the width available inside the header.
- Allow Vietnamese labels and suffixes to wrap safely.
- Keep the existing header hierarchy, actions, data, and navigation.

## Acceptance criteria

- Metric text does not overlap another card or the controls area.
- Four metrics form fewer columns automatically when space is limited.
- Labels remain readable instead of being hidden with ellipsis.
- No GraphQL, staff data, permission, or action behavior changes.

## Validation

- Run the narrowest available frontend build or SCSS compilation check.
- Inspect desktop and narrow manager layouts.

## Out of scope

- Changing staff statistics or queries.
- Redesigning the staff list and detail panels.
