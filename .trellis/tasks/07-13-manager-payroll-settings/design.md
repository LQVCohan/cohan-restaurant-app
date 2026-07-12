# Design

## Direction

Compact payroll settings drawer using the existing warm manager payroll surfaces, native form controls, one save action, and progressive disclosure for restricted financial settings.

## Permission model

- `MANAGER`: may call `payroll.settings.update`, but the resolver accepts only operational fields.
- `ADMIN` and `ACCOUNTANT`: may update every existing payroll setting field.
- Restaurant scope remains enforced before reads or writes.

The resolver compares restricted fields against the actor role rather than trusting disabled frontend controls.

## Validation

Normalize and validate only supplied fields:

- work days: 1-31;
- work hours/day: 1-24;
- non-negative monetary values;
- overtime multipliers: 1-5;
- night allowance and tax rates: 0-1;
- `HH:mm` time values;
- weekend values from MON-SUN;
- holiday values normalized to unique `YYYY-MM-DD` strings;
- notes length capped.

## UI behavior

- Settings button stays in the payroll control area next to refresh/export.
- Drawer uses selected restaurant scope and copies fetched settings into local form state when opened.
- Operational settings are always visible.
- Advanced financial settings are shown disabled with an explanation for MANAGER and editable for ADMIN/ACCOUNTANT.
- Saving sends only fields the current role may edit, then refetches settings and displays inline feedback.
- Escape, backdrop click, cancel button and close button dismiss the drawer when no save is in progress.

## Snapshot behavior

The UI states explicitly that changes affect runtime previews and draft periods after recalculation. Finalized, paying, locked and paid snapshots remain unchanged.
