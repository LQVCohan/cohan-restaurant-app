// cohan-restaurant-backend/src/services/eventLog.service.js
import EventLog from "../../models/event-log.model.js";

export async function logEvent({
  restaurantId,
  floorId,
  tableId,
  orderId,
  actorUserId,
  customerProfileId,
  verb,
  object,
  target,
  source = "pos",
  ip,
  userAgent,
  sessionId,
  correlationId,
  status = "success",
  meta,
  diff,
  at = new Date(),
}) {
  try {
    await EventLog.create({
      restaurantId,
      floorId,
      tableId,
      orderId,
      actorUserId,
      customerProfileId,
      verb,
      object,
      target,
      source,
      ip,
      userAgent,
      sessionId,
      correlationId,
      status,
      meta,
      diff,
      at,
    });
  } catch (e) {
    // Không để log làm hỏng flow chính
    console.error("logEvent error:", e?.message);
  }
}
