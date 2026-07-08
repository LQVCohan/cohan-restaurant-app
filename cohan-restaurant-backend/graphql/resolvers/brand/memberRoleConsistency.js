import { GraphQLError } from "graphql";
import { BrandMembership, Role, User } from "../../../models/index.js";
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
const isSyntheticInviteId = (value) => String(value || "").startsWith("invite:");

async function loadAccount(userId, session = null) {
  const query = User.findById(userId)
    .populate({ path: "role", populate: { path: "parentRole" } });
  if (session) query.session(session);
  return query.lean();
}

export async function assertBrandMembershipAccountCompatibility({
  userId,
  membershipRole,
  session = null,
  allowCustomerPromotion = false,
}) {
  const account = await loadAccount(userId, session);
  if (!account) throw bad("Không tìm thấy tài khoản thành viên.");

  const accountRole = accountRoleOf(account);
  const nextMembershipRole = String(membershipRole || "").trim().toLowerCase();
  if (!accountRole) {
    throw bad("Tài khoản chưa có vai trò hệ thống.");
  }

  const promotesCustomer =
    allowCustomerPromotion &&
    account.userType === "CUSTOMER" &&
    accountRole === "customer" &&
    ["admin", "manager"].includes(nextMembershipRole);

  if (nextMembershipRole === "manager" && accountRole !== "manager" && !promotesCustomer) {
    throw bad(
      accountRole === "admin"
        ? "Admin hệ thống không được gán làm Quản lý chi nhánh."
        : "Quản lý chi nhánh phải sử dụng tài khoản Manager hoặc Customer hợp lệ.",
    );
  }

  if (nextMembershipRole === "admin" && accountRole !== "manager" && !promotesCustomer) {
    throw bad(
      accountRole === "admin"
        ? "Admin hệ thống đã có phạm vi toàn hệ thống và không được gán làm Quản trị chuỗi."
        : "Quản trị chuỗi phải sử dụng tài khoản Manager hoặc Customer hợp lệ.",
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

export async function promoteCustomerAccountToManager({ userId, session = null }) {
  const roleQuery = Role.findOne({
    $or: [{ slug: "manager" }, { name: /^manager$/i }],
  }).select("_id");
  if (session) roleQuery.session(session);
  const managerRole = await roleQuery.lean();
  if (!managerRole) throw bad("Không tìm thấy vai trò Manager trong hệ thống.");

  const result = await User.updateOne(
    { _id: userId, userType: "CUSTOMER" },
    { $set: { userType: "MANAGER", role: managerRole._id } },
    {
      ...(session ? { session } : {}),
      runValidators: true,
      overwriteDiscriminatorKey: true,
    },
  );
  if ((result.matchedCount ?? result.n ?? 0) !== 1) {
    throw bad("Tài khoản không còn ở trạng thái Customer để nâng quyền.");
  }

  return managerRole._id;
}

export function guardBrandMemberRoleMutations(mutations = {}) {
  return {
    addBrandMember: async (root, { input }, ctx, info) => {
      if (!ctx?.user || !await canManageBrand(ctx.user, input.brandId)) {
        return mutations.addBrandMember(root, { input }, ctx, info);
      }

      if (!isSyntheticInviteId(input.userId)) {
        await assertBrandMembershipAccountCompatibility({
          userId: input.userId,
          membershipRole: input.role,
          allowCustomerPromotion: ["admin", "manager"].includes(input.role),
        });
      }
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

      if (membership.status === "invited" && input.status === "active") {
        throw forbidden(
          "Thành viên phải tự xác nhận liên kết trong email trước khi quyền được kích hoạt.",
        );
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
