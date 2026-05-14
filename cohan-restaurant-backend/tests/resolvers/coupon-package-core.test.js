import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Coupon: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
  VoucherPackage: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

const mockLeanQuery = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

describe("Coupon and voucher package core flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    guardMocks.requireRoles.mockImplementation(() => undefined);
  });

  it("returns a usable coupon payload with non-null id after create", async () => {
    modelMocks.Coupon.create.mockResolvedValue({ _id: "coupon-1" });
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ id: "coupon-1", name: "Voucher food", restaurantId: "restaurant-1" }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    const result = await CouponMutation.createCoupon(null, { input: { name: "Voucher food", code: "FOOD10", category: "food", discountType: "PERCENT", discountValue: 10, publishAt: "2026-05-01T03:00:00.000Z", startAt: "2026-05-01T03:00:00.000Z", endAt: "2026-05-05T15:00:00.000Z", restaurantId: "restaurant-1" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(result).toEqual(expect.objectContaining({ id: "coupon-1", restaurantId: "restaurant-1" }));
  });

  it("rejects invalid DateTime input early for coupon create", async () => {
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.createCoupon(null, { input: { name: "Voucher food", code: "FOOD10", discountType: "PERCENT", discountValue: 10, startAt: "not-a-date", endAt: "2026-05-05T15:00:00.000Z", restaurantId: "restaurant-1" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Invalid startAt");
    expect(modelMocks.Coupon.create).not.toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("rejects percent discount outside 1..100", async () => {
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");
    await expect(CouponMutation.createCoupon(null, { input: { name: "Voucher food", code: "FOOD10", discountType: "PERCENT", discountValue: 101, restaurantId: "restaurant-1" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("PERCENT discountValue must be between 1 and 100");
    expect(modelMocks.Coupon.create).not.toHaveBeenCalled();
  });

  it("rejects negative coupon limits and values", async () => {
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");
    await expect(CouponMutation.createCoupon(null, { input: { name: "Voucher food", code: "FOOD10", discountType: "AMOUNT", discountValue: 10, minOrderValue: -1, restaurantId: "restaurant-1" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("minOrderValue, maxDiscount, and maxUsage must not be negative");
  });

  it("createCoupon calls requireRestaurantAccess before Coupon.create", async () => {
    modelMocks.Coupon.create.mockResolvedValue({ _id: "coupon-1" });
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.createCoupon(null, { input: { name: "A", code: "C", discountValue: 10, restaurantId: "r1" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Coupon.create).toHaveBeenCalled();
  });

  it("createCoupon denied => Coupon.create not called", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.createCoupon(null, { input: { name: "A", code: "C", discountValue: 10, restaurantId: "r1" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.create).not.toHaveBeenCalled();
  });

  it("updateCoupon preserves existing restaurantId", async () => {
    modelMocks.Coupon.findById.mockReturnValueOnce(mockLeanQuery({ _id: "coupon-1", restaurantId: "existing-r" })).mockReturnValueOnce(mockLeanQuery({ id: "coupon-1" }));
    modelMocks.Coupon.findByIdAndUpdate.mockResolvedValue({ _id: "coupon-1" });
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.updateCoupon(null, { id: "coupon-1", input: { name: "A", code: "C", discountValue: 10, restaurantId: "other-r" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(modelMocks.Coupon.findByIdAndUpdate).toHaveBeenCalledWith("coupon-1", expect.objectContaining({ restaurantId: expect.objectContaining({ value: "existing-r" }) }), { new: true });
  });

  it("updateCoupon returns Coupon not found when updated record is null", async () => {
    modelMocks.Coupon.findById.mockReturnValueOnce(mockLeanQuery({ _id: "coupon-1", restaurantId: "existing-r" }));
    modelMocks.Coupon.findByIdAndUpdate.mockResolvedValue(null);
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.updateCoupon(null, { id: "coupon-1", input: { name: "A", code: "C", discountValue: 10, restaurantId: "other-r" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Coupon not found");
  });

  it("deleteCoupon denied => Coupon.deleteOne not called", async () => {
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ _id: "coupon-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.deleteCoupon(null, { id: "coupon-1" }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.deleteOne).not.toHaveBeenCalled();
  });

  it("toggleCoupon denied => Coupon.findByIdAndUpdate not called", async () => {
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ _id: "coupon-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.toggleCoupon(null, { id: "coupon-1", isActive: true }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("toggleCoupon returns Coupon not found when updated record is null", async () => {
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ _id: "coupon-1", restaurantId: "r1" }));
    modelMocks.Coupon.findByIdAndUpdate.mockResolvedValue(null);
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.toggleCoupon(null, { id: "coupon-1", isActive: true }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Coupon not found");
  });

  it("returns voucher packages with non-null id after create", async () => {
    modelMocks.VoucherPackage.create.mockResolvedValue({ _id: "package-1" });
    modelMocks.VoucherPackage.findById.mockReturnValue(mockLeanQuery({ id: "package-1", name: "Goi VIP", restaurantId: "restaurant-1", voucherIds: ["coupon-1"] }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    const result = await CouponMutation.createVoucherPackage(null, { input: { name: "Goi VIP", code: "VIP-01", voucherIds: ["coupon-1"], startAt: "2026-05-01T03:00:00.000Z", endAt: "2026-05-05T15:00:00.000Z", restaurantId: "restaurant-1" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(result).toEqual(expect.objectContaining({ id: "package-1", restaurantId: "restaurant-1", voucherIds: ["coupon-1"] }));
  });

  it("createVoucherPackage calls requireRestaurantAccess before create", async () => {
    modelMocks.VoucherPackage.create.mockResolvedValue({ _id: "package-1" });
    modelMocks.VoucherPackage.findById.mockReturnValue(mockLeanQuery({ id: "package-1" }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.createVoucherPackage(null, { input: { name: "P", code: "P1", voucherIds: ["v1"], restaurantId: "r1" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.create).toHaveBeenCalled();
  });

  it("updateVoucherPackage preserves existing restaurantId", async () => {
    modelMocks.VoucherPackage.findById.mockReturnValueOnce(mockLeanQuery({ _id: "package-1", restaurantId: "existing-r" })).mockReturnValueOnce(mockLeanQuery({ id: "package-1" }));
    modelMocks.VoucherPackage.findByIdAndUpdate.mockResolvedValue({ _id: "package-1" });
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.updateVoucherPackage(null, { id: "package-1", input: { name: "P", code: "P1", voucherIds: ["v1"], restaurantId: "other-r" } }, { user: { id: "manager-1", roleName: "manager" } });

    expect(modelMocks.VoucherPackage.findByIdAndUpdate).toHaveBeenCalledWith("package-1", expect.objectContaining({ restaurantId: expect.objectContaining({ value: "existing-r" }) }), { new: true });
  });

  it("updateVoucherPackage returns not found when updated record is null", async () => {
    modelMocks.VoucherPackage.findById.mockReturnValueOnce(mockLeanQuery({ _id: "package-1", restaurantId: "existing-r" }));
    modelMocks.VoucherPackage.findByIdAndUpdate.mockResolvedValue(null);
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.updateVoucherPackage(null, { id: "package-1", input: { name: "P", code: "P1", voucherIds: ["v1"], restaurantId: "other-r" } }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Voucher package not found");
  });

  it("deleteVoucherPackage denied => VoucherPackage.deleteOne not called", async () => {
    modelMocks.VoucherPackage.findById.mockReturnValue(mockLeanQuery({ _id: "package-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.deleteVoucherPackage(null, { id: "package-1" }, { user: { id: "manager-1", roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.VoucherPackage.deleteOne).not.toHaveBeenCalled();
  });
});
