import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import {
  buildBrandMemberBaseFilter,
  normalizeBrandMemberPageArgs,
} from "../../graphql/resolvers/brand/memberPagination.js";

describe("brand member server pagination", () => {
  it("normalizes page and clamps the client-selected page size", () => {
    expect(normalizeBrandMemberPageArgs({ page: 0, pageSize: 0 })).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(normalizeBrandMemberPageArgs({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
    expect(normalizeBrandMemberPageArgs({ page: 2, pageSize: 500 })).toEqual({
      page: 2,
      pageSize: 100,
    });
  });

  it("builds Mongo filters for role, status and restaurant scope", () => {
    const brandId = new mongoose.Types.ObjectId().toString();
    const restaurantId = new mongoose.Types.ObjectId().toString();
    const filter = buildBrandMemberBaseFilter({
      brandId,
      role: "MANAGER",
      status: "ACTIVE",
      restaurantId,
    });

    expect(String(filter.brandId)).toBe(brandId);
    expect(filter.role).toBe("manager");
    expect(filter.status).toBe("active");
    expect(String(filter.restaurantIds)).toBe(restaurantId);
  });

  it("rejects unsupported filters before querying the database", () => {
    const brandId = new mongoose.Types.ObjectId().toString();

    expect(() =>
      buildBrandMemberBaseFilter({ brandId, role: "super-admin" }),
    ).toThrow("Vai trò lọc không hợp lệ");
    expect(() =>
      buildBrandMemberBaseFilter({ brandId, status: "deleted" }),
    ).toThrow("Trạng thái lọc không hợp lệ");
    expect(() =>
      buildBrandMemberBaseFilter({ brandId: "not-an-object-id" }),
    ).toThrow("Brand không hợp lệ");
  });
});
