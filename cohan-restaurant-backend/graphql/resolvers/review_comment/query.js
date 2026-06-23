import { GraphQLError } from "graphql";
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
