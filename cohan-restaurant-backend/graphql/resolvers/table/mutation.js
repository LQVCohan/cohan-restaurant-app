import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  hasActiveOrdersForTable,
  hasActiveReservationsForTable,
  getTableAvailabilityBlockReason,
} from "../../../utils/tableStateGuards.js";

const TABLE_QR_CLEAR_PATCH = {
  tableAccessToken: null,
  tableAccessUrl: null,
  tableQrCodeDataUrl: null,
  tableQrGeneratedAt: null,
  tableQrExpiresAt: null,
};

const ensureFloorLevel = async (floorId) => {
  const f = await Floor.findById(floorId).select({ level: 1 }).lean();
  if (!f) throw new GraphQLError("Floor not found");
  return f.level ?? 1;
};

const normalizeTableCode = (value = "") =>
  String(value).trim().replace(/\s+/g, " ").toLowerCase();

const humanizeTableCode = (value = "") =>
  String(value).trim().replace(/\s+/g, " ");

const duplicateTableError = (code) =>
  new GraphQLError(
    `Bàn '${code}' đã tồn tại trong tầng này. Vui lòng dùng tên khác.`,
    {
      extensions: {
        code: "TABLE_CODE_DUPLICATE",
        field: "code",
      },
    }
  );

const ensureUniqueTableCodeInFloor = async ({
  restaurantId,
  floorId,
  code,
  excludeId,
}) => {
  const normalizedCode = normalizeTableCode(code);
  if (!normalizedCode) {
    throw new GraphQLError("Table code is required", {
      extensions: { code: "BAD_USER_INPUT", field: "code" },
    });
  }
  const records = await Table.find({
    restaurantId,
    floorId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select({ _id: 1, code: 1 })
    .lean();
  const duplicated = records.some(
    (record) => normalizeTableCode(record.code) === normalizedCode
  );
  if (duplicated) {
    throw duplicateTableError(humanizeTableCode(code));
  }
};

const mapDuplicateMongoError = (error, fallbackCode) => {
  if (error?.code === 11000) {
    throw duplicateTableError(humanizeTableCode(fallbackCode));
  }
  throw error;
};

const TABLE_STATUSES_REQUIRING_NO_ACTIVE_ORDERS = new Set([
  "available",
  "cleaning",
  "offline",
  "maintenance",
]);

const VISUAL_CONFIG_STRING_LIMITS = {
  modelKey: 160,
  modelLabel: 240,
  tableType: 80,
  source: 240,
  sourceLabel: 240,
  licenseLabel: 240,
  fallbackKind: 80,
  customModelKind: 80,
  sourceType: 80,
  savedAt: 80,
};
const MAX_VISUAL_CONFIG_TAGS = 20;
const MAX_VISUAL_CONFIG_TAG_LENGTH = 48;
const SAFE_SOURCE_TYPES = new Set([
  "catalog",
  "custom-url",
  "custom-parametric",
  "camera-preview",
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isPlainObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const sanitizeString = (value, maxLength = 240) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const sanitizeHttpUrl = (value) => {
  const normalized = sanitizeString(value, 2048);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const sanitizePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();

  return tags
    .map((tag) => sanitizeString(tag, MAX_VISUAL_CONFIG_TAG_LENGTH))
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_VISUAL_CONFIG_TAGS);
};

const sanitizeDimensions = (dimensionsInput) => {
  if (!isPlainObject(dimensionsInput)) return null;
  const dimensions = {
    widthCm: sanitizePositiveNumber(dimensionsInput.widthCm),
    depthCm: sanitizePositiveNumber(dimensionsInput.depthCm),
    heightCm: sanitizePositiveNumber(dimensionsInput.heightCm),
    diameterCm: sanitizePositiveNumber(
      dimensionsInput.diameterCm ?? dimensionsInput.diameter
    ),
  };

  return Object.values(dimensions).some((value) => value != null)
    ? dimensions
    : null;
};

const sanitizePlacement = (placementInputValue) => {
  const placementInput = isPlainObject(placementInputValue)
    ? placementInputValue
    : {};
  return {
    x: clamp(Number(placementInput.x ?? 50) || 50, 5, 95),
    y: clamp(Number(placementInput.y ?? 50) || 50, 5, 95),
    scale: clamp(Number(placementInput.scale ?? 1) || 1, 0.5, 2),
    rotation: Number(placementInput.rotation ?? 0) || 0,
    opacity: clamp(Number(placementInput.opacity ?? 0.78) || 0.78, 0.35, 1),
  };
};

export const sanitizeVisualConfig = (value) => {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new GraphQLError("visualConfig must be an object or null", {
      extensions: { code: "BAD_USER_INPUT", field: "visualConfig" },
    });
  }

  const sourceType = sanitizeString(
    value.sourceType || value.source,
    VISUAL_CONFIG_STRING_LIMITS.sourceType
  );
  const sanitizedSourceType = SAFE_SOURCE_TYPES.has(sourceType)
    ? sourceType
    : "camera-preview";
  const modelUrl = sanitizeHttpUrl(value.modelUrl);

  return {
    modelKey: sanitizeString(value.modelKey, VISUAL_CONFIG_STRING_LIMITS.modelKey),
    modelLabel: sanitizeString(value.modelLabel, VISUAL_CONFIG_STRING_LIMITS.modelLabel),
    tableType: sanitizeString(value.tableType, VISUAL_CONFIG_STRING_LIMITS.tableType),
    capacity: sanitizePositiveNumber(value.capacity),
    defaultScale: sanitizePositiveNumber(value.defaultScale),
    modelUrl,
    thumbnailUrl: sanitizeHttpUrl(value.thumbnailUrl),
    source: sanitizeString(value.source, VISUAL_CONFIG_STRING_LIMITS.source),
    sourceLabel: sanitizeString(value.sourceLabel, VISUAL_CONFIG_STRING_LIMITS.sourceLabel),
    licenseLabel: sanitizeString(value.licenseLabel, VISUAL_CONFIG_STRING_LIMITS.licenseLabel),
    dimensions: sanitizeDimensions(value.dimensions || value.dimensionsCm),
    tags: sanitizeTags(value.tags),
    fallbackKind:
      sanitizeString(value.fallbackKind, VISUAL_CONFIG_STRING_LIMITS.fallbackKind) ||
      (modelUrl ? "model" : "placeholder"),
    customModelKind: sanitizeString(
      value.customModelKind,
      VISUAL_CONFIG_STRING_LIMITS.customModelKind
    ),
    placement: sanitizePlacement(value.placement),
    savedAt:
      sanitizeString(value.savedAt, VISUAL_CONFIG_STRING_LIMITS.savedAt) ||
      new Date().toISOString(),
    sourceType: sanitizedSourceType,
  };
};

export default {
  createTable: async (_p, { input }, ctx) => {
    const { restaurantId, floorId } = input;
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) {
      throw new GraphQLError("Invalid restaurantId or floorId");
    }
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);
    const normalizedCode = humanizeTableCode(input.code);
    await ensureUniqueTableCodeInFloor({
      restaurantId,
      floorId,
      code: normalizedCode,
    });

    const level = await ensureFloorLevel(floorId);
    const visualConfig = sanitizeVisualConfig(input.visualConfig);
    try {
      const created = await Table.create({
        ...input,
        code: normalizedCode,
        floorLevel: level,
        visualConfig,
      });
      return created.toObject({ virtuals: true });
    } catch (error) {
      mapDuplicateMongoError(error, normalizedCode);
    }
  },
  mergeTables: async (_p, { input }, ctx) => {
    const { restaurantId, tableIds, anchorId, joinGroupId } = input;

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!tableIds || !Array.isArray(tableIds) || tableIds.length < 2) {
      throw new GraphQLError("tableIds must contain at least 2 ids");
    }
    if (!tableIds.every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid tableIds");
    }
    if (anchorId && !mongoose.isValidObjectId(anchorId)) {
      throw new GraphQLError("Invalid anchorId");
    }
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);

    // Lấy toàn bộ bàn, đảm bảo cùng nhà hàng
    const tables = await Table.find({
      _id: { $in: tableIds },
      restaurantId,
    })
      .select({ _id: 1, restaurantId: 1, code: 1, floorId: 1 })
      .lean();

    if (tables.length !== tableIds.length) {
      throw new GraphQLError("Some tables not found or not in this restaurant");
    }
    const floorIds = new Set(tables.map((item) => String(item.floorId || "")));
    if (floorIds.size !== 1) {
      throw new GraphQLError("Cannot merge tables from different floors");
    }

    // Tạo joinGroupId nếu chưa truyền
    const groupId = joinGroupId || new mongoose.Types.ObjectId().toString();

    // Set thuộc tính nhóm
    await Table.updateMany(
      { _id: { $in: tableIds } },
      { $set: { isJoinable: true, joinGroupId: groupId } }
    );

    // log sự kiện gộp
    const anchor = anchorId || tableIds[0];
    await logEvent({
      restaurantId,
      verb: "table.merge",
      object: { kind: "Table", id: anchor },
      meta: {
        joinGroupId: groupId,
        tableIds,
        anchorId: anchor,
      },
      actorUserId: ctx.user?.id,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });

    return { joinGroupId: groupId, anchorId: anchor, tableIds };
  },

  // ===== SPLIT TABLES =====
  splitTables: async (_p, { input }, ctx) => {
    const { restaurantId, joinGroupId, mode, tableIds } = input;

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!joinGroupId) throw new GraphQLError("joinGroupId is required");
    if (!["ALL", "PARTIAL"].includes(mode)) {
      throw new GraphQLError("mode must be ALL or PARTIAL");
    }
    if (mode === "PARTIAL") {
      if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
        throw new GraphQLError("tableIds is required in PARTIAL mode");
      }
      if (!tableIds.every(mongoose.isValidObjectId)) {
        throw new GraphQLError("Invalid tableIds");
      }
    }
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);

    // Xác định tập bàn sẽ tách
    let toUnmergeFilter = { restaurantId, joinGroupId };
    if (mode === "PARTIAL") {
      toUnmergeFilter._id = { $in: tableIds };
    }

    const affected = await Table.updateMany(toUnmergeFilter, {
      $set: { isJoinable: false },
      $unset: { joinGroupId: "" },
    });

    // Lấy lại id các bàn đã tách (để trả về)
    const unmerged = await Table.find({
      restaurantId,
      ...(mode === "PARTIAL" ? { _id: { $in: tableIds } } : {}), // ALL: tất cả bàn của group cũ đã clear
      // Sau khi tách, joinGroupId đã null -> dựa vào ids ở PARTIAL
    })
      .select({ _id: 1 })
      .lean();

    const unmergedTableIds = unmerged.map((x) => x._id.toString());

    // log
    await logEvent({
      restaurantId,
      verb: "table.split",
      object: { kind: "Table" },
      meta: {
        joinGroupId,
        mode,
        unmergedCount: affected.modifiedCount || 0,
        tableIds: mode === "PARTIAL" ? tableIds : undefined,
      },
      actorUserId: ctx.user?.id,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });

    return { ok: true, unmergedTableIds };
  },
  updateTable: async (_p, { input }, ctx) => {
    const { id, ...patch } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const current = await Table.findById(id)
      .select({ _id: 1, restaurantId: 1, floorId: 1, code: 1 })
      .lean();
    if (!current) throw new GraphQLError("Table not found");
    await requireRestaurantPermission(ctx, current.restaurantId, PERMISSIONS.TABLE_WRITE);
    delete patch.restaurantId;

    const nextCode =
      patch.code != null ? humanizeTableCode(patch.code) : current.code;
    const nextFloorId = patch.floorId || current.floorId;

    await ensureUniqueTableCodeInFloor({
      restaurantId: current.restaurantId,
      floorId: nextFloorId,
      code: nextCode,
      excludeId: id,
    });

    if (patch.code != null) patch.code = nextCode;
    if (patch.code != null && nextCode !== current.code) {
      Object.assign(patch, TABLE_QR_CLEAR_PATCH);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "visualConfig")) {
      patch.visualConfig = sanitizeVisualConfig(patch.visualConfig);
    }

    // Nếu đổi floorId thì cập nhật floorLevel
    if (patch.floorId) {
      if (!mongoose.isValidObjectId(patch.floorId))
        throw new GraphQLError("Invalid floorId");
      const floor = await Floor.findById(patch.floorId)
        .select({ restaurantId: 1, level: 1 })
        .lean();
      if (!floor) throw new GraphQLError("Floor not found");
      if (String(floor.restaurantId) !== String(current.restaurantId)) {
        throw new GraphQLError("Floor does not belong to this restaurant");
      }
      const level = floor.level ?? 1;
      patch.floorLevel = level;
    }
    try {
      const doc = await Table.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });
      if (!doc) throw new GraphQLError("Table not found");
      await logEvent({
        restaurantId: doc.restaurantId,
        floorId: doc.floorId,
        tableId: doc.id,
        actorUserId: ctx.user?.id,
        verb: "table.update",
        object: { kind: "Table", id: doc.id, code: doc.code },
        meta: { patch },
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers["user-agent"],
      });
      return doc;
    } catch (error) {
      mapDuplicateMongoError(error, nextCode);
    }
  },

  deleteTable: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    // Lấy thông tin bàn trước khi xóa để ghi log
    const before = await Table.findById(id).lean({ virtuals: true });
    if (!before) return false;
    await requireRestaurantPermission(ctx, before.restaurantId, PERMISSIONS.TABLE_WRITE);

    const activeOrderExists = await hasActiveOrdersForTable({
      restaurantId: before.restaurantId,
      tableId: before._id,
      tableCode: before.code,
    });
    if (activeOrderExists) {
      throw new GraphQLError("Không thể xóa bàn đang có phiên hoặc order hoạt động.", {
        extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
      });
    }

    const activeReservationExists = await hasActiveReservationsForTable({
      restaurantId: before.restaurantId,
      tableId: before._id,
    });
    if (activeReservationExists) {
      throw new GraphQLError("Không thể xóa bàn đang có đặt chỗ hoạt động.", {
        extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
      });
    }

    const res = await Table.deleteOne({ _id: id });

    // Ghi log nếu xóa thành công
    if (res.deletedCount > 0) {
      await logEvent({
        restaurantId: before.restaurantId,
        floorId: before.floorId,
        tableId: before._id,
        actorUserId: ctx?.user?.id,
        verb: "table.delete",
        object: { kind: "Table", id: before._id, code: before.code },
        meta: { name: before.name, status: before.status },
        ip: ctx?.req?.ip,
        userAgent: ctx?.req?.headers?.["user-agent"],
      });
    }

    return res.deletedCount > 0;
  },

  moveTable: async (_p, { input }, ctx) => {
    const { id, floorId, position } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    const current = await Table.findById(id)
      .select({ restaurantId: 1, floorId: 1 })
      .lean();
    if (!current) throw new GraphQLError("Table not found");
    await requireRestaurantPermission(ctx, current.restaurantId, PERMISSIONS.TABLE_WRITE);

    const patch = {};
    if (position) patch.position = position;
    if (floorId) {
      if (!mongoose.isValidObjectId(floorId))
        throw new GraphQLError("Invalid floorId");
      const floor = await Floor.findById(floorId)
        .select({ restaurantId: 1, level: 1 })
        .lean();
      if (!floor) throw new GraphQLError("Floor not found");
      if (String(floor.restaurantId) !== String(current.restaurantId)) {
        throw new GraphQLError("Floor does not belong to this restaurant");
      }
      const level = floor.level ?? 1;
      patch.floorId = floorId;
      patch.floorLevel = level;
    }

    const doc = await Table.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Table not found");
    logEvent({
      restaurantId: doc.restaurantId,
      floorId: doc.floorId,
      tableId: doc.id,
      actorUserId: ctx.user?.id,
      verb: "table.move",
      object: { kind: "Table", id: doc.id, code: doc.code },
      meta: { toFloorId: input.floorId, position: input.position },
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });
    return doc;
  },

  setTableStatus: async (_p, { input }, ctx) => {
    const { id, status } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    const existing = await Table.findById(id)
      .select({ restaurantId: 1, code: 1 })
      .lean();
    if (!existing) throw new GraphQLError("Table not found");
    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.TABLE_WRITE);
    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (normalizedStatus === "available") {
      const tableId = existing._id || id;
      const reason = await getTableAvailabilityBlockReason({
        restaurantId: existing.restaurantId,
        tableId,
        tableCode: existing.code,
      });
      if (reason) {
        throw new GraphQLError(reason.message, {
          extensions: {
            code: reason.code,
            details: reason.details || null,
          },
        });
      }
      const activeReservationExists = await hasActiveReservationsForTable({
        restaurantId: existing.restaurantId,
        tableId,
      });
      if (activeReservationExists) {
        throw new GraphQLError("Không thể trả bàn về trống vì còn đặt chỗ hoạt động.", {
          extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
        });
      }
    } else if (TABLE_STATUSES_REQUIRING_NO_ACTIVE_ORDERS.has(normalizedStatus)) {
      const tableId = existing._id || id;
      const activeOrderExists = await hasActiveOrdersForTable({
        restaurantId: existing.restaurantId,
        tableId,
        tableCode: existing.code,
      });
      if (activeOrderExists) {
        throw new GraphQLError(
          "Không thể chuyển trạng thái bàn khi còn phiên hoặc order hoạt động.",
          {
            extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
          }
        );
      }

      const activeReservationExists = await hasActiveReservationsForTable({
        restaurantId: existing.restaurantId,
        tableId,
      });
      if (activeReservationExists) {
        throw new GraphQLError(
          "Không thể chuyển trạng thái bàn khi còn đặt chỗ hoạt động.",
          {
            extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
          }
        );
      }
    }
    const doc = await Table.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Table not found");
    return doc;
  },

  swapTableCodes: async (_p, { input }, ctx) => {
    const { restaurantId, floorId, aId, bId } = input;
    if (![restaurantId, floorId, aId, bId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);
    const [a, b] = await Promise.all([
      Table.findOne({ _id: aId, restaurantId, floorId })
        .select({ code: 1 })
        .lean(),
      Table.findOne({ _id: bId, restaurantId, floorId })
        .select({ code: 1 })
        .lean(),
    ]);
    if (!a || !b) throw new GraphQLError("Tables not found");

    // Hoán đổi an toàn với code tạm
    const temp = `__SWAP__${a.code}__${Date.now()}`;
    await Table.updateOne({ _id: aId }, { $set: { code: temp } });
    await Table.updateOne({ _id: bId }, { $set: { code: a.code, ...TABLE_QR_CLEAR_PATCH } });
    await Table.updateOne({ _id: aId }, { $set: { code: b.code, ...TABLE_QR_CLEAR_PATCH } });
    logEvent({
      restaurantId,
      verb: "table.swap_codes",
      object: { kind: "Table", id: aId, code: a.code },
      target: { kind: "Table", id: bId, code: b.code },
      meta: { afterA: a.code, afterB: b.code },
      actorUserId: ctx.user?.id,
    });
    return true;
  },

  bulkUpsertTables: async (_p, { input }, ctx) => {
    const { restaurantId, floorId, items } = input;
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) {
      throw new GraphQLError("Invalid restaurantId or floorId");
    }
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);
    const floor = await Floor.findById(floorId)
      .select({ restaurantId: 1, level: 1 })
      .lean();
    if (!floor) throw new GraphQLError("Floor not found");
    if (String(floor.restaurantId) !== String(restaurantId)) {
      throw new GraphQLError("Floor does not belong to this restaurant");
    }
    const level = floor.level ?? 1;

    const ops = items.map((it) => ({
      updateOne: {
        filter: { restaurantId, floorId, code: it.code },
        update: {
          $set: {
            ...it,
            restaurantId,
            floorId,
            floorLevel: level,
          },
        },
        upsert: true,
      },
    }));

    const res = await Table.bulkWrite(ops, { ordered: false });
    const affected = (res.upsertedCount || 0) + (res.modifiedCount || 0);
    return affected;
  },


  acquireTableViewLock: async (_p, { input }, ctx) => {
    const { tableId, userId, sessionId, viewerName } = input || {};
    if (!mongoose.isValidObjectId(tableId)) throw new GraphQLError("Invalid tableId");

    const uid = userId || ctx?.user?.id;
    if (!mongoose.isValidObjectId(uid)) throw new GraphQLError("Invalid userId");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const table = await Table.findById(tableId).lean();
    if (!table) throw new GraphQLError("Table not found");
    await requireRestaurantPermission(ctx, table.restaurantId, PERMISSIONS.TABLE_WRITE);

    const lock = table.viewLock || null;
    const lockActive = lock?.expiresAt && new Date(lock.expiresAt) > now;
    if (lockActive && String(lock.userId) !== String(uid)) {
      throw new GraphQLError("Bàn đang được khách khác xem trong 5 phút.", {
        extensions: { code: "TABLE_VIEW_LOCKED" },
      });
    }

    const updated = await Table.findOneAndUpdate(
      {
        _id: tableId,
        $or: [
          { "viewLock.userId": new mongoose.Types.ObjectId(uid) },
          { "viewLock.expiresAt": { $lte: now } },
          { viewLock: { $exists: false } },
        ],
      },
      {
        $set: {
          viewLock: {
            userId: new mongoose.Types.ObjectId(uid),
            expiresAt,
            sessionId: sessionId || null,
            viewerName: viewerName || null,
          },
        },
      },
      { new: true }
    ).lean({ virtuals: true });

    if (!updated) {
      throw new GraphQLError("Bàn đang được khách khác xem trong 5 phút.", {
        extensions: { code: "TABLE_VIEW_LOCKED" },
      });
    }

    if (ctx?.io) {
      ctx.io.to(`restaurant_${updated.restaurantId}`).emit("tableViewEvents", {
        type: "TABLE_VIEW_LOCKED",
        tableId: String(updated._id),
        userId: String(uid),
        expiresAt: expiresAt.toISOString(),
      });
    }

    return updated;
  },

  releaseTableViewLock: async (_p, { input }, ctx) => {
    const { tableId, userId } = input || {};
    if (!mongoose.isValidObjectId(tableId)) throw new GraphQLError("Invalid tableId");
    const uid = userId || ctx?.user?.id;
    if (!mongoose.isValidObjectId(uid)) throw new GraphQLError("Invalid userId");

    const existing = await Table.findById(tableId).select({ restaurantId: 1 }).lean();
    if (!existing) return null;
    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.TABLE_WRITE);
    const updated = await Table.findOneAndUpdate(
      { _id: tableId, "viewLock.userId": new mongoose.Types.ObjectId(uid) },
      { $unset: { viewLock: 1 } },
      { new: true }
    ).lean({ virtuals: true });

    const table = updated || (await Table.findById(tableId).lean({ virtuals: true }));

    if (ctx?.io && table?.restaurantId) {
      ctx.io.to(`restaurant_${table.restaurantId}`).emit("tableViewEvents", {
        type: "TABLE_VIEW_RELEASED",
        tableId: String(tableId),
        userId: String(uid),
      });
    }

    return table;
  },
};
