import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) {
    throw new Error(`Expected source not found in ${file}: ${from.slice(0, 120)}`);
  }
  write(file, source.replace(from, to));
}

function replaceAllLiteral(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) {
    throw new Error(`Expected source not found in ${file}: ${from.slice(0, 120)}`);
  }
  write(file, source.split(from).join(to));
}

const guardsPath = "cohan-restaurant-backend/graphql/guards.js";
write(guardsPath, `import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";

const RESTAURANT_SCOPED_ROLES = new Set([
  "HR", "ACCOUNTANT", "STAFF", "SERVER", "SUPERVISOR", "HOST", "CASHIER",
  "CHEF", "COOK", "KITCHEN_HELPER", "CLEANER", "SHIPPER", "STOREKEEPER",
  "BARTENDER",
]);

function restaurantIdToString(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.value || "");
  }
  return String(value);
}

function hasDirectRestaurantScope(ctx, restaurantId) {
  const user = ctx?.user || {};
  const roles = resolveUserRoles(user);
  const isRestaurantScopedRole = roles.some((role) => RESTAURANT_SCOPED_ROLES.has(role));
  const target = restaurantIdToString(restaurantId);
  if (!target || !isRestaurantScopedRole) return false;

  const scopedIds = [
    user.restaurantForStaff,
    user.restaurantId,
    ...(Array.isArray(user.restaurantIds) ? user.restaurantIds : []),
  ];

  return scopedIds.some((id) => restaurantIdToString(id) === target);
}

async function managerOwnsRestaurant(ctx, restaurantId) {
  const managerId = ctx?.user?.id || ctx?.user?._id;
  if (!managerId || !restaurantId) return false;

  try {
    const models = await import("../models/index.js");
    const Restaurant = models.Restaurant;
    if (typeof Restaurant?.exists !== "function") return false;

    return Boolean(await Restaurant.exists({ _id: restaurantId, managerId }));
  } catch (error) {
    if (error?.name === "CastError") return false;
    throw error;
  }
}

export function requireAuth(ctx) {
  const userId = ctx?.user?.id || ctx?.user?._id;
  if (!userId) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }
  if (!ctx.user.id && ctx.user._id) ctx.user.id = ctx.user._id;
}

export function requireRoles(ctx, allowed = []) {
  requireAuth(ctx);
  const userRoles = resolveUserRoles(ctx.user);
  const normalizedAllowed = allowed.map(normalizeRole);
  if (!normalizedAllowed.some((role) => userRoles.includes(role))) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
}

export async function requireRestaurantAccess(ctx, restaurantId) {
  requireAuth(ctx);
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;
  if (hasDirectRestaurantScope(ctx, restaurantId)) return;
  if (roles.includes("MANAGER") && await managerOwnsRestaurant(ctx, restaurantId)) return;

  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}

// Compatibility alias for legacy imports. New and updated call sites must await it.
export async function requireRestaurantScope(ctx, restaurantId) {
  return requireRestaurantAccess(ctx, restaurantId);
}
`);

const frontendRolePath = "src/utils/frontendRoleAccess.js";
replaceOnce(
  frontendRolePath,
  `// HR and accountant accounts are restaurant-scoped staff for restaurant
// selection even though they are not operational floor roles. AuthProvider
// uses this helper to retain restaurantForStaff and select the assigned branch.
export const isStaffOperationalRole = (role) => {
  const normalized = resolveUserRoleName(role);
  return (
    STAFF_OPERATIONAL_ROLES.has(normalized) ||
    HR_ROLES.has(normalized) ||
    ACCOUNTANT_ROLES.has(normalized)
  );
};`,
  `export const isStaffOperationalRole = (role) =>
  STAFF_OPERATIONAL_ROLES.has(resolveUserRoleName(role));

export const isRestaurantScopedRole = (role) => {
  const normalized = resolveUserRoleName(role);
  return (
    STAFF_OPERATIONAL_ROLES.has(normalized) ||
    HR_ROLES.has(normalized) ||
    ACCOUNTANT_ROLES.has(normalized)
  );
};`,
);

