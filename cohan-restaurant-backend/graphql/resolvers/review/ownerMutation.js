import Review from "../../../models/review.model.js";
import { logReviewEvent } from "../../../utils/logReview.js";
import {
  analyzeReviewText,
  forbidden,
  normalizeReviewInput,
  normalizeReviewStaff,
  unauthenticated,
} from "../../../src/services/reviewHardening.service.js";

function currentUserId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

function isOwner(ctx, review) {
  const userId = currentUserId(ctx);
  return Boolean(
    userId &&
      String(review?.customerId || review?.createdBy || review?.userId || "") ===
        String(userId),
  );
}

export async function resolveOwnerUpdateReview(
  baseResolver,
  root,
  { id, input = {} },
  ctx,
  info,
) {
  const userId = currentUserId(ctx);
  if (!userId)
    throw unauthenticated("Vui lòng đăng nhập để chỉnh sửa đánh giá.");

  const before = await Review.findById(id);
  if (!before) throw new Error("Review not found");
  if (!isOwner(ctx, before)) {
    return baseResolver(root, { id, input }, ctx, info);
  }
  if (before.status === "hidden") {
    throw forbidden("Đánh giá đã xóa không thể chỉnh sửa.");
  }
  if (before.status === "reported") {
    throw forbidden(
      "Đánh giá đang được xem xét nên tạm thời chưa thể chỉnh sửa.",
    );
  }

  const normalized = normalizeReviewInput({
    ...before.toObject(),
    ...input,
    rating: input.rating ?? before.rating,
    content: input.content ?? before.content,
    title: input.title ?? before.title,
    images: input.images ?? before.images,
    tags: input.tags ?? before.tags,
    location: input.location ?? before.location,
  });

  const patch = {
    ...normalized,
    ...analyzeReviewText(normalized.title, normalized.content),
    updatedBy: userId,
  };

  if (Object.prototype.hasOwnProperty.call(input, "staffId")) {
    Object.assign(
      patch,
      await normalizeReviewStaff({
        staffId: input.staffId,
        restaurantId: before.restaurantId,
      }),
    );
  }

  const updated = await Review.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  await logReviewEvent({
    review: updated,
    verb: "review.owner.update",
    ctx,
    diff: {
      before: {
        rating: before.rating,
        title: before.title,
        content: before.content,
        staffId: before.staffId,
        status: before.status,
      },
      after: {
        rating: updated.rating,
        title: updated.title,
        content: updated.content,
        staffId: updated.staffId,
        status: updated.status,
      },
    },
  });

  return updated;
}

export async function resolveOwnerDeleteReview(
  baseResolver,
  root,
  { id },
  ctx,
  info,
) {
  const userId = currentUserId(ctx);
  if (!userId) throw unauthenticated("Vui lòng đăng nhập để xóa đánh giá.");

  const review = await Review.findById(id);
  if (!review) return false;
  if (!isOwner(ctx, review)) {
    return baseResolver(root, { id }, ctx, info);
  }
  if (review.status === "hidden") return true;

  const previousStatus = review.status;
  const deletedAt = new Date();
  await Review.findByIdAndUpdate(
    id,
    {
      status: "hidden",
      moderationReason: "owner_deleted",
      moderationNote: "Khách hàng tự xóa đánh giá trên trang nhà hàng.",
      moderatedBy: userId,
      moderatedAt: deletedAt,
      updatedBy: userId,
    },
    { new: false },
  );

  await logReviewEvent({
    review,
    verb: "review.owner.softDelete",
    ctx,
    diff: { from: previousStatus, to: "hidden" },
    meta: { deletedAt: deletedAt.toISOString() },
  });

  return true;
}

export default {
  resolveOwnerUpdateReview,
  resolveOwnerDeleteReview,
};
