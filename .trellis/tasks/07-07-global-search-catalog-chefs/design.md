# Design

## End-to-end flow

`MenuItem / Category / Recipe / Staff / Restaurant`  
→ shared search resolver helpers  
→ `search.graphql`  
→ Apollo `SEARCH_SUGGESTIONS` / `SEARCH`  
→ `HeaderSearch` / `SearchPage` / mobile Home submit  
→ focused backend and component tests.

## Backend

### Safe matching

Use one local `escapeRegex`/`toSafeRegex` helper for every user-provided search, city, and district value. Phone matching uses normalized digits only.

### Menu aggregation

Reuse one aggregation builder for suggestions and full search:

1. Match `status: available`.
2. Lookup active menu, public restaurant, category, and active recipe.
3. Build searchable string fields for numeric serving values.
4. Match against menu fields, category name, serving fields, variant fields, and recipe notes.
5. Project only customer-safe metadata.
6. Convert recipe notes into concise cooking-method labels; never return recipe notes.

### Chef aggregation

Query the Staff discriminator with these constraints:

- `userType: STAFF`;
- active account and working employment state;
- kitchen department;
- role slug `chef` or a chef/head-chef position title;
- assigned restaurant is public/active.

Search only chef name/title/role, restaurant name, and restaurant public phone. Return name, title, avatar, restaurant identity/name, and restaurant contact phone.

### Search result contract

Add `CHEF` to `SearchEntityType`. Add a dedicated customer-safe chef type. For menu results, put the associated restaurant on `SearchResult.restaurant` rather than inventing an undeclared `MenuItem.restaurant` field. Add result-level `categoryName`, `servingLabel`, and `cookingMethods`.

## Frontend

- Suggestions render chef items and enrich dish subtitles with category, serving, and cooking metadata.
- SearchPage adds Chef and Location tabs, renders safe chef cards, reads menu restaurant from `item.restaurant`, and shows menu metadata.
- Mobile Home sends any non-empty keyword to `/search?q=...` so the same resolver handles restaurants and dishes.

## Validation

- Backend resolver test: regex safety, category/portion/cooking joins, safe chef payload, OWNER permissions.
- Frontend component test: mobile submit route and full search result navigation/metadata where practical.
- Commands: `npm run check:graphql`, targeted Vitest files, `npm run build`, and `npm run check:conflicts`.