const authProviderPath = "src/context/AuthProvider.jsx";
replaceOnce(
  authProviderPath,
  `import { isStaffOperationalRole } from "@/utils/frontendRoleAccess";`,
  `import { isRestaurantScopedRole } from "@/utils/frontendRoleAccess";`,
);
replaceOnce(
  authProviderPath,
  `const isStaffAccessRole = (roleName) => isStaffOperationalRole(roleName);`,
  `const isRestaurantScopedAccessRole = (roleName) => isRestaurantScopedRole(roleName);`,
);
replaceAllLiteral(authProviderPath, `isStaffAccessRole(roleName)`, `isRestaurantScopedAccessRole(roleName)`);
replaceOnce(
  authProviderPath,
  `      roleName === "admin" ||
      !["manager", "hr", "accountant"].includes(roleName),`,
  `      roleName !== "manager",`,
);
replaceOnce(
  authProviderPath,
  `  const restaurantsLoading =
    (roleName === "admin" && adminRestaurantsLoading) ||
    (["manager", "hr", "accountant"].includes(roleName) && managerRestaurantsLoading);`,
  `  const restaurantsLoading =
    (roleName === "admin" && adminRestaurantsLoading) ||
    (roleName === "manager" && managerRestaurantsLoading);`,
);
replaceOnce(
  authProviderPath,
  `    if (["manager", "hr", "accountant"].includes(roleName)) {`,
  `    if (roleName === "manager") {`,
);
replaceOnce(
  authProviderPath,
  `  const { data: urrData, error: urrError } = useQuery(GET_USER_REFRESTAURANTS, {
    variables: { userId: user?.id },
    skip: user?.roleName !== "customer",
    onCompleted: (urrData) => {
      setRefRestaurant(urrData.refRestaurants || []);
    },
  });
  useEffect(() => {
    if (urrError) {
      setRefRestaurant([]);
    }
  }, [urrError]);
  useEffect(() => {
    if (urrData && urrData.refRestaurants) {
      setRestaurants(urrData.refRestaurants);
    }
  }, [urrData]);`,
  `  const { error: recentRestaurantsError } = useQuery(GET_USER_REFRESTAURANTS, {
    variables: { userId: user?.id },
    skip: !user?.id || roleName !== "customer",
    onCompleted: (data) => {
      if (roleName !== "customer") return;
      const recentRestaurants = data?.refRestaurants || [];
      setRefRestaurant(recentRestaurants);
      setRestaurants(recentRestaurants);
    },
  });
  useEffect(() => {
    if (recentRestaurantsError && roleName === "customer") {
      setRefRestaurant([]);
      setRestaurants([]);
    }
  }, [recentRestaurantsError, roleName]);`,
);

const staffMutationPath = "cohan-restaurant-backend/graphql/resolvers/staff/mutation.js";
replaceOnce(
  staffMutationPath,
  `  requireAuth,
  requireRestaurantAccess,
  requireRoles,
  requireRestaurantScope,
} from "../../guards.js";`,
  `  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";`,
);
replaceOnce(
  staffMutationPath,
  `      requireRestaurantScope(ctx, restaurantId);`,
  `      await requireRestaurantAccess(ctx, restaurantId);`,
);

const staffQueryPath = "cohan-restaurant-backend/graphql/resolvers/staff/query.js";
replaceOnce(
  staffQueryPath,
  `  requireAuth,
  requireRestaurantScope,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";`,
  `  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";`,
);

