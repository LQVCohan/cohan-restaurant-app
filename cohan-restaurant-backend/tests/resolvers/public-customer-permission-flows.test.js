import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { find: vi.fn(), findOne: vi.fn() },
  MenuItem: { find: vi.fn() },
  Category: { find: vi.fn() },
  Promotion: { find: vi.fn() },
  Coupon: { find: vi.fn(), findOne: vi.fn() },
  VoucherPackage: { find: vi.fn() },
}));

const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

const guardMocks = vi.hoisted(() => ({
  requireRoles: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
}));

function findChain(rows = []) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

function findOneChain(row = null) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(row),
  };
}

describe("public/customer permission flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    guardMocks.requireRoles.mockImplementation(() => true);
    modelMocks.Menu.find.mockReturnValue(findChain([]));
    modelMocks.Menu.findOne.mockReturnValue(findOneChain({ _id: "valid-menu-1" }));
    modelMocks.MenuItem.find.mockReturnValue(findChain([]));
    modelMocks.Category.find.mockReturnValue(findChain([]));
    modelMocks.Promotion.find.mockReturnValue(findChain([]));
    modelMocks.Coupon.find.mockReturnValue(findChain([]));
    modelMocks.Coupon.findOne.mockReturnValue(findOneChain(null));
    modelMocks.VoucherPackage.find.mockReturnValue(findChain([]));
  });

  it("lets public customers browse available menu items without menu.read", async () => {
    const { MenuQuery } = await import("../../graphql/resolvers/menu/query.js");

    await MenuQuery.menuItems(null, { restaurantId: "valid-r1" }, {});

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      status: "available",
    });
  });

  it("requires menu.read for internal menu item status queries", async () => {
    const { MenuQuery } = await import("../../graphql/resolvers/menu/query.js");

    await MenuQuery.menuItemsConnection(
      null,
      { filter: { restaurantId: "valid-r1", status: "hidden" } },
      { user: { id: "manager-1" } },
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      "valid-r1",
      "menu.read",
    );
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      status: "hidden",
    });
  });

  it("lets public customers browse active promotions without promotion.read", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    await PromotionQuery.promotionsByRestaurant(null, { restaurantId: "valid-r1", activeOnly: true }, {});

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Promotion.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("requires promotion.read when listing inactive/admin promotions", async () => {
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    await PromotionQuery.promotionsByRestaurant(
      null,
      { restaurantId: "valid-r1", activeOnly: false },
      { user: { id: "manager-1" } },
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "promotion.read",
    );
  });

  it("lets public customers browse active coupons without coupon.read", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.coupons(null, { restaurantId: "valid-r1", activeOnly: true }, {});

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("requires coupon.read for inactive/admin coupon listings", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.coupons(
      null,
      { restaurantId: "valid-r1", activeOnly: false },
      { user: { id: "manager-1" } },
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "coupon.read",
    );
  });

  it("lets public customers browse active voucher packages without coupon.read", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.voucherPackages(null, { restaurantId: "valid-r1", activeOnly: true }, {});

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("requires coupon.read for inactive/admin voucher package listings", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.voucherPackages(
      null,
      { restaurantId: "valid-r1", activeOnly: false },
      { user: { id: "manager-1" } },
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "coupon.read",
    );
  });

});
