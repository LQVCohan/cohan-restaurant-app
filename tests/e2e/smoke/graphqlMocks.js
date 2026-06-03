import { TEST_MENU_ITEMS, TEST_RESTAURANT, TEST_USERS } from "./fixtures.js";

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName })).toString("base64url");
  return `smoke.${payload}.token`;
};

const makeCart = (items = []) => ({
  id: "test-cart-1",
  totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
  totalAmount: items.reduce((sum, item) => sum + Number(item.price || item.basePrice || 0) * Number(item.quantity || 1), 0),
  items,
});

const getUser = (authRole) => (authRole ? TEST_USERS[authRole] : null);

export async function installSmokeApiMocks(page, { authRole = null } = {}) {
  const authUser = getUser(authRole);

  await page.route("**/api/auth/refresh", async (route) => {
    if (!authUser) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: jwtLikeToken(authUser.roleName), user: authUser }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/graphql", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    const operationName = payload?.operationName || "";
    const variables = payload?.variables || {};
    const data = buildGraphqlData(operationName, variables, authUser);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

function buildGraphqlData(operationName, variables, authUser) {
  switch (operationName) {
    case "Me":
      return { me: authUser };
    case "GetRestaurants":
    case "ManagerRestaurants":
      return {
        refRestaurants: authUser?.roleName === "customer" ? [TEST_RESTAURANT] : [],
        restaurantsByManager: {
          edges: [{ cursor: TEST_RESTAURANT.id, node: TEST_RESTAURANT }],
          pageInfo: { endCursor: TEST_RESTAURANT.id, hasNextPage: false },
        },
      };
    case "GetTopMenuItems":
      return { topMenuItems: TEST_MENU_ITEMS };
    case "GetTopRestaurants":
      return { restaurantsTop: [TEST_RESTAURANT] };
    case "GetRestaurantsNearby":
      return { restaurantsNearby: [TEST_RESTAURANT] };
    case "GetRestaurantsByCategoryTimeSlot":
      return { restaurantsByCategoryTimeSlot: [TEST_RESTAURANT] };
    case "CustomerMenuItemForFoodDetail":
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
    case "CreateCheckoutOrders":
      return {
        createCheckoutOrders: {
          orders: [{ id: "test-order-1", status: "pending", totalAmount: 79000 }],
          paymentRequest: null,
        },
      };
    default:
      return {};
  }
}

export async function expectNoPageCrash(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible" });
}
