# Repair frontend test conflicts and async leaks

## Root causes

1. The old PR branch diverged far behind `main`, so merging produced duplicate mocks and conflict markers in `AuthProvider.test.jsx`.
2. Restaurant selection was reconciled before the current Brand/restaurant scope finished loading.
3. Several DOM enhancement tests replaced browser globals or installed listeners/observers without restoring them, causing Vitest workers to remain alive.
4. Restaurant cuisine onboarding replaced `requestAnimationFrame` with a real timeout, which `--detectAsyncLeaks` reported and eventually drove the component worker into an out-of-memory failure.
5. Native HTML validation blocked the Settings submit handler before the accessible custom validation could run.
6. Promotion search did not normalize Vietnamese `đ` to `d`, and the empty-state test queried through classes intentionally removed by cleanup.

## Scope

- Keep the PR compatible with current `main` and remove conflict markers.
- Delay restaurant selection reconciliation until `brandScopeLoading` is false.
- Add deterministic teardown for DOM enhancement test globals, listeners, observers, DOM and route state.
- Stub onboarding animation frames synchronously and restore them after each test.
- Route Settings submits through the existing custom validator with `noValidate`.
- Normalize `đ` in promotion search and assert the surviving empty-state DOM.

## Constraints

- Preserve the current GraphQL contracts and latest Brand context implementation from `main`.
- Do not reduce worker count, disable leak detection, or remove failing tests to make CI pass.
- Do not duplicate fixes already present on `main`.
- Do not retain temporary diagnostic workflows.

## Acceptance criteria

1. PR #1279 has no conflict markers and GitHub reports it mergeable.
2. Frontend unit tests finish without hanging workers.
3. Changed and full component tests pass with `--detectAsyncLeaks`.
4. Backend tests run against the latest `main`, including the current `Table.updateOne` mock contract.
5. Backend/frontend lint and builds pass.
6. Temporary diagnostic workflows are absent from the final diff.