const communicationPath = "cohan-restaurant-backend/graphql/resolvers/communication/index.js";
replaceOnce(
  communicationPath,
  `const getUserRestaurantIds = (user) => {
  const ids = [];
  if (user?.restaurantForStaff) ids.push(String(user.restaurantForStaff));
  if (Array.isArray(user?.refRestaurants)) {
    user.refRestaurants.forEach((id) => ids.push(String(id)));
  }
  return [...new Set(ids.filter(Boolean))];
};`,
  `const getUserRestaurantIds = (user) => {
  const ids = [user?.restaurantForStaff, user?.restaurantId];
  if (Array.isArray(user?.restaurantIds)) ids.push(...user.restaurantIds);
  return [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
};`,
);
replaceOnce(
  communicationPath,
  `  const users = await User.find({
    userType: { $in: userTypes },
    $or: [
      { restaurantForStaff: thread.restaurantId },
      { refRestaurants: thread.restaurantId },
    ],
  })
    .select("_id")
    .lean();

  return users
    .map((u) => String(u._id))
    .filter((id) => id !== String(senderId));`,
  `  const users = await User.find({
    userType: { $in: userTypes },
    restaurantForStaff: thread.restaurantId,
  })
    .select("_id")
    .lean();

  const recipientIds = users.map((u) => String(u._id));
  if (["management", "manager", "support"].includes(String(thread.targetRole || "").toLowerCase())) {
    const restaurant = await Restaurant.findById(thread.restaurantId).select("managerId").lean();
    if (restaurant?.managerId) recipientIds.push(String(restaurant.managerId));
  }

  return [...new Set(recipientIds)].filter((id) => id !== String(senderId));`,
);
replaceOnce(
  communicationPath,
  `async function requireRestaurantScopeIfProvided(ctx, restaurantId) {
  if (!restaurantId) return null;
  const rid = toId(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);
  return rid;
}`,
  `async function requireRestaurantScopeIfProvided(ctx, restaurantId, { allowCustomerPublic = false } = {}) {
  if (!restaurantId) return null;
  const rid = toId(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  const isCustomer = roleSlug(ctx?.user) === "customer" || String(ctx?.user?.userType || "").toUpperCase() === "CUSTOMER";
  if (allowCustomerPublic && isCustomer) {
    const exists = await Restaurant.exists({ _id: rid });
    if (!exists) throw badInput("Invalid restaurantId");
    return rid;
  }

  await requireRestaurantAccess(ctx, rid);
  return rid;
}`,
);
replaceOnce(
  communicationPath,
  `  const roleCondition = { toRole: userRole };
  if (rid) roleCondition.restaurantId = rid;
  else if (!roleSlug(user).includes("admin")) {
    const scopedIds = getUserRestaurantIds(user).map(toId).filter(Boolean);
    roleCondition.restaurantId = { $in: scopedIds };
  }
  const cond = { $or: [{ toUserId: uid }, roleCondition] };
  if (rid) cond.restaurantId = rid;`,
  `  const isCustomer = userRole === "customer" || String(user?.userType || "").toUpperCase() === "CUSTOMER";
  const cond = isCustomer
    ? { toUserId: uid }
    : { $or: [{ toUserId: uid }, { toRole: userRole }] };

  if (!isCustomer) {
    const roleCondition = cond.$or[1];
    if (rid) roleCondition.restaurantId = rid;
    else if (!userRole.includes("admin")) {
      const scopedIds = getUserRestaurantIds(user).map(toId).filter(Boolean);
      roleCondition.restaurantId = { $in: scopedIds };
    }
  }
  if (rid) cond.restaurantId = rid;`,
);
replaceOnce(
  communicationPath,
  `    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);`,
  `    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId, { allowCustomerPublic: true });`,
);
replaceOnce(
  communicationPath,
  `    const rid = await requireRestaurantScopeIfProvided(ctx, input?.restaurantId);`,
  `    const rid = await requireRestaurantScopeIfProvided(ctx, input?.restaurantId, { allowCustomerPublic: true });`,
);

const authServicePath = "cohan-restaurant-backend/src/services/auth/authorization.service.js";
replaceOnce(
  authServicePath,
  `const AI_CHATBOT_MANAGER_PERMISSIONS = [
  "ai.chatbot.read",
  "ai.chatbot.write",
  "ai.chatbot.moderate",
  "ai.chatbot.evaluate",
  "ai.chatbot.handoff",
  "ai.chatbot.analytics.read",
];`,
  `const AI_CHATBOT_MANAGER_PERMISSIONS = [
  "ai.chatbot.read",
  "ai.chatbot.write",
  "ai.chatbot.moderate",
  "ai.chatbot.evaluate",
  "ai.chatbot.handoff",
  "ai.chatbot.analytics.read",
];

const REVIEW_MANAGER_PERMISSIONS = [
  "review.read",
  "review.reply",
  "review.moderate",
  "review.delete",
  "review.report.read",
  "review.report.resolve",
  "review.export",
  "review.analytics.read",
];`,
);
replaceOnce(
  authServicePath,
  `    ...AI_CHATBOT_MANAGER_PERMISSIONS,
  ],
  hr: ["staff.read", "shift.read", "report.read", "attendance.read", "performance.read"],
  accountant: ["payment.read", "payment.write", "finance.read", "finance.write", "finance.export", "transaction.read", "transaction.write", "reconciliation.read", "reconciliation.write", "refund.read", "refund.write", "report.read", "report.export", "payroll.read"],
});`,
  `    ...AI_CHATBOT_MANAGER_PERMISSIONS,
    ...REVIEW_MANAGER_PERMISSIONS,
  ],
  hr: ["staff.read", "shift.read", "report.read", "attendance.read", "performance.read"],
  accountant: ["payment.read", "payment.write", "finance.read", "finance.write", "finance.export", "transaction.read", "transaction.write", "reconciliation.read", "reconciliation.write", "refund.read", "refund.write", "report.read", "report.export", "payroll.read"],
  staff: ["review.read", "review.reply"],
  supervisor: ["review.read", "review.reply", "review.moderate", "review.report.read"],
});`,
);

