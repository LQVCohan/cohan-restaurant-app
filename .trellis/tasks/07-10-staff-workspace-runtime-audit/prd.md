# Staff workspace runtime audit

## Problem

Creating a staff account succeeds, but the manager staff page then falls into the application error boundary. The successful mutation response is assigned directly to the UI view model. Structured fields such as `address` therefore reach presentation components that expect flattened strings.

The same workspace also owns attendance, leave, scheduling, performance, and reporting pages. These flows must be checked for current restaurant scope, GraphQL input/output contracts, safe empty/error states, and mutation refresh behavior.

## Acceptance criteria

- A successful add/edit staff mutation never places an unnormalized GraphQL DTO into the employee detail UI.
- The newly created employee may be selected without rendering structured values as React children.
- A regression test covers a create response containing an address object.
- Manager attendance, leave, schedule, performance, and reports pages are traced through their queries/mutations and backend contracts.
- Staff self-service attendance, availability/schedule, and leave request flows are checked where they share the same domain contracts.
- Confirmed defects are fixed on `main`; unaffected flows are documented as verified.
