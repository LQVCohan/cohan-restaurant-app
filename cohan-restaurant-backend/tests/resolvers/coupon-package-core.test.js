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

  it("createCoupon calls requireRestaurantAccess before Coupon.create", async () => {
    modelMocks.Coupon.create.mockResolvedValue({ _id: "coupon-1" });
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponMutation.createCoupon(null, { input: { name: "A", code: "C", discountValue: 10, restaurantId: "r1" } }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Coupon.create).toHaveBeenCalled();
  });

  it("createCoupon denied => Coupon.create not called", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.createCoupon(null, { input: { name: "A", code: "C", discountValue: 10, restaurantId: "r1" } }, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.create).not.toHaveBeenCalled();
  });

  it("updateCoupon guards existing restaurant and preserves restaurantId", async () => {
    modelMocks.Coupon.findById
      .mockReturnValueOnce(mockLeanQuery({ _id: "coupon-1", restaurantId: "existing-r" }))
      .mockReturnValueOnce(mockLeanQuery({ id: "coupon-1" }));
    modelMocks.Coupon.findByIdAndUpdate.mockResolvedValue({ _id: "coupon-1" });
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.updateCoupon(null, { id: "coupon-1", input: { name: "A", code: "C", discountValue: 10, restaurantId: "other-r" } }, { user: { roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ value: "existing-r" }));
    expect(modelMocks.Coupon.findByIdAndUpdate).toHaveBeenCalledWith("coupon-1", expect.objectContaining({ restaurantId: expect.objectContaining({ value: "existing-r" }) }), { new: true });
  });

  it("deleteCoupon denied => Coupon.deleteOne not called", async () => {
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ _id: "coupon-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.deleteCoupon(null, { id: "coupon-1" }, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.deleteOne).not.toHaveBeenCalled();
  });

  it("toggleCoupon denied => Coupon.findByIdAndUpdate not called", async () => {
    modelMocks.Coupon.findById.mockReturnValue(mockLeanQuery({ _id: "coupon-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.toggleCoupon(null, { id: "coupon-1", isActive: true }, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("createVoucherPackage calls requireRestaurantAccess before create", async () => {
    modelMocks.VoucherPackage.create.mockResolvedValue({ _id: "package-1" });
    modelMocks.VoucherPackage.findById.mockReturnValue(mockLeanQuery({ id: "package-1" }));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.createVoucherPackage(null, { input: { name: "P", code: "P1", voucherIds: ["v1"], restaurantId: "r1" } }, { user: { roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.create).toHaveBeenCalled();
  });

  it("updateVoucherPackage preserves existing restaurantId", async () => {
    modelMocks.VoucherPackage.findById
      .mockReturnValueOnce(mockLeanQuery({ _id: "package-1", restaurantId: "existing-r" }))
      .mockReturnValueOnce(mockLeanQuery({ id: "package-1" }));
    modelMocks.VoucherPackage.findByIdAndUpdate.mockResolvedValue({ _id: "package-1" });
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await CouponMutation.updateVoucherPackage(null, { id: "package-1", input: { name: "P", code: "P1", voucherIds: ["v1"], restaurantId: "other-r" } }, { user: { roleName: "manager" } });

    expect(modelMocks.VoucherPackage.findByIdAndUpdate).toHaveBeenCalledWith("package-1", expect.objectContaining({ restaurantId: expect.objectContaining({ value: "existing-r" }) }), { new: true });
  });

  it("deleteVoucherPackage denied => VoucherPackage.deleteOne not called", async () => {
    modelMocks.VoucherPackage.findById.mockReturnValue(mockLeanQuery({ _id: "package-1", restaurantId: "r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("Forbidden"));
    const { CouponMutation } = await import("../../graphql/resolvers/coupon/mutation.js");

    await expect(CouponMutation.deleteVoucherPackage(null, { id: "package-1" }, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.VoucherPackage.deleteOne).not.toHaveBeenCalled();
  });
});
