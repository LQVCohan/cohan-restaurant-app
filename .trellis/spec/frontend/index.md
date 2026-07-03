# COHAN Frontend Specification

## Scope

Applies to React/Vite components, Apollo Client operations and hooks, route guards, shared UI utilities, SCSS, Vitest, and Playwright tests.

## Pre-development checklist

- Find the GraphQL fragment/query/mutation that supplies or changes the UI state.
- Trace hook -> page/container -> modal/component -> user action.
- Check loading, empty, success, error, permission-denied, and retry states.
- Reuse existing common components, hooks, notifications, and mutation-error mapping.
- Inspect optimistic cache updates and refetch behavior before changing a mutation.

## UI and state rules

- Do not duplicate server truth in unrelated local state.
- Keep form state local; keep shared server state in Apollo unless an established repository pattern says otherwise.
- Preserve accessibility basics: labels, keyboard actions, focus behavior, button types, and meaningful error text.
- Reuse existing responsive and dashboard patterns instead of introducing a new design system.
- Avoid adding a dependency for behavior covered by React, the browser, or an installed package.

## GraphQL rules

- Fragments must request every field used by the component and cache update.
- Optimistic responses must match the GraphQL type and fragment shape.
- Map stable backend error codes to field or action feedback; do not parse generic strings when a code exists.
- Refetch only when a precise cache update is not reliable or an existing flow already uses refetch.

## Quality check

- Add or update the smallest component/hook test that proves the changed behavior.
- Run targeted Vitest tests, GraphQL operation validation, and the relevant Playwright test for critical user flows.
- Verify mobile behavior for customer, table, AR, and staff-facing screens when affected.
