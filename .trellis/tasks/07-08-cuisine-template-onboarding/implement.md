# Implementation plan

## Files and reasons

- `cohan-restaurant-backend/models/restaurant.model.js`: optional persisted setup state and new-branch defaults.
- `cohan-restaurant-backend/graphql/schema/restaurant.graphql`: setup/template GraphQL contract.
- `cohan-restaurant-backend/graphql/resolvers/restaurant/index.js`: compose the small onboarding resolver without expanding the existing large query/mutation files.
- `cohan-restaurant-backend/graphql/resolvers/restaurant/initialSetup.js`: scoped list/apply/skip resolvers.
- `cohan-restaurant-backend/src/data/restaurantCuisineTemplates.js`: seven versioned template packages.
- `cohan-restaurant-backend/src/services/restaurantCuisineTemplate.service.js`: snapshot construction, import and completion state.
- `src/hooks/useBrandManagement.js`: request setup state with current brand restaurant data.
- `src/components/Dashboard_Manager/Header.jsx`: mount onboarding in the always-present manager shell and follow scope selection events.
- `src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.jsx`: query, select, apply and skip UI.
- `src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.scss`: responsive accessible dialog styles.
- Targeted backend and component tests: prove new-branch defaults, reference remapping, completion/skip guards and modal visibility.

## Validation plan

- `npm run check:graphql`
- targeted backend Vitest test for restaurant cuisine template service/resolver
- targeted React component test for onboarding
- `npm run build`

When connector execution cannot run these commands, review schema/resolver imports, compare the branch diff and rely on GitHub Actions while explicitly reporting the limitation.
