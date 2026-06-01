// cohan-restaurant-backend/src/services/eventLog.service.js
/**
 * Lấy ip & userAgent từ ctx (GraphQL context / Express req)
 */
async function loadEventLogModel() {
  const mod = await import("../../models/event-log.model.js");
  return mod.default || mod.EventLog || mod;
}

function extractRequestMeta(ctx) {
  const req = ctx?.req || ctx?.request;
  const ip =
    req?.ip ||
    req?.headers?.["x-forwarded-for"] ||
    req?.socket?.remoteAddress ||
    undefined;
  const userAgent = req?.headers?.["user-agent"];
  return { ip, userAgent };
}

/**
 * Hàm log event THẤP NHẤT, generic
 *
 * Dùng trực tiếp khi bạn muốn full-control:
 *  await logEvent({
 *    restaurantId,
 *    verb: "order.create",
 *    object: { kind: "Order", id: orderId },
 *    ctx,
 *  });
 */
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
  ctx, // 👈 context để lấy ip/userAgent nếu cần
}) {
  try {
    // Nếu caller không truyền ip/userAgent thì lấy từ ctx
    if (!ip || !userAgent) {
      const reqMeta = extractRequestMeta(ctx);
      if (!ip) ip = reqMeta.ip;
      if (!userAgent) userAgent = reqMeta.userAgent;
    }

    const EventLog = await loadEventLogModel();
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

/**
 * Helper GENERIC cho mọi domain object.
 *
 * Ý tưởng:
 *  - Bạn chỉ cần truyền objectKind / objectId / objectCode
 *  - (Optional) truyền entity để auto lấy restaurantId, orderId...
 *
 * Ví dụ cho Order:
 *  await logObjectEvent({
 *    ctx,
 *    verb: "order.create",
 *    objectKind: "Order",
 *    objectId: order._id,
 *    objectCode: order.code,
 *    entity: order,              // để auto lấy restaurantId, tableId, ...
 *    userId: ctx.user?.id,
 *    source: "web",
 *    meta: { total: order.totalAmount },
 *  });
 */
export async function logObjectEvent({
  ctx,
  verb,

  // info về actor / context
  userId,
  customerProfileId,
  restaurantId,
  floorId,
  tableId,
  orderId,

  // định danh object chính
  objectKind,
  objectId,
  objectCode,

  // target (nếu có, ví dụ merge table, chuyển order...)
  targetKind,
  targetId,
  targetCode,

  // object/source/status/meta/diff
  source = "pos",
  status = "success",
  meta,
  diff,
  correlationId,
  sessionId,
  at,

  // domain entity gốc (optional) để auto suy ra id/code
  entity,
  targetEntity,
}) {
  // ===== SUY LUẬN restaurantId / orderId... từ entity nếu caller không truyền =====
  const ent = entity || {};
  const tgt = targetEntity || {};

  const resolvedRestaurantId =
    restaurantId ||
    ent.restaurantId ||
    ent.restaurant?.id ||
    ent.restaurant?._id ||
    null;

  const resolvedOrderId =
    orderId || ent.orderId || ent.order?.id || ent.order?._id || null;

  const resolvedFloorId =
    floorId || ent.floorId || ent.floor?.id || ent.floor?._id || null;

  const resolvedTableId =
    tableId || ent.tableId || ent.table?.id || ent.table?._id || null;

  // ===== Object chính =====
  const objId =
    objectId ||
    ent._id ||
    ent.id ||
    (typeof ent === "string" ? ent : undefined);

  const objCode =
    objectCode ||
    ent.code ||
    ent.name ||
    (typeof ent === "string" ? ent : undefined);

  const object = {
    kind: objectKind,
    id: objId,
    code: objCode,
  };

  // ===== Target (nếu có) =====
  let target = undefined;
  if (targetKind || targetId || targetCode || targetEntity) {
    const tId =
      targetId ||
      tgt._id ||
      tgt.id ||
      (typeof tgt === "string" ? tgt : undefined);
    const tCode =
      targetCode ||
      tgt.code ||
      tgt.name ||
      (typeof tgt === "string" ? tgt : undefined);

    target = {
      kind: targetKind || tgt.kind || "Unknown",
      id: tId,
      code: tCode,
    };
  }

  return logEvent({
    restaurantId: resolvedRestaurantId || undefined,
    floorId: resolvedFloorId || undefined,
    tableId: resolvedTableId || undefined,
    orderId: resolvedOrderId || undefined,
    actorUserId: userId || undefined,
    customerProfileId: customerProfileId || undefined,
    verb,
    object,
    target,
    source,
    status,
    meta,
    diff,
    correlationId,
    sessionId,
    at,
    ctx,
  });
}

/**
 * OPTIONAL: Helper mỏng cho Cart
 * - Bạn có thể dùng hoặc bỏ, vì logObjectEvent đã đủ dùng cho mọi domain
 *
 * Ví dụ:
 *  await logCartEvent({
 *    ctx,
 *    restaurantId,
 *    userId,
 *    cartId: cart.id,
 *    verb: "cart.add_item",
 *    meta: { menuItemId, quantity },
 *    diff,
 *  });
 */
export async function logCartEvent({
  ctx,
  restaurantId,
  userId,
  cartId,
  status = "success",
  meta,
  diff,
  correlationId,
  sessionId,
}) {
  return logObjectEvent({
    ctx,
    verb: "cart.add_item",
    objectKind: "Cart",
    objectId: cartId,
    objectCode: String(cartId),
    restaurantId,
    userId,
    source: "web",
    status,
    meta,
    diff,
    correlationId,
    sessionId,
  });
}
