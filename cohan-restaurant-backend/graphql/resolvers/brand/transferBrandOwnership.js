import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Brand, BrandMembership, User } from "../../../models/index.js";
import {
  ensureBrandRestaurants,
  getUserId,
} from "../../../src/services/auth/restaurantScope.service.js";

const bad = (message) => new GraphQLError(message, {
  extensions: { code: "BAD_USER_INPUT" },
});
const forbidden = (message) => new GraphQLError(message, {
  extensions: { code: "FORBIDDEN" },
});
const auth = () => new GraphQLError("Unauthorized", {
  extensions: { code: "UNAUTHENTICATED" },
});
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw bad("Invalid ID");
  return new mongoose.Types.ObjectId(id);
};
const userRole = (user) =>
  String(user?.role?.slug || user?.role?.name || "").trim().toLowerCase();

export default async function transferBrandOwnership(_, { input }, ctx) {
  if (!ctx?.user) throw auth();

  const brandId = oid(input.brandId);
  const currentOwnerUserId = oid(getUserId(ctx.user));
  const newOwnerUserId = oid(input.newOwnerUserId);
  if (String(currentOwnerUserId) === String(newOwnerUserId)) {
    throw bad("Người nhận quyền phải là một tài khoản khác.");
  }

  let managerRestaurantIds;
  try {
    managerRestaurantIds = await ensureBrandRestaurants(
      input.brandId,
      [input.previousOwnerRestaurantId],
    );
  } catch (error) {
    throw bad(error.message);
  }
  if (managerRestaurantIds.length !== 1) {
    throw bad("Chủ cũ phải được gán đúng một chi nhánh để làm quản lý.");
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const currentOwnerMembership = await BrandMembership.findOne({
        brandId,
        userId: currentOwnerUserId,
        role: "owner",
        status: "active",
      }).session(session);
      if (!currentOwnerMembership) {
        throw forbidden("Chỉ chủ chuỗi hiện tại mới có thể chuyển quyền sở hữu.");
      }

      const newOwnerMembership = await BrandMembership.findOne({
        brandId,
        userId: newOwnerUserId,
        status: "active",
      }).session(session);
      if (!newOwnerMembership || newOwnerMembership.role === "owner") {
        throw bad("Người nhận quyền phải là thành viên đang hoạt động của chuỗi.");
      }

      const newOwnerUser = await User.findById(newOwnerUserId)
        .populate("role")
        .session(session)
        .lean();
      if (
        newOwnerUser?.status !== "active" ||
        !["manager", "admin"].includes(userRole(newOwnerUser))
      ) {
        throw bad("Người nhận quyền phải có tài khoản quản lý hoặc quản trị viên đang hoạt động.");
      }

      const conflictingManager = await BrandMembership.findOne({
        brandId,
        role: "manager",
        status: "active",
        restaurantIds: managerRestaurantIds[0],
        _id: { $nin: [currentOwnerMembership._id, newOwnerMembership._id] },
      }).session(session).select("_id").lean();
      if (conflictingManager) {
        throw bad("Chi nhánh này đã có quản lý. Vui lòng chọn chi nhánh khác.");
      }

      const brand = await Brand.findById(brandId).session(session);
      if (!brand) throw bad("Brand not found");

      newOwnerMembership.role = "owner";
      newOwnerMembership.restaurantIds = [];
      newOwnerMembership.status = "active";
      newOwnerMembership.updatedBy = currentOwnerUserId;
      await newOwnerMembership.save({ session });

      currentOwnerMembership.role = "manager";
      currentOwnerMembership.restaurantIds = managerRestaurantIds;
      currentOwnerMembership.status = "active";
      currentOwnerMembership.updatedBy = currentOwnerUserId;
      await currentOwnerMembership.save({ session });

      brand.ownerId = newOwnerUserId;
      brand.updatedBy = currentOwnerUserId;
      await brand.save({ session });

      result = {
        brand: brand.toObject(),
        previousOwnerMembership: currentOwnerMembership.toObject(),
        newOwnerMembership: newOwnerMembership.toObject(),
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
}