const reviewQueryPath = "cohan-restaurant-backend/graphql/resolvers/review/query.js";
replaceOnce(
  reviewQueryPath,
  `import { requirePermission, requireRestaurantAccess } from "../../guards.js";`,
  `import { requirePermission, requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";`,
);
replaceOnce(
  reviewQueryPath,
  `async function requireReviewModerationAccess(ctx, review) { requirePermission(ctx, "review.read"); await requireRestaurantAccess(ctx, review.restaurantId); }`,
  `async function requireReviewModerationAccess(ctx, review) { await requireRestaurantPermission(ctx, review.restaurantId, "review.read"); }`,
);
replaceOnce(
  reviewQueryPath,
  `  try { requirePermission(ctx, permission); await requireRestaurantAccess(ctx, restaurantId); return true; } catch (_) { return false; }`,
  `  try { await requireRestaurantPermission(ctx, restaurantId, permission); return true; } catch (_) { return false; }`,
);
replaceAllLiteral(
  reviewQueryPath,
  `    requirePermission(ctx, "review.report.read");
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    else if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");`,
  `    if (restaurantId) await requireRestaurantPermission(ctx, restaurantId, "review.report.read");
    else {
      if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      await requirePermission(ctx, "review.report.read");
    }`,
);
replaceOnce(
  reviewQueryPath,
  `    requirePermission(ctx, "review.analytics.read");
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    else if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");`,
  `    if (restaurantId) await requireRestaurantPermission(ctx, restaurantId, "review.analytics.read");
    else {
      if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      await requirePermission(ctx, "review.analytics.read");
    }`,
);

const reviewMutationPath = "cohan-restaurant-backend/graphql/resolvers/review/mutation.js";
replaceOnce(
  reviewMutationPath,
  `import { requirePermission, requireRestaurantAccess } from "../../guards.js";`,
  `import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";`,
);
replaceOnce(
  reviewMutationPath,
  `      requirePermission(ctx, "review.moderate");
      await requireRestaurantAccess(ctx, before.restaurantId);`,
  `      await requireRestaurantPermission(ctx, before.restaurantId, "review.moderate");`,
);
replaceOnce(
  reviewMutationPath,
  `    requirePermission(ctx, "review.moderate");
    await requireRestaurantAccess(ctx, before.restaurantId);`,
  `    await requireRestaurantPermission(ctx, before.restaurantId, "review.moderate");`,
);
replaceOnce(
  reviewMutationPath,
  `    requirePermission(ctx, "review.report.resolve");
    await requireRestaurantAccess(ctx, report.restaurantId);`,
  `    await requireRestaurantPermission(ctx, report.restaurantId, "review.report.resolve");`,
);

const reviewCommentMutationPath = "cohan-restaurant-backend/graphql/resolvers/review_comment/mutation.js";
replaceOnce(
  reviewCommentMutationPath,
  `import { requirePermission, requireRestaurantAccess } from "../../guards.js";`,
  `import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";`,
);
replaceAllLiteral(
  reviewCommentMutationPath,
  `      requirePermission(ctx, "review.reply");
      await requireRestaurantAccess(ctx, review.restaurantId);`,
  `      await requireRestaurantPermission(ctx, review.restaurantId, "review.reply");`,
);
replaceOnce(
  reviewCommentMutationPath,
  `    else { requirePermission(ctx, "review.moderate"); await requireRestaurantAccess(ctx, comment.restaurantId); if (input.status) patch.status = input.status; }`,
  `    else { await requireRestaurantPermission(ctx, comment.restaurantId, "review.moderate"); if (input.status) patch.status = input.status; }`,
);
replaceOnce(
  reviewCommentMutationPath,
  `    if (!isOwner(ctx, comment)) { requirePermission(ctx, "review.delete"); await requireRestaurantAccess(ctx, comment.restaurantId); }`,
  `    if (!isOwner(ctx, comment)) { await requireRestaurantPermission(ctx, comment.restaurantId, "review.delete"); }`,
);
replaceOnce(
  reviewCommentMutationPath,
  `    requirePermission(ctx, "review.moderate");
    await requireRestaurantAccess(ctx, comment.restaurantId);`,
  `    await requireRestaurantPermission(ctx, comment.restaurantId, "review.moderate");`,
);

