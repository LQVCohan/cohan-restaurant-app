import mongoose from "mongoose";
import QRCode from "qrcode";
import { GraphQLError } from "graphql";

import Table from "../../../models/table.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import {
  normalizePublicTableCode,
  signTableAccessToken,
  verifyTableAccessToken,
} from "../../../utils/publicTableSession.js";

const QR_WIDTH = 512;
const QR_TABLE_SELECT = {
  _id: 1,
  restaurantId: 1,
  floorId: 1,
  floorLevel: 1,
  code: 1,
  status: 1,
  capacity: 1,
  tableAccessUrl: 1,
  tableQrCodeDataUrl: 1,
  tableQrGeneratedAt: 1,
  tableQrExpiresAt: 1,
};
const getQrTokenExpiresIn = () => process.env.TABLE_QR_ACCESS_TOKEN_EXPIRES_IN || "365d";

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new GraphQLError("baseUrl không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT", field: "baseUrl" },
    });
  }
}

function buildTableAccessUrl({ baseUrl, restaurantId, tableId, token }) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/table/${restaurantId}/${tableId}`);
  url.searchParams.set("token", token);
  return url.toString();
}

async function loadTableForQr(tableId, ctx) {
  if (!mongoose.isValidObjectId(tableId)) {
    throw new GraphQLError("tableId không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT", field: "tableId" },
    });
  }

  const table = await Table.findById(tableId)
    .select({ _id: 1, restaurantId: 1, floorId: 1, code: 1 })
    .lean();

  if (!table) throw new GraphQLError("Không tìm thấy bàn.");
  await requireRestaurantPermission(ctx, table.restaurantId, PERMISSIONS.TABLE_WRITE);
  return table;
}

export const TableAccessQrQuery = {
  tableQrAccessList: async (_parent, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_READ);
    return Table.find({ restaurantId })
      .select(QR_TABLE_SELECT)
      .sort({ floorLevel: 1, code: 1 })
      .lean({ virtuals: true });
  },
};

export const TableAccessQrMutation = {
  generateTableAccessQr: async (_parent, { input }, ctx) => {
    const table = await loadTableForQr(input?.tableId, ctx);
    const token = signTableAccessToken({
      restaurantId: table.restaurantId,
      tableId: table._id,
      tableCode: normalizePublicTableCode(table.code),
      expiresIn: getQrTokenExpiresIn(),
    });
    const verifiedToken = verifyTableAccessToken(token);
    const tableAccessUrl = buildTableAccessUrl({
      baseUrl: input.baseUrl,
      restaurantId: table.restaurantId,
      tableId: table._id,
      token,
    });
    const tableQrCodeDataUrl = await QRCode.toDataURL(tableAccessUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: QR_WIDTH,
    });
    const now = new Date();

    const updated = await Table.findByIdAndUpdate(
      table._id,
      {
        $set: {
          tableAccessToken: token,
          tableAccessUrl,
          tableQrCodeDataUrl,
          tableQrGeneratedAt: now,
          tableQrExpiresAt: verifiedToken.expiresAt ? new Date(verifiedToken.expiresAt) : null,
        },
      },
      { new: true, runValidators: true },
    ).lean({ virtuals: true });

    await logEvent({
      restaurantId: table.restaurantId,
      floorId: table.floorId,
      tableId: table._id,
      actorUserId: ctx?.user?.id,
      verb: "table.qr_generate",
      object: { kind: "Table", id: table._id, code: table.code },
      meta: { expiresAt: verifiedToken.expiresAt || null },
      ip: ctx?.req?.ip,
      userAgent: ctx?.req?.headers?.["user-agent"],
    });

    return updated;
  },

  revokeTableAccessQr: async (_parent, { tableId }, ctx) => {
    const table = await loadTableForQr(tableId, ctx);
    const updated = await Table.findByIdAndUpdate(
      table._id,
      {
        $unset: {
          tableAccessToken: "",
          tableAccessUrl: "",
          tableQrCodeDataUrl: "",
          tableQrGeneratedAt: "",
          tableQrExpiresAt: "",
        },
      },
      { new: true, runValidators: true },
    ).lean({ virtuals: true });

    await logEvent({
      restaurantId: table.restaurantId,
      floorId: table.floorId,
      tableId: table._id,
      actorUserId: ctx?.user?.id,
      verb: "table.qr_revoke",
      object: { kind: "Table", id: table._id, code: table.code },
      ip: ctx?.req?.ip,
      userAgent: ctx?.req?.headers?.["user-agent"],
    });

    return updated;
  },
};

export default TableAccessQrMutation;
