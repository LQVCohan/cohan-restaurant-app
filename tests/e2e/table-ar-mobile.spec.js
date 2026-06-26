import { test, expect, devices } from "@playwright/test";

const restaurant = {
  __typename: "Restaurant",
  id: "restaurant-1",
  name: "COHAN Demo",
  avatar: "",
  coverImage: "",
  spaceImages: [],
  vrTourUrl: "",
  address: {
    __typename: "Address",
    line1: "1 Demo Street",
    line2: "",
    ward: "",
    district: "Quận 1",
    city: "TP.HCM",
    country: "Việt Nam",
  },
  phone: "0900000000",
  email: "demo@cohan.test",
  featuredMenu: [],
  amenities: [],
  seatingCapacity: 40,
  priceRange: "$$",
  openingHours: "08:00",
  closingHours: "22:00",
  description: "Demo restaurant for AR mobile smoke test",
  notesOnHours: "",
  notesOnAmenities: "",
  cuisineType: "Vietnamese",
  status: "active",
  avgRating: 4.8,
  manager: {
    __typename: "User",
    id: "manager-1",
    fullName: "Manager Demo",
    email: "manager@cohan.test",
  },
  tables: [],
  categories: [],
};

const floors = [
  {
    __typename: "Floor",
    id: "floor-1",
    name: "Tầng 1",
    level: 1,
    description: "",
    planImage: "",
    isActive: true,
    isWatching: false,
    layout: [],
    meta: { __typename: "FloorMeta", width: 2000, height: 1400 },
  },
];

const tables = [
  {
    __typename: "Table",
    id: "table-1",
    code: "A1",
    label: "A1",
    capacity: 4,
    status: "available",
    type: "standard",
    deposit: 0,
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: null,
    tags: [],
    vrUrl: "",
    visualConfig: null,
    restaurantId: "restaurant-1",
    position: {
      __typename: "TablePosition",
      x: 120,
      y: 160,
      w: 70,
      h: 70,
      rotation: 0,
      shape: "rect",
      path: "",
    },
  },
  {
    __typename: "Table",
    id: "table-2",
    code: "VIP-02",
    label: "VIP-02",
    capacity: 6,
    status: "occupied",
    type: "vip",
    deposit: 200000,
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: null,
    tags: ["vip"],
    vrUrl: "",
    visualConfig: null,
    restaurantId: "restaurant-1",
    position: {
      __typename: "TablePosition",
      x: 260,
      y: 160,
      w: 90,
      h: 70,
      rotation: 0,
      shape: "rect",
      path: "",
    },
  },
];

const managerUser = {
  __typename: "User",
  id: "manager-1",
  fullName: "Manager Demo",
  email: "manager@cohan.test",
  phone: "0900000000",
  username: "manager-demo",
  avatarUrl: "",
  roleName: "manager",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
  verifiedAt: "2026-01-01T00:00:00.000Z",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
  wallet: null,
  refRestaurants: [],
  restaurantForStaff: null,
  employmentType: "full_time",
  department: "management",
  positionTitle: "Manager",
};

async function mockBackend(page) {
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "e2e-token", user: managerUser }),
    });
  });

  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    const operationName = body?.operationName || "";
    const dataByOperation = {
      Me: { me: managerUser },
      ManagerRestaurants: {
        restaurantsByManager: {
          __typename: "RestaurantConnection",
          edges: [{ __typename: "RestaurantEdge", cursor: "restaurant-1", node: restaurant }],
          pageInfo: { __typename: "PageInfo", endCursor: null, hasNextPage: false },
        },
      },
      GetRestaurantFull: { restaurant },
      Floors: { floors },
      Tables: { tables },
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataByOperation[operationName] || {} }),
    });
  });
}

test.use({ ...devices["Pixel 5"] });

test.describe("manager table AR mobile smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("foodhub_access_token", "e2e-token");
      window.__lastClipboardText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__lastClipboardText = String(text || "");
          },
        },
      });
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: async () => ({ getTracks: () => [] }) },
      });
      Object.defineProperty(navigator, "xr", {
        configurable: true,
        value: undefined,
      });
    });
    await mockBackend(page);
  });

  test("opens the table manager and copies an AR diagnostic report from the 3D modal", async ({ page }) => {
    await page.goto("/manager#tables");

    await expect(page.getByRole("heading", { name: /Quản lý bàn/i })).toBeVisible();
    await expect(page.getByText("A1")).toBeVisible();
    await expect(page.getByText("VIP-02")).toBeVisible();

    await page.getByRole("button", { name: /Mô phỏng 3D/i }).click();

    await expect(page.getByRole("heading", { name: /Xem thử và bố trí bàn 3D/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Báo cáo test/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chưa chọn bàn/i })).toBeDisabled();

    await page.getByRole("button", { name: /Báo cáo test/i }).click();
    await expect(page.getByText("Đã copy báo cáo")).toBeVisible();

    const report = await page.evaluate(() => JSON.parse(window.__lastClipboardText));
    expect(report.title).toBe("COHAN AR/3D mobile test report");
    expect(report.appState.restaurant).toContain("COHAN");
    expect(report.browser.mediaDevices).toBe(true);
    expect(report.browser.webxr).toBe(false);
  });

  test("opens the concrete table detail flow", async ({ page }) => {
    await page.goto("/manager#tables");
    await expect(page.getByText("A1")).toBeVisible();

    const tableCard = page.locator("article", { hasText: "A1" }).first();
    await tableCard.getByRole("button", { name: /Mở cấu hình bàn A1/i }).click();

    await expect(page.getByRole("heading", { name: /Cấu hình bàn ăn/i })).toBeVisible();
    await expect(page.getByText("Mã bàn:")).toBeVisible();
    await expect(page.getByText("A1").first()).toBeVisible();
  });
});
