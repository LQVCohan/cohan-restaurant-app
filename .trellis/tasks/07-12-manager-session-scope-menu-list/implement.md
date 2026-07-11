# Implementation plan

## Steps

1. Harden `AuthProvider` identity merge and explicit-login cache reset; add account-switch tests.
2. Reuse the business-context query refetch after branch creation; update Brand Management test.
3. Persist manager destinations synchronously and cover the helper with a focused test.
4. Add a lazy grouped menu-item overview query, connect it to the existing menu modal, and render compact dish lists by time slot.
5. Review the final diff for duplicated state, permission drift and unintended backend changes.

## Validation

```bash
npx vitest run \
  src/context/__tests__/AuthProvider.login-race.test.jsx \
  src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx \
  src/layouts/ManagerLayout.navigation.test.js \
  src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx
npm run check:graphql
npm run check:conflicts
npm run build
```

If a runnable checkout is unavailable, leave the pull request as draft and record every check that was not run.
