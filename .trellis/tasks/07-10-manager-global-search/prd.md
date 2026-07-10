# Manager global search upgrade

## Current behavior

- The manager header search receives only top-level entries from `PAGE_CONFIG`.
- Search matching is accent-sensitive and only checks direct substrings.
- Nested functions such as `Kho hàng > Công thức` are absent from the index.
- Selecting a result calls `setCurrentPage` directly, so destination query such as `tab=recipes` cannot reach the target screen.
- `StorageManagement` always initializes at `ingredients` and does not consume manager navigation query state.

## Root cause and flow

`ManagerLayout.PAGE_CONFIG -> managerSearchItems -> Header -> SearchBox -> onSelectSearchResult -> setCurrentPage`

The target inventory flow is:

`ManagerLayout search result { page: inventory, query: { tab: recipes } } -> manager:navigate -> canonical manager URL -> StorageManagement activeTab -> RecipeList`

No schema, resolver, service, or GraphQL change is required because the feature indexes static manager capabilities and reuses existing page permissions.

## Scope

- Keep every top-level manager page searchable.
- Add a permission-scoped nested feature catalog for operational tabs, including all four inventory tabs and all transaction-control tabs.
- Show a readable breadcrumb such as `Kho hàng › Công thức` in each nested result.
- Match Vietnamese text with or without diacritics and support multi-word queries.
- Open nested results through the existing `manager:navigate` event and preserve query parameters.
- Make `StorageManagement` accept a valid `tab` from the URL and from `manager:navigation-query`.
- Keep invalid tabs and inaccessible pages from being opened.

## Acceptance criteria

1. Searching `công thức` or `cong thuc` returns `Công thức` with path `Kho hàng › Công thức`.
2. Selecting that result opens the manager inventory page directly on the recipe tab.
3. Searching top-level pages continues to work.
4. Results are limited to pages in `allowedPages`; nested entries never bypass permission checks.
5. Keyboard navigation and regex-safe highlighting continue to work.
6. Invalid inventory tab values fall back to `Nguyên liệu`.
7. Targeted component tests cover accent-insensitive search, breadcrumb rendering, deep navigation payload, URL initialization, and internal navigation events.

## Out of scope

- Searching live restaurant records, orders, recipes, customers, or database content by name.
- Adding a backend full-text search service or search index dependency.
- Redesigning the manager header outside the search result dropdown.

## Validation plan

- Targeted Vitest for `SearchBox`.
- Targeted Vitest for `StorageManagement`.
- Static test for the `ManagerLayout` search catalog and navigation payload.
- Run broader build/GraphQL checks only if the environment exposes runtime execution.
