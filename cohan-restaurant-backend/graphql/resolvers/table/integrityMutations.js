import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { sanitizeVisualConfig } from "./mutation.js";

const TABLE_QR_CLEAR_PATCH = {
  tableAccessToken: null,
  tableAccessUrl: null,
  tableQrCodeDataUrl: null,
  tableQrGeneratedAt: null,
  tableQrExpiresAt: null,
};

const normalizeTableCode = (value = "") =>
  String(value).trim().replace(/\s+/g, " ").toLowerCase();

const humanizeTableCode = (value = "") =>
  String(value).trim().replace(/\s+/g, " ");

const businessError = (message, code, field) =>
  new GraphQLError(message, {
    extensions: { code, ...(field ? { field } : {}) },
  });

const duplicateTableError = (code) =>
  businessError(
    `Bàn '${code}' đã tồn tại trong tầng này. Vui lòng dùng tên khác.`,
    "TABLE_CODE_DUPLICATE",
    "code",
  );

const assertModifiedOnce = (result) => {
  if (Number(result?.modifiedCount) !== 1) {
    throw businessError(
      "Thông tin bàn vừa thay đổi. Vui lòng tải lại rồi thử lại.",
      "TABLE_SWAP_WRITE_CONFLICT",
    );
  }
};

const createTable = async (_parent, { input }, ctx) => {
  const { restaurantId, floorId } = input || {};
  if (
    !mongoose.isValidObjectId(restaurantId) ||
    !mongoose.isValidObjectId(floorId)
  ) {
    throw businessError(
      "Invalid restaurantId or floorId",
      "BAD_USER_INPUT",
    );
  }

  await requireRestaurantPermission(
    ctx,
    restaurantId,
    PERMISSIONS.TABLE_WRITE,
  );

  const floor = await Floor.findOne({ _id: floorId, restaurantId })
    .select({ level: 1 })
    .lean();
  if (!floor) {
    throw businessError(
      "Tầng không tồn tại hoặc không thuộc nhà hàng này.",
      "TABLE_FLOOR_SCOPE_MISMATCH",
      "floorId",
    );
  }

  const code = humanizeTableCode(input.code);
  if (!code) {
    throw businessError("Table code is required", "BAD_USER_INPUT", "code");
  }

  const normalizedCode = normalizeTableCode(code);
  const existingCodes = await Table.find({ restaurantId, floorId })
    .select({ code: 1 })
    .lean();
  if (
    existingCodes.some(
      (table) => normalizeTableCode(table.code) === normalizedCode,
    )
  ) {
    throw duplicateTableError(code);
  }

  try {
    const created = await Table.create({
      ...input,
      code,
      floorLevel: floor.level ?? 1,
      visualConfig: sanitizeVisualConfig(input.visualConfig),
    });
    return created.toObject({ virtuals: true });
  } catch (error) {
    if (error?.code === 11000) throw duplicateTableError(code);
    throw error;
  }
};

const swapTableCodes = async (_parent, { input }, ctx) => {
  const { restaurantId, floorId, aId, bId } = input || {};
  if (![restaurantId, floorId, aId, bId].every(mongoose.isValidObjectId)) {
    throw businessError("Invalid ids", "BAD_USER_INPUT");
  }
  if (String(aId) === String(bId)) {
    throw businessError(
      "Không thể đổi mã một bàn với chính nó.",
      "TABLE_SWAP_SAME_TABLE",
    );
  }

  await requireRestaurantPermission(
    ctx,
    restaurantId,
    PERMISSIONS.TABLE_WRITE,
  );

  const session = await mongoose.startSession();
  let beforeA;
  let beforeB;

  try {
    await session.withTransaction(async () => {
      const tables = await Table.find({
        _id: { $in: [aId, bId] },
        restaurantId,
        floorId,
      })
        .session(session)
        .select({ _id: 1, code: 1 })
        .lean();

      const tableById = new Map(
        tables.map((table) => [String(table._id || table.id), table]),
      );
      beforeA = tableById.get(String(aId));
      beforeB = tableById.get(String(bId));
      if (!beforeA || !beforeB) {
        throw businessError(
          "Không tìm thấy đủ hai bàn trong cùng tầng.",
          "TABLE_SWAP_TABLE_NOT_FOUND",
        );
      }

      const temporaryCode = `__SWAP__${new mongoose.Types.ObjectId()}`;
      assertModifiedOnce(
        await Table.updateOne(
          {
            _id: aId,
            restaurantId,
            floorId,
            code: beforeA.code,
          },
          { $set: { code: temporaryCode } },
          { session },
        ),
      );
      assertModifiedOnce(
        await Table.updateOne(
          {
            _id: bId,
            restaurantId,
            floorId,
            code: beforeB.code,
          },
          { $set: { code: beforeA.code, ...TABLE_QR_CLEAR_PATCH } },
          { session },
        ),
      );
      assertModifiedOnce(
        await Table.updateOne(
          {
            _id: aId,
            restaurantId,
            floorId,
            code: temporaryCode,
          },
          { $set: { code: beforeB.code, ...TABLE_QR_CLEAR_PATCH } },
          { session },
        ),
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw businessError(
        "Mã bàn vừa thay đổi. Vui lòng tải lại rồi thử đổi vị trí lần nữa.",
        "TABLE_CODE_DUPLICATE",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await logEvent({
    restaurantId,
    floorId,
    verb: "table.swap_codes",
    object: { kind: "Table", id: aId, code: beforeA.code },
    target: { kind: "Table", id: bId, code: beforeB.code },
    meta: {
      beforeA: beforeA.code,
      beforeB: beforeB.code,
      afterA: beforeB.code,
      afterB: beforeA.code,
    },
    actorUserId: ctx.user?.id,
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return true;
};

export default { createTable, swapTableCodes };
