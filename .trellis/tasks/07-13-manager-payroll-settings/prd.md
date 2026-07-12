# PRD

## Current behavior

Payroll settings already persist per restaurant and are exposed through GraphQL, but the manager payroll screen has no settings UI. The backend permission currently allows only ADMIN and ACCOUNTANT, and the mutation accepts values without domain validation.

## Root cause

The cross-layer contract stops at the Apollo hook: model -> resolver -> GraphQL operation exists, but no UI action consumes it. Permission is all-or-nothing, so MANAGER cannot safely edit only restaurant-operational fields.

## Flow

`PayrollSetting model -> updatePayrollSettings resolver + payroll permission guard -> usePayroll query/mutation -> PayrollManagement settings drawer -> mutation access tests`.

## Scope

- Add a compact settings drawer inside the existing payroll page, scoped to the selected restaurant.
- Allow MANAGER to update operational settings only.
- Keep financial/legal settings restricted to ADMIN or ACCOUNTANT.
- Validate numeric ranges, time format, weekend values and holiday dates before persistence.
- Explain that saved settings affect previews and draft periods after recalculation, not finalized/locked/paid snapshots.

## Manager-editable fields

- standard work days and hours;
- lateness and early-leave penalties;
- unpaid leave deduction;
- default allowance;
- whether paid leave counts as payable workdays;
- weekend days and holiday dates;
- night shift start/end;
- notes.

## Restricted fields

- current payroll period;
- overtime multipliers;
- default bonus/default deduction;
- night allowance rate;
- personal income tax settings;
- timezone.

## Acceptance criteria

- Settings load and save for the selected restaurant.
- MANAGER cannot modify restricted fields even through a handcrafted mutation.
- ADMIN/ACCOUNTANT retain full update access.
- Invalid values fail before database write with a clear message.
- Form has loading, error, success, disabled and mobile states.
- Saving refreshes the settings query and does not silently recalculate finalized payroll data.

## Out of scope

- New sidebar route.
- Legal-policy automation or external tax tables.
- Changing finalized, locked or paid payroll snapshots automatically.
