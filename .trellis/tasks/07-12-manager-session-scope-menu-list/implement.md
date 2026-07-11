# Implementation plan

## Steps

1. Key the manager route by authenticated account ID and add a remount regression.
2. Switch the shared manager restaurant selector to the live full-brand query already refetched by branch creation.
3. Persist sidebar destinations synchronously and cover hash/local-storage behavior.
4. Add a manager menu catalog modal and expose it only on the menu page.
5. Review the final diff for duplicated state, GraphQL contract drift, permission gaps and unintended files.

## Validation

```bash
npx vitest run \
  src/routes/AppRouter.account-scope.test.jsx \
  src/hooks/useManagerRestaurantSelection.test.jsx \
  src/components/Dashboard_Manager/Sidebar.test.jsx \
  src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.test.jsx
npm run check:graphql
npm run check:conflicts
npm run build
```

If a runnable checkout is unavailable, leave the pull request as draft and record every check that was not run.
