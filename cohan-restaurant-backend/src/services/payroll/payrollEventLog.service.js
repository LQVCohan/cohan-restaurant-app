import mongoose from "mongoose";
import { EventLog } from "../../../models/index.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function logPayrollEvent({
  ctx,
  restaurantId,
  verb,
  objectKind,
  objectId,
  status = "success",
  meta = {},
  diff = null,
}) {
  try {
    await EventLog.log({
      restaurantId: toObjectId(restaurantId),
      actorUserId: toObjectId(ctx?.user?.id || ctx?.user?._id),
      verb,
      source: "api",
      status,
      object: objectKind
        ? {
            kind: objectKind,
            id: toObjectId(objectId),
          }
        : undefined,
      meta,
      diff,
      at: new Date(),
    });
  } catch (error) {
    console.error("[payroll-event-log] failed", { verb, restaurantId, objectId, error: error?.message });
  }
}
