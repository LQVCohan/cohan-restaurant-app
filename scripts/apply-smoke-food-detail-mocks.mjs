import fs from "node:fs";

const path = "tests/e2e/smoke/graphqlMocks.js";
const source = fs.readFileSync(path, "utf8");
const oldBlock = `    case "CustomerMenuItemForFoodDetail":
      return { customerMenuItem: TEST_MENU_ITEMS.find((item) => item.id === variables.id) || TEST_MENU_ITEMS[0] };
    case "GetMenuItemsForFoodDetail":
      return {
        menuItemsConnection: {
          edges: TEST_MENU_ITEMS.map((node) => ({ node })),
          pageInfo: { endCursor: TEST_MENU_ITEMS.at(-1).id, hasNextPage: false },
        },
      };
    case "PublicRestaurantByIdForFoodDetail":
      return { publicRestaurant: TEST_RESTAURANT };
    case "GetFoodReviewsForFoodDetail":
      return { reviews: { items: [] } };
    case "MenuItemLiveState":
      return {
        menuItemLiveState: {
          viewerCount: 1,
          maxAvailableQty: 20,
          outOfStock: false,
          blocked: false,
          blockedUntil: null,
          abuseWarning: null,
          policyMessage: null,
          holdTtlSeconds: 600,
          myCartQty: 0,
          myHoldExpiresAt: null,
          reservedCartQty: 0,
        },
      };
    case "AddCartItem":
    case "AddCartItemFromHome": {
      const input = variables.input || {};
      const menuItem = TEST_MENU_ITEMS.find((item) => item.id === input.menuItemId) || TEST_MENU_ITEMS[0];
      return {
        addCartItem: makeCart([
          {
            id: "test-cart-item-1",
            restaurantId: input.restaurantId || menuItem.restaurantId,
            menuItemId: input.menuItemId || menuItem.id,
            name: menuItem.name,
            price: menuItem.basePrice,
            quantity: input.quantity || 1,
            thumbImage: menuItem.thumbImage,
            note: input.note || null,
            servingVariantKey: input.servingVariantKey || "regular",
            holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            holdStatus: "active",
          },
        ]),
      };
    }
`;

const newBlock = `    case "MeFoodPreferences":
      return { me: authUser };
    case "MyActiveCustomerCartForContext":
      return { myCart: null };
    case "ActiveMenuPromotions":
      return { promotionsByRestaurant: [] };
    case "CustomerFoodDetailV2":
    case "CustomerMenuItemForFoodDetail": {
      const menuItem =
        TEST_MENU_ITEMS.find((item) => item.id === variables.id) ||
        TEST_MENU_ITEMS[0];
      return {
        customerMenuItem: {
          ...menuItem,
          defaultServingKey:
            menuItem.defaultServingKey || menuItem.servingVariants?.[0]?.key || "portion",
          ingredientNames: menuItem.ingredientNames || ["Nguyên liệu smoke test"],
          foodType: menuItem.foodType || "NON_VEGETARIAN",
          meatTypes: menuItem.meatTypes || [],
          servingPortion: menuItem.servingPortion || 1,
          servingUnit: menuItem.servingUnit || "phần",
        },
      };
    }
    case "GetMenuItemsForFoodDetail":
      return {
        menuItemsConnection: {
          edges: TEST_MENU_ITEMS.map((node) => ({ node })),
          pageInfo: { endCursor: TEST_MENU_ITEMS.at(-1).id, hasNextPage: false },
        },
      };
    case "PublicRestaurantForFoodDetailV2":
    case "PublicRestaurantByIdForFoodDetail":
      return { publicRestaurant: TEST_RESTAURANT };
    case "CustomerModifierGroupsForFoodDetail":
      return { customerModifierGroups: [] };
    case "FoodReviewSummaryV2":
      return {
        reviewStats: { total: 0, avgRating: 0 },
        reviews: { total: 0, items: [] },
      };
    case "GetFoodReviewsForFoodDetail":
      return { reviews: { total: 0, items: [] } };
    case "MyFoodFavoritesForFoodDetailV2":
      return { myFavorites: [] };
    case "ToggleFavoriteForFoodDetailV2":
      return {
        toggleFavorite: {
          id: "smoke-favorite-1",
          type: "food",
          targetId: variables.input?.targetId || TEST_MENU_ITEMS[0].id,
        },
      };
    case "MenuItemLiveStateForFoodDetailV2":
    case "MenuItemLiveState":
      return {
        menuItemLiveState: {
          itemType: "MENU_ITEM",
          viewerCount: 1,
          maxAvailableQty: 20,
          outOfStock: false,
          blocked: false,
          blockedUntil: null,
          abuseWarning: null,
          policyMessage: "Smoke inventory policy",
          holdTtlSeconds: 600,
          myCartQty: 0,
          myHoldExpiresAt: null,
          reservedCartQty: 0,
        },
      };
    case "AddCartItemFromFoodDetailV2":
    case "AddCartItem":
    case "AddCartItemFromHome": {
      const input = variables.input || {};
      const menuItem = TEST_MENU_ITEMS.find((item) => item.id === input.menuItemId) || TEST_MENU_ITEMS[0];
      return {
        addCartItem: makeCart([
          {
            id: "test-cart-item-1",
            itemType: "MENU_ITEM",
            restaurantId: input.restaurantId || menuItem.restaurantId,
            menuItemId: input.menuItemId || menuItem.id,
            name: menuItem.name,
            price: menuItem.basePrice,
            modifiersPrice: 0,
            modifiers: [],
            quantity: input.quantity || 1,
            thumbImage: menuItem.thumbImage,
            note: input.note || null,
            servingVariantKey: input.servingVariantKey || "regular",
            holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            holdStatus: "active",
          },
        ]),
      };
    }
`;

if (!source.includes(oldBlock)) {
  throw new Error("Food-detail smoke mock block no longer matches the latest file.");
}

fs.writeFileSync(path, source.replace(oldBlock, newBlock));
fs.rmSync("scripts/apply-smoke-food-detail-mocks.mjs");
fs.rmSync(".github/workflows/apply-smoke-food-detail-mocks.yml");
console.log("Applied current food-detail smoke GraphQL mocks.");