const reviewCommentQueryPath = "cohan-restaurant-backend/graphql/resolvers/review_comment/query.js";
write(reviewCommentQueryPath, `import { GraphQLError } from "graphql";
import { Review, ReviewComment } from "../../../models/index.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function roleSlug(user) { return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase(); }
function isStaffLike(user) { const role = roleSlug(user); return role.includes("staff") || role.includes("manager") || role.includes("admin") || role === "hr" || role === "accountant" || role === "supervisor"; }
function isOwner(ctx, doc) { const uid = ctx?.user?.id; return uid && String(doc?.createdBy || doc?.userId) === String(uid); }
function forbidden(message = "Forbidden") { return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } }); }

export default {
  reviewComments: async (_, { reviewId, parentId, limit = 20, skip = 0 }, ctx) => {
    const review = await Review.findById(reviewId).select({ status: 1, restaurantId: 1, createdBy: 1 }).lean();
    if (!review) return { total: 0, items: [] };
    let canViewAllStatuses = false;
    if (review.status !== "published") {
      if (isOwner(ctx, review)) canViewAllStatuses = true;
      else {
        if (!isStaffLike(ctx?.user)) throw forbidden();
        await requireRestaurantPermission(ctx, review.restaurantId, "review.read");
        canViewAllStatuses = true;
      }
    } else if (isStaffLike(ctx?.user)) {
      try {
        await requireRestaurantPermission(ctx, review.restaurantId, "review.read");
        canViewAllStatuses = true;
      } catch (_) {
        canViewAllStatuses = false;
      }
    }
    const filter = { reviewId, parentId: !parentId ? null : parentId };
    if (!canViewAllStatuses) filter.status = "published";
    const total = await ReviewComment.countDocuments(filter);
    const sort = parentId === null || parentId === undefined ? { createdAt: -1 } : { createdAt: 1 };
    const items = await ReviewComment.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true });
    return { total, items };
  },
};
`);

