# Implementation checklist

- [x] Trace schema, query, mutations, socket and existing bell consumers.
- [x] Add notification recipient dispatcher for managers and active restaurant staff.
- [x] Trigger notification dispatch from customer-request restaurant events.
- [x] Add focused backend tests for recipient notification dispatch and socket emission.
- [x] Refactor POS request queue UI and realtime refresh.
- [x] Add/update focused queue tests.
- [x] Place the request queue in the staff order workspace.
- [x] Make the staff bell global without duplicating it on the order workspace.
- [x] Make bell items navigate to their action URL after marking read.
- [x] Re-fetch changed files and review callers/usages.
- [x] Record test/build status.

## Verification

- Backend lint, tests, menu RBAC and build passed in CI run 8210.
- Frontend lint, menu RBAC, changed component tests, production build and Playwright smoke tests passed in CI run 8210.
- The standard full frontend unit gate still contains an unrelated existing failure in `installTableDetailModalTabs.test.js`; the temporary CI continuation used to verify downstream steps was reverted before review.
- Manual browser review at 390x844 and desktop POS was not run from the GitHub connector environment.
