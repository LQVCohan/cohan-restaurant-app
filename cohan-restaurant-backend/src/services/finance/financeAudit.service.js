import mongoose from "mongoose";
import process from "node:process";
import { AuditLog } from "../../../models/index.js";

const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);

export async function writeFinanceAudit(ctx, payload = {}) {
  try {
    return await AuditLog.create({
      module: "finance",
      restaurantId: payload.restaurantId || null,
      action: payload.action,
      actorId: toObjectId(ctx?.user?.id || ctx?.user?._id),
      actorName: ctx?.user?.name || ctx?.user?.email || null,
      actorRole: ctx?.user?.roleName || ctx?.user?.userType || ctx?.user?.role?.slug || null,
      targetType: payload.targetType,
      targetId: payload.targetId || null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      metadata: payload.metadata || {},
    });
  } catch (error) {
    const message = `[financeAudit] failed to write ${payload.action || "audit"}: ${error?.message || error}`;
    if (process.env.NODE_ENV === "test" && process.env.FINANCE_AUDIT_STRICT === "1") throw error;
    console.warn(message);
    return null;
  }
}
