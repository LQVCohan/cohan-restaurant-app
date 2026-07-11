# Implementation plan

## Runtime files

1. `cohan-restaurant-backend/graphql/resolvers/table/mutation.js`
   - scope floor lookup by restaurant during table creation;
   - make code swap transactional;
   - reject self-swap;
   - await and correct audit logging.
2. `cohan-restaurant-backend/graphql/resolvers/table/query.js`
   - escape literal search input;
   - clamp list limits to 1–500.
3. `src/hooks/useTableManagement.js`
   - remove incomplete update and move optimistic responses;
   - preserve authoritative cache update handlers.

## Test files

1. `cohan-restaurant-backend/tests/resolvers/table-management-core-audit.test.js`
   - new focused backend regression coverage.
2. `src/hooks/useTableManagement.test.jsx`
   - assert safe mutation configuration while preserving merge/split and realtime behavior.

## Verification commands

```bash
npm --prefix cohan-restaurant-backend test -- tests/resolvers/table-management-core-audit.test.js tests/resolvers/table-restaurant-access.test.js tests/resolvers/table-merge-composite.test.js
npx vitest run src/hooks/useTableManagement.test.jsx src/hooks/useTableManagement.360Only.test.js
npm run check:graphql
npm run build
```

## Review checklist

- No schema change.
- No 3D/AR flow restored.
- No new dependency.
- No duplicated UI guard added.
- Restaurant scope, permission, state guard, audit and cache contracts remain aligned.
