# Restore backend dependency installation in CI

## Current behavior and root cause

Both GitHub Actions jobs run backend `npm ci` before lint and tests. The backend `package.json` declares `mongoose-lean-virtuals` as `^0.8.0`, while the committed lockfile root manifest records `^2.0.0`. `npm ci` rejects this manifest/lockfile drift, so neither frontend nor backend tests start.

## End-to-end flow

`cohan-restaurant-backend/package.json` + `package-lock.json` -> frontend CI backend-schema install and backend CI dependency install -> lint/tests/build.

## Scope

- Align the stale `mongoose-lean-virtuals` declaration in `package.json` with the existing lockfile.
- Keep runtime staff logic and the tests introduced by PR #1272 unchanged.
- Let the existing CI workflow verify installation and test execution.

## Constraints

- Do not regenerate or broadly rewrite the lockfile.
- Do not change dependency code, GraphQL contracts, staff logic, or test assertions.
- Do not add dependencies.

## Acceptance criteria

1. Backend `package.json` and lockfile root manifest declare the same `mongoose-lean-virtuals` range.
2. Frontend and backend CI jobs pass their backend dependency installation step.
3. CI proceeds to the existing lint/test/build steps.

## Validation plan

- Review the one-line manifest diff against the lockfile root dependency entry.
- Open a separate PR and inspect both CI jobs.
- Record any test failures that occur after installation separately rather than masking them here.

## Out of scope

- Updating package versions beyond the existing lockfile.
- Fixing unrelated test-suite failures.
- Changing PR #1272 runtime implementation.
