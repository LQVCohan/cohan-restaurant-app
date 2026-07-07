import { GraphQLError } from "graphql";
import { BrandMembership, User } from "../../../models/index.js";
import {
  canManageBrand,
  getUserId,
} from "../../../src/services/auth/restaurantScope.service.js";

const bad = (message) => new GraphQLError(message, {
  extensions: { code: "BAD_USER_INPUT" },
});

const forbidden = (message) => new GraphQLError(message, {
  extensions: { code: "FORBIDDEN" },
});

const roleSlug = (role) =>
  String(role?.slug || role?.name || "").trim().toLowerCase();

const accountRoleOf = (user) => roleSlug(user?.role);
const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

async function loadAccount(userId) {
  return User.findById(userId)
    .populate({ path: "role", populate: { path: "parentRole" } })
    .lean();
}

export async function assertBrandMembershipAccountCompatibility({
  userId,
  membershipRole,
}) {
  const account = await loadAccount(userId);
  if (!account) throw bad("Không tìm thấy tài khoản thành viên.");

  const accountRole = accountRoleOf(account);
  const nextMembershipRole = String(membershipRole || "").trim().toLowerCase();
  if (!accountRole) {
    throw bad("Tài khoản chưa có vai trò hệ thống.");
  }

  if (nextMembershipRole === "manager" && accountRole !== "manager") {
    if (accountRole === "admin") {
      throw bad(
        "Admin hệ thống luôn có quyền trên mọi nhà hàng. Hãy đổi vai trò hệ thống sang Manager trước khi gán Quản lý chi nhánh.",
      );
    }
    throw bad(
      "Tài khoản phải có vai trò hệ thống Manager trước khi được gán làm Quản lý chi nhánh.",
    );
  }

  if (
    nextMembershipRole === "admin" &&
    !["admin", "manager"].includes(accountRole)
  ) {
    throw bad(
      "Quản trị chuỗi phải sử dụng tài khoản có vai trò hệ thống Manager hoặc Admin.",
    );
  }

  if (
    nextMembershipRole === "staff" &&
    ["admin", "manager", "customer"].includes(accountRole)
  ) {
    throw bad(
      "Nhân viên chi nhánh phải sử dụng vai trò nhân sự phù hợp; hãy đổi vai trò hệ thống trước khi hạ quyền trong chuỗi.",
    );
  }

  return account;
}

export function guardBrandMemberRoleMutations(mutations = {}) {
  return {
    addBrandMember: async (root, { input }, ctx, info) => {
      if (!ctx?.user || !await canManageBrand(ctx.user, input.brandId)) {
        return mutations.addBrandMember(root, { input }, ctx, info);
      }

      await assertBrandMembershipAccountCompatibility({
        userId: input.userId,
        membershipRole: input.role,
      });
      return mutations.addBrandMember(root, { input }, ctx, info);
    },

    updateBrandMember: async (root, { input }, ctx, info) => {
      const membership = await BrandMembership.findById(input.id)
        .select("brandId userId role status")
        .lean();

      if (
        !membership ||
        !ctx?.user ||
        !await canManageBrand(ctx.user, membership.brandId)
      ) {
        return mutations.updateBrandMember(root, { input }, ctx, info);
      }

      const suspendsMembership =
        input.status === "inactive" && membership.status !== "inactive";
      if (suspendsMembership && membership.role === "owner") {
        throw forbidden(
          "Không thể tạm ngưng Chủ chuỗi. Hãy chuyển quyền sở hữu trước nếu cần thay đổi tài khoản chủ.",
        );
      }
      if (suspendsMembership && sameId(membership.userId, getUserId(ctx.user))) {
        throw forbidden(
          "Bạn không thể tự tạm ngưng quyền của mình. Hãy nhờ Chủ chuỗi hoặc một Quản trị chuỗi khác thực hiện.",
        );
      }

      const nextStatus = input.status || membership.status;
      if (nextStatus === "active") {
        await assertBrandMembershipAccountCompatibility({
          userId: membership.userId,
          membershipRole: input.role || membership.role,
        });
      }

      return mutations.updateBrandMember(root, { input }, ctx, info);
    },
  };
}
