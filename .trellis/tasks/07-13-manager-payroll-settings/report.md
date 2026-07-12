# Implementation report

## Delivered

- Added a per-restaurant payroll settings entry to the existing manager payroll workspace instead of creating another sidebar page.
- Added a responsive drawer with loading, error, save, disabled, mobile, keyboard escape and reduced-motion states.
- Managers can update restaurant-operational rules: standard days/hours, lateness and early-leave penalties, unpaid leave deduction, default allowance, paid-leave treatment, weekend days, holiday dates, night window and notes.
- Admin and Accountant retain access to overtime multipliers, default financial adjustments, night allowance and personal income tax settings.
- Backend rejects manager attempts to submit restricted fields even when bypassing the UI.
- Backend validates supported fields, numeric ranges, boolean values, weekend values, holiday values, `HH:mm` night windows and note length before delegating to the existing scoped mutation.
- Existing restaurant access checks and current-period ownership checks remain in the original payroll mutation.
- The UI explains that changed settings affect runtime previews immediately and draft periods after recalculation; finalized, paying, paid and locked snapshots remain unchanged.

## Flow updated

`PayrollSetting -> payroll settings permission -> protected settings validation -> existing updatePayrollSettings resolver -> existing GraphQL query/mutation -> PayrollSettingsControl -> manager payroll route`.

## Regression coverage

The protected payroll mutation test now covers:

- manager operational updates;
- normalization of weekdays and holiday dates;
- manager rejection for advanced financial settings;
- invalid numeric settings rejected before persistence;
- accountant access to advanced settings.

## Validation status

- Reviewed the resulting manager route commit and confirmed it changes only the payroll lazy import.
- Added targeted Vitest regression cases, but they were not executed because the GitHub connector does not provide an executable repository checkout.
- Frontend build, GraphQL operation validation and browser screenshot/smoke testing were not run.
- The latest commit currently has no GitHub Actions status checks or workflow runs.
