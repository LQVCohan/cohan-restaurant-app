import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { find: vi.fn(), findOne: vi.fn() },
  MenuItem: { find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() },
  Restaurant: { findById: vi.fn() },
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
    isValidObjectId: vi.fn((value) =>
      String(value || "").startsWith("valid-"),
    ),
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

const publicRestaurant = (overrides = {}) => ({
  _id: "valid-r1",
  status: "active",
  businessStatus: "active",
  publicationStatus: "published",
  operationalStatus: "normal",
  capabilities: {
    acceptsOrders: true,
    acceptsTableOrders: true,
    acceptsReservations: true,
  },
  orderPolicy: { allowWhenClosed: true },
  reservationPolicy: { allowWhenClosed: true },
  ...overrides,
});

describe("public/customer permission flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    guardMocks.requireRoles.mockImplementation(() => true);
    modelMocks.Menu.find.mockReturnValue(findChain([]));
    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-1" }),
    );
    modelMocks.MenuItem.find.mockReturnValue(findChain([]));
    modelMocks.MenuItem.findOne.mockReturnValue(findOneChain(null));
    modelMocks.Restaurant.findById.mockReturnValue(
      findOneChain(publicRestaurant()),
    );
    modelMocks.Category.find.mockReturnValue(findChain([]));
    modelMocks.Promotion.find.mockReturnValue(findChain([]));
    modelMocks.Coupon.find.mockReturnValue(findChain([]));
    modelMocks.Coupon.findOne.mockReturnValue(findOneChain(null));
    modelMocks.VoucherPackage.find.mockReturnValue(findChain([]));
  });

  it("lets public customers browse available and sold-out menu items without menu.read", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );

    await MenuQuery.menuItems(null, { restaurantId: "valid-r1" }, {});

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      status: { $in: ["available", "out_of_stock"] },
    });
  });

  it("requires menu.read for internal menu item status queries", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );

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
    const { PromotionQuery } = await import(
      "../../graphql/resolvers/promotion/query.js"
    );

    await PromotionQuery.promotionsByRestaurant(
      null,
      { restaurantId: "valid-r1", activeOnly: true },
      {},
    );

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Promotion.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it("requires promotion.read when listing inactive/admin promotions", async () => {
    const { PromotionQuery } = await import(
      "../../graphql/resolvers/promotion/query.js"
    );

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
    const { CouponQuery } = await import(
      "../../graphql/resolvers/coupon/query.js"
    );

    await CouponQuery.coupons(
      null,
      { restaurantId: "valid-r1", activeOnly: true },
      {},
    );

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it("requires coupon.read for inactive/admin coupon listings", async () => {
    const { CouponQuery } = await import(
      "../../graphql/resolvers/coupon/query.js"
    );

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
    const { CouponQuery } = await import(
      "../../graphql/resolvers/coupon/query.js"
    );

    await CouponQuery.voucherPackages(
      null,
      { restaurantId: "valid-r1", activeOnly: true },
      {},
    );

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it("requires coupon.read for inactive/admin voucher package listings", async () => {
    const { CouponQuery } = await import(
      "../../graphql/resolvers/coupon/query.js"
    );

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

  it("lets public customers query active categories that contain browsable dishes", async () => {
    const { CustomerCategoryQuery } = await import(
      "../../graphql/resolvers/category/customerQuery.js"
    );

    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-1" }),
    );
    modelMocks.Category.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: "valid-c2",
            id: "valid-c2",
            name: "B",
            order: 1,
            isActive: true,
          },
          {
            _id: "valid-c1",
            id: "valid-c1",
            name: "A",
            order: 1,
            isActive: true,
          },
        ]),
      }),
    });
    modelMocks.MenuItem.aggregate.mockResolvedValue([
      { _id: "valid-c1", count: 3 },
      { _id: "valid-c2", count: 1 },
      { _id: "valid-c3", count: 99 },
    ]);

    const rows = await CustomerCategoryQuery.customerMenuCategories(
      null,
      { restaurantId: "valid-r1", timeSlot: "lunch" },
      {},
    );

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            status: { $in: ["available", "out_of_stock"] },
          }),
        }),
      ]),
    );
    expect(rows.map((row) => row.id || String(row._id))).toEqual([
      "valid-c2",
      "valid-c1",
    ]);
    expect(rows.every((row) => row.isActive !== false)).toBe(true);
    expect(rows.every((row) => row.menuItemCount > 0)).toBe(true);
  });

  it("lets public users query available and sold-out menu-item details", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );
    modelMocks.MenuItem.findOne.mockReturnValueOnce(
      findOneChain({
        _id: "valid-m1",
        id: "valid-m1",
        restaurantId: "valid-r1",
        status: "available",
        menuId: "valid-menu-1",
      }),
    );
    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-1" }),
    );

    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toMatchObject({ id: "valid-m1" });

    modelMocks.MenuItem.findOne.mockReturnValueOnce(
      findOneChain({
        _id: "valid-m2",
        id: "valid-m2",
        restaurantId: "valid-r1",
        status: "out_of_stock",
        inventoryStatus: "OUT_OF_STOCK",
        menuId: "valid-menu-1",
      }),
    );

    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m2", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toMatchObject({ id: "valid-m2" });
    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
  });

  it("returns null for unavailable customerMenuItem", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );
    modelMocks.MenuItem.findOne.mockReturnValue(findOneChain(null));

    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toBeNull();
  });

  it("returns null when restaurant is missing, inactive or not published", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );
    modelMocks.MenuItem.findOne.mockReturnValue(
      findOneChain({
        _id: "valid-m1",
        id: "valid-m1",
        restaurantId: "valid-r1",
        status: "available",
        menuId: "valid-menu-1",
      }),
    );
    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-1" }),
    );

    modelMocks.Restaurant.findById.mockReturnValueOnce(findOneChain(null));
    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toBeNull();

    modelMocks.Restaurant.findById.mockReturnValueOnce(
      findOneChain(publicRestaurant({ businessStatus: "inactive" })),
    );
    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toBeNull();

    modelMocks.Restaurant.findById.mockReturnValueOnce(
      findOneChain(publicRestaurant({ publicationStatus: "hidden" })),
    );
    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toBeNull();
  });

  it("still returns customerMenuItem when restaurant is closed but publicly visible", async () => {
    const { MenuQuery } = await import(
      "../../graphql/resolvers/menu/query.js"
    );
    modelMocks.MenuItem.findOne.mockReturnValue(
      findOneChain({
        _id: "valid-m1",
        id: "valid-m1",
        restaurantId: "valid-r1",
        status: "available",
        menuId: "valid-menu-1",
      }),
    );
    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-1" }),
    );
    modelMocks.Restaurant.findById.mockReturnValue(
      findOneChain(
        publicRestaurant({
          openingStatus: "closed",
          orderPolicy: { allowWhenClosed: false },
        }),
      ),
    );

    await expect(
      MenuQuery.customerMenuItem(
        null,
        { id: "valid-m1", restaurantId: "valid-r1" },
        {},
      ),
    ).resolves.toMatchObject({ id: "valid-m1" });
  });
});
