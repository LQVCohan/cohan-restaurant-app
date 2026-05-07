import { GraphQLError } from "graphql";
import { Review, ReviewReaction } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { logReviewEvent } from "../../../utils/logReview.js";

const VALID_REACTIONS = ["like", "love", "care", "haha", "wow", "sad", "angry"];

function roleSlug(user) {
  return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase();
}
function isStaffLike(user) {
  const role = roleSlug(user);
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
}
function isOwner(ctx, doc) {
  const uid = ctx?.user?.id;
  return uid && String(doc?.createdBy || doc?.userId) === String(uid);
}
function forbidden(message = "Forbidden") { return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } }); }

export default {
  createReview: async (_, { input }, ctx) => {
    if (!ctx?.user?.id) throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
    const payload = { ...input, status: "pending", createdBy: ctx.user.id };
    delete payload.updatedBy;
    const created = await Review.create(payload);
    await logReviewEvent({ review: created, verb: "review.create", ctx, meta: { rating: created.rating } });
    return created;
  },
  updateReview: async (_, { id, input }, ctx) => {
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");
    const patch = { ...input, updatedBy: ctx?.user?.id || null };
    delete patch.restaurantId; delete patch.createdBy; delete patch.updatedBy; delete patch.reactions; delete patch.helpfulCount;
    if (isOwner(ctx, before)) delete patch.status;
    else { if (!isStaffLike(ctx?.user)) throw forbidden(); await requireRestaurantAccess(ctx, before.restaurantId); }
    const updated = await Review.findByIdAndUpdate(id, patch, { new: true });
    await logReviewEvent({ review: updated, verb: "review.update", ctx, diff: { before: { rating: before.rating, title: before.title, content: before.content, status: before.status }, after: { rating: updated.rating, title: updated.title, content: updated.content, status: updated.status } } });
    return updated;
  },
  deleteReview: async (_, { id }, ctx) => {
    const review = await Review.findById(id);
    if (!review) return false;
    if (!isOwner(ctx, review)) { if (!isStaffLike(ctx?.user)) throw forbidden(); await requireRestaurantAccess(ctx, review.restaurantId); }
    await Review.findByIdAndDelete(id);
    await logReviewEvent({ review, verb: "review.delete", ctx, diff: { deletedId: id } });
    return true;
  },
  setReviewStatus: async (_, { id, status }, ctx) => {
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");
    if (!isStaffLike(ctx?.user)) throw forbidden();
    await requireRestaurantAccess(ctx, before.restaurantId);
    const updated = await Review.findByIdAndUpdate(id, { status, updatedBy: ctx?.user?.id || null }, { new: true });
    await logReviewEvent({ review: updated, verb: "review.status", ctx, diff: { from: before.status, to: status } });
    return updated;
  },
  incrementReviewHelpful: async (_, { id }, ctx) => {
    const review = await Review.findById(id).lean();
    if (!review) return null;
    if (review.status !== "published") throw forbidden();
    const updated = await Review.findByIdAndUpdate(id, { $inc: { helpfulCount: 1 }, updatedBy: ctx?.user?.id || null }, { new: true });
    await logReviewEvent({ review: updated, verb: "review.helpful", ctx, meta: { helpfulCount: updated.helpfulCount } });
    return updated;
  },
  reactReview: async (_, { id, reaction }, ctx) => {
    const userId = ctx?.user?.id;
    if (!userId) throw new Error("Login required");
    const key = reaction.toLowerCase();
    if (!VALID_REACTIONS.includes(key)) throw new Error("Invalid reaction");
    const review = await Review.findById(id);
    if (!review) throw new Error("Review not found");
    if (review.status !== "published") throw forbidden();
    const existing = await ReviewReaction.findOne({ reviewId: id, userId });
    let inc = {}; let dec = {}; let action = "set";
    if (!existing) { await ReviewReaction.create({ reviewId: id, restaurantId: review.restaurantId, userId, type: key, createdBy: userId }); inc[key]=1; }
    else if (existing.type===key) { await ReviewReaction.deleteOne({ _id: existing._id }); dec[key]=1; action="unset"; }
    else { await ReviewReaction.findByIdAndUpdate(existing._id, { type:key, updatedBy:userId }); dec[existing.type]=1; inc[key]=1; action="change"; }
    const update={}; Object.entries(inc).forEach(([k,v])=>update[`reactions.${k}`]=v); Object.entries(dec).forEach(([k,v])=>update[`reactions.${k}`]=-v);
    const updated = await Review.findByIdAndUpdate(id, { $inc: update, updatedBy: userId }, { new: true });
    await logReviewEvent({ review: updated, verb: "review.react", ctx, meta: { reaction:key, action }, diff:{inc,dec} });
    return updated;
  },
};
