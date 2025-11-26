import { EventLog } from "../models/index.js";

export async function logReviewEvent({
  review,
  verb,
  ctx,
  meta = {},
  diff = {},
}) {
  try {
    await EventLog.log({
      restaurantId: review.restaurantId,
      actorUserId: ctx?.user?.id || null,
      verb,

      object: {
        kind: "Review",
        id: review._id,
        code: review.id || String(review._id),
      },

      target: review.targetId
        ? {
            kind: review.targetType,
            id: review.targetId,
            code: review.targetName || null,
          }
        : null,

      source: "web",
      status: "success",
      meta,
      diff,

      correlationId: ctx?.requestId,
      sessionId: ctx?.sessionId,
    });
  } catch (err) {
    console.error("Review EventLog error:", err.message);
  }
}
