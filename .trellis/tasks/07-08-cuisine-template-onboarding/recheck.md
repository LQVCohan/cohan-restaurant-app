# Pre-test recheck

- Verified model chain: `MenuItem.menuId -> Menu`, `Recipe.menuItemId -> MenuItem`, and `Recipe.servingVariants.ingredients[].ingredientId -> Ingredient`.
- Verified importer order: menu/category/items, then ingredients, then recipes.
- Found manager shell reads restaurants from `AuthProvider.scopedRestaurants`, while that query did not request `initialSetup`; the onboarding modal could therefore remain hidden before user testing.
- Minimal follow-up: add `initialSetup` to the authenticated business-context query and add a regression assertion.