const userMutationPath = "cohan-restaurant-backend/graphql/resolvers/user/mutation.js";
replaceOnce(
  userMutationPath,
  `const WALLET_ALLOWED_CURRENCIES = ["VND"];`,
  `const WALLET_ALLOWED_CURRENCIES = ["VND"];
const RESTAURANT_SCOPED_ROLE_SLUGS = new Set([
  "hr", "accountant", "staff", "server", "supervisor", "host", "cashier",
  "chef", "cook", "kitchen_helper", "cleaner", "shipper", "storekeeper", "bartender",
]);

function roleSlugOf(role) {
  return String(role?.slug || role?.name || role || "").trim().toLowerCase();
}

function assertRestaurantAssignmentForRole(role, restaurantForStaff) {
  const slug = roleSlugOf(role);
  if (RESTAURANT_SCOPED_ROLE_SLUGS.has(slug) && !restaurantForStaff) {
    throw new GraphQLError("restaurantForStaff is required for restaurant-scoped roles", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}`,
);
replaceOnce(
  userMutationPath,
  `    u.role = roleId;
    await u.save();`,
  `    assertRestaurantAssignmentForRole(role, u.restaurantForStaff);
    u.role = roleId;
    if (roleSlugOf(role) === "customer") u.restaurantForStaff = null;
    await u.save();`,
);
replaceOnce(
  userMutationPath,
  `    const actorRestaurantIds = new Set(
      [
        authUser?.restaurantForStaff,
        authUser?.restaurantId,
        ...(Array.isArray(authUser?.restaurantIds) ? authUser.restaurantIds : []),
        ...(Array.isArray(authUser?.refRestaurants) ? authUser.refRestaurants : []),
      ]
        .map((id) => String(id || ""))
        .filter(Boolean),
    );
    const targetRestaurantIds = new Set(
      [
        u?.restaurantForStaff,
        ...(Array.isArray(u?.refRestaurants) ? u.refRestaurants : []),
      ]
        .map((id) => String(id || ""))
        .filter(Boolean),
    );

    if (actorRestaurantIds.size && targetRestaurantIds.size) {
      const inScope = [...targetRestaurantIds].some((id) =>
        actorRestaurantIds.has(id),
      );
      if (!inScope) {
        throw new GraphQLError("FORBIDDEN_SCOPE", {
          extensions: { code: "FORBIDDEN" },
        });
      }
    }

`,
  ``,
);
replaceOnce(
  userMutationPath,
  `    if (Array.isArray(input.refRestaurantIds)) {
      updates.refRestaurants = input.refRestaurantIds.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }

    if (Object.prototype.hasOwnProperty.call(input, "restaurantForStaff")) {`,
  `    let nextRoleDoc = null;
    if (input.roleId) {
      if (!mongoose.isValidObjectId(input.roleId)) {
        throw new GraphQLError("Invalid roleId", { extensions: { code: "BAD_USER_INPUT" } });
      }
      nextRoleDoc = await Role.findById(input.roleId).lean();
      if (!nextRoleDoc) {
        throw new GraphQLError("Role not found", { extensions: { code: "BAD_USER_INPUT" } });
      }
    } else if (u.role) {
      nextRoleDoc = await Role.findById(u.role).lean();
    }

    const nextRoleSlug = roleSlugOf(nextRoleDoc);
    if (Array.isArray(input.refRestaurantIds)) {
      if (nextRoleSlug !== "customer") {
        throw new GraphQLError("refRestaurantIds is customer history and cannot be assigned to staff roles", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.refRestaurants = input.refRestaurantIds.map((id) => new mongoose.Types.ObjectId(id));
    }

    if (Object.prototype.hasOwnProperty.call(input, "restaurantForStaff")) {`,
);
replaceOnce(
  userMutationPath,
  `    if (input.roleId) {
      if (!mongoose.isValidObjectId(input.roleId)) {
        throw new GraphQLError("Invalid roleId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const roleDoc = await Role.findById(input.roleId).lean();
      if (!roleDoc) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.role = input.roleId;
    }

    u.set(updates);`,
  `    const finalRestaurantForStaff = Object.prototype.hasOwnProperty.call(updates, "restaurantForStaff")
      ? updates.restaurantForStaff
      : u.restaurantForStaff;
    assertRestaurantAssignmentForRole(nextRoleDoc, finalRestaurantForStaff);

    if (input.roleId) updates.role = input.roleId;
    if (nextRoleSlug === "customer") updates.restaurantForStaff = null;
    else if (nextRoleSlug && !RESTAURANT_SCOPED_ROLE_SLUGS.has(nextRoleSlug)) updates.restaurantForStaff = null;

    u.set(updates);`,
);

const guardsTestPath = "cohan-restaurant-backend/tests/resolvers/guards-restaurant-access.test.js";
write(guardsTestPath, `import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const RESTAURANT_ID = "r1";

describe("requireRestaurantAccess role matrix", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(false);
  });

  it("allows admin across all restaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "a1", roleName: "admin" } }, RESTAURANT_ID)).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).not.toHaveBeenCalled();
  });

  it("allows manager only when Restaurant.managerId matches", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "m1", roleName: "manager" } }, RESTAURANT_ID)).resolves.toBeUndefined();
    expect(modelMocks.Restaurant.exists).toHaveBeenCalledWith({ _id: RESTAURANT_ID, managerId: "m1" });
  });

  it("does not treat manager refRestaurants as authorization", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "m1", roleName: "manager", refRestaurants: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it.each(["hr", "accountant", "staff", "server", "supervisor", "cashier", "chef", "storekeeper"])(
    "allows %s through restaurantForStaff",
    async (roleName) => {
      const { requireRestaurantAccess } = await import("../../graphql/guards.js");
      await expect(requireRestaurantAccess({ user: { id: `${roleName}-1`, roleName, restaurantForStaff: RESTAURANT_ID } }, RESTAURANT_ID)).resolves.toBeUndefined();
    },
  );

  it("denies restaurant-scoped roles outside their assigned restaurant", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "hr1", roleName: "hr", restaurantForStaff: "other" } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("denies customer access from refRestaurants", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "c1", roleName: "customer", refRestaurants: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("denies customer access from restaurantId or restaurantIds fields", async () => {
    const { requireRestaurantAccess } = await import("../../graphql/guards.js");
    await expect(requireRestaurantAccess({ user: { id: "c1", roleName: "customer", restaurantId: RESTAURANT_ID, restaurantIds: [RESTAURANT_ID] } }, RESTAURANT_ID)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("normalizes _id-only authenticated contexts", async () => {
    const { requireAuth } = await import("../../graphql/guards.js");
    const ctx = { user: { _id: "u1" } };
    expect(() => requireAuth(ctx)).not.toThrow();
    expect(ctx.user.id).toBe("u1");
  });
});
`);

