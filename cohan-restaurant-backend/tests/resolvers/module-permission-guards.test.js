import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../src/services/auth/authorization.service.js";
const modelMocks = vi.hoisted(() => ({
  Restaurant: {
    exists: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);

const RESTAURANT_ID = "rest-main-1";
const OTHER_RESTAURANT_ID = "rest-other-1";

function role(slug, permissions = []) {
  return {
    slug,
    parentRole: { permissions: [] },
    permissions: permissions.map((code) => ({ code })),
  };
}

describe("module permission guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(false);
  });

  it("allows a manager with module permission inside restaurant scope", async () => {
    const ctx = {
      user: {
        id: "manager-1",
        roleName: "manager",
        role: role("manager", [PERMISSIONS.MENU_WRITE]),
        restaurantIds: [RESTAURANT_ID],
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.MENU_WRITE),
    ).resolves.toBe(true);
  });

  it("blocks a manager with permission outside restaurant scope", async () => {
    const ctx = {
      user: {
        id: "manager-1",
        roleName: "manager",
        role: role("manager", [PERMISSIONS.MENU_WRITE]),
        restaurantIds: [OTHER_RESTAURANT_ID],
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.MENU_WRITE),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks scoped staff when the required module permission is missing", async () => {
    const ctx = {
      user: {
        id: "staff-1",
        roleName: "server",
        role: role("server", [PERMISSIONS.MENU_READ]),
        restaurantForStaff: RESTAURANT_ID,
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.MENU_WRITE),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("allows admin to bypass module permission and restaurant scope checks", async () => {
    const ctx = {
      user: {
        id: "admin-1",
        roleName: "admin",
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.RESTAURANT_WRITE),
    ).resolves.toBe(true);
  });

  it("allows cashier with payment.write to process payment mutations in scope", async () => {
    const ctx = {
      user: {
        id: "cashier-1",
        roleName: "cashier",
        role: role("cashier", [PERMISSIONS.PAYMENT_WRITE]),
        restaurantForStaff: RESTAURANT_ID,
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.PAYMENT_WRITE),
    ).resolves.toBe(true);
  });

  it("allows chef with order update permission to update kitchen order state in scope", async () => {
    const ctx = {
      user: {
        id: "chef-1",
        roleName: "chef",
        role: role("chef", [PERMISSIONS.ORDER_UPDATE]),
        restaurantForStaff: RESTAURANT_ID,
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.ORDER_UPDATE),
    ).resolves.toBe(true);
  });

  it("blocks customers from staff/admin module mutations", async () => {
    const ctx = {
      user: {
        id: "customer-1",
        roleName: "customer",
        role: role("customer", [PERMISSIONS.RESERVATION_CREATE]),
        restaurantId: RESTAURANT_ID,
      },
    };

    await expect(
      requireRestaurantPermission(ctx, RESTAURANT_ID, PERMISSIONS.STAFF_WRITE),
    ).rejects.toThrow("FORBIDDEN");
  });
});
