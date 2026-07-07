# Implementation plan

Work on branch `codex/global-search-catalog-chefs` and follow the task PRD and design.

## Sequence

1. Update the shared search resolver first: safe regex handling, shared menu aggregation, public chef aggregation, and existing OWNER permission preservation.
2. Update the GraphQL schema to match the resolver payload.
3. Update Apollo operations and the three UI entry points: HeaderSearch, SearchPage, and MobileHome.
4. Extend focused backend and frontend tests.
5. Run conflict, GraphQL, targeted test, and build checks.

## Constraints

- Reuse existing models and fields.
- Keep recipe notes internal; expose only concise cooking-method labels.
- Use the restaurant contact phone for chef cards; never expose staff personal contact fields.
- Do not add dependencies, a search service, a chef-profile model, or unrelated UI redesign.
- Remove the incorrect `menuItem.restaurant` assumption and use the SearchResult restaurant field.

## Validation commands

- `npm run check:conflicts`
- `npm run check:graphql`
- targeted backend search resolver test
- targeted frontend search component tests
- `npm run build`