const authorizationTestPath = "cohan-restaurant-backend/tests/services/authorization.service.test.js";
replaceOnce(
  authorizationTestPath,
  `  it("allows manager to manage staff inside assigned restaurant scope", async () => {
    const ctx = {
      user: {
        id: "manager-1",
        roleName: "manager",
        refRestaurants: [RESTAURANT_ID],
      },
    };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.write")).resolves.toBe(true);
  });`,
  `  it("allows manager to manage staff inside a restaurant they own", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const ctx = { user: { id: "manager-1", roleName: "manager" } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.write")).resolves.toBe(true);
  });`,
);
replaceOnce(
  authorizationTestPath,
  `        roleName: "manager",
        refRestaurants: ["rest-other-1"],`,
  `        roleName: "manager",`,
);
replaceOnce(
  authorizationTestPath,
  `  it("returns 403 when user lacks the requested restaurant permission", async () => {`,
  `  it("allows HR read permission only in the assigned restaurant", async () => {
    const ctx = { user: { id: "hr-1", roleName: "hr", restaurantForStaff: RESTAURANT_ID } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.read")).resolves.toBe(true);
    await expect(requireRestaurantPermission(ctx, "rest-other-1", "staff.read")).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows accountant finance permission only in the assigned restaurant", async () => {
    const ctx = { user: { id: "acc-1", roleName: "accountant", restaurantForStaff: RESTAURANT_ID } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "finance.read")).resolves.toBe(true);
    await expect(requireRestaurantPermission(ctx, "rest-other-1", "finance.read")).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("returns 403 when user lacks the requested restaurant permission", async () => {`,
);

const frontendRoleTestPath = "src/utils/frontendRoleAccess.test.js";
replaceOnce(
  frontendRoleTestPath,
  `  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,`,
  `  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
  isRestaurantScopedRole,
  isStaffOperationalRole,`,
);
replaceOnce(
  frontendRoleTestPath,
  `describe("MenuManagement frontend permission mapping", () => {`,
  `describe("restaurant-scoped frontend roles", () => {
  it("keeps HR and accountant out of operational floor roles", () => {
    expect(isStaffOperationalRole("hr")).toBe(false);
    expect(isStaffOperationalRole("accountant")).toBe(false);
  });

  it("maps HR, accountant and operational staff to an assigned restaurant", () => {
    expect(isRestaurantScopedRole("hr")).toBe(true);
    expect(isRestaurantScopedRole("accountant")).toBe(true);
    expect(isRestaurantScopedRole("server")).toBe(true);
    expect(isRestaurantScopedRole("manager")).toBe(false);
    expect(isRestaurantScopedRole("customer")).toBe(false);
  });
});

describe("MenuManagement frontend permission mapping", () => {`,
);

const appFilesToScan = [
  "cohan-restaurant-backend/graphql/resolvers/review/query.js",
  "cohan-restaurant-backend/graphql/resolvers/review/mutation.js",
  "cohan-restaurant-backend/graphql/resolvers/review_comment/query.js",
  "cohan-restaurant-backend/graphql/resolvers/review_comment/mutation.js",
];
for (const file of appFilesToScan) {
  const source = read(file);
  if (source.includes('from "../../guards.js"') && source.includes("requirePermission")) {
    throw new Error(`${file} still imports permission helpers from graphql/guards.js`);
  }
}

if (read(guardsPath).includes("refRestaurants")) {
  throw new Error("graphql/guards.js still references refRestaurants");
}

console.log("Restaurant auth hardening patch applied successfully");
