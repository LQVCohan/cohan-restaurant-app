import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import process from "node:process";

import { GraphQLError } from "graphql";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { Order, Table } from "../../models/index.js";
import {
  ACTIVE_SESSION_STATUSES,
  ACTIVE_TABLE_SESSION_SORT,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  activeTableSessionLookupFilter,
} from "../../utils/orderLifecycle.js";
import {
  TABLE_ACCESS_TOKEN_ERROR,
  getPublicTableOrderCapability,
  normalizePublicTableCode,
  verifyTableAccessToken,
} from "../../utils/publicTableSession.js";
import { parseDurationMs } from "../utils/duration.js";

export const TABLE_ORDER_SESSION_REQUIRED_CODE = "TABLE_ORDER_SESSION_REQUIRED";
export const TABLE_ORDER_SESSION_REQUIRED_MESSAGE =
  "Vui lòng xác nhận thiết bị với nhân viên tại bàn trước khi tiếp tục.";

const ACCESS_REQUEST_PURPOSE = "customer_table_order_access_request";
const ORDER_SESSION_PURPOSE = "customer_table_order_session";
const ACCESS_REQUEST_TTL_DEFAULT = "5m";
const ORDER_SESSION_TTL_DEFAULT = "8h";
const MAX_PENDING_REQUESTS = 5;
const MAX_STORED_REQUESTS = 8;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{16,200}$/;

const toId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

function getSecret() {
  const secret = String(
    process.env.TABLE_ORDER_SESSION_TOKEN_SECRET ||
      process.env.TABLE_ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      "",
  ).trim();
  if (!secret) throw new Error(TABLE_ORDER_SESSION_REQUIRED_MESSAGE);
  return secret;
}

function getIssuer() {
  return process.env.JWT_ISSUER || "cohan-system";
}

function normalizeDeviceId(value) {
  const deviceId = String(value || "").trim();
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw new GraphQLError("Thiết bị gọi món không hợp lệ. Vui lòng quét lại mã QR.", {
      extensions: { code: "INVALID_TABLE_ORDER_DEVICE" },
    });
  }
  return deviceId;
}

export function hashPublicTableOrderDevice(value) {
  return createHash("sha256").update(normalizeDeviceId(value)).digest("hex");
}

function getRequestTtl() {
  return String(process.env.TABLE_ORDER_ACCESS_REQUEST_TTL || ACCESS_REQUEST_TTL_DEFAULT);
}

function getSessionTtl() {
  return String(process.env.TABLE_ORDER_SESSION_TTL || ORDER_SESSION_TTL_DEFAULT);
}

function signScopedToken(payload, expiresIn) {
  return jwt.sign(payload, getSecret(), {
    expiresIn,
    issuer: getIssuer(),
  });
}

function verifyScopedToken(token, purpose) {
  try {
    const payload = jwt.verify(String(token || "").trim(), getSecret(), {
      issuer: getIssuer(),
    });
    if (
      payload?.p !== purpose ||
      !payload?.rid ||
      !payload?.tid ||
      !payload?.sid ||
      !payload?.req ||
      !payload?.dh
    ) {
      throw new Error("invalid scope");
    }
    return {
      restaurantId: String(payload.rid),
      tableId: String(payload.tid),
      sessionId: String(payload.sid),
      requestId: String(payload.req),
      deviceHash: String(payload.dh),
      expiresAt: payload.exp
        ? new Date(Number(payload.exp) * 1000).toISOString()
        : null,
    };
  } catch {
    throw new GraphQLError(TABLE_ORDER_SESSION_REQUIRED_MESSAGE, {
      extensions: { code: TABLE_ORDER_SESSION_REQUIRED_CODE },
    });
  }
}

export function buildPublicTableOrderRequestLabel(requestId) {
  return String(requestId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase();
}

export function buildPublicTableOrderConfirmationCode({
  sessionId,
  requestId,
  deviceHash,
}) {
  const digest = createHmac("sha256", getSecret())
    .update(`${String(sessionId)}:${String(requestId)}:${String(deviceHash)}`)
    .digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

function confirmationCodeMatches(expected, input) {
  const left = Buffer.from(String(expected || ""));
  const right = Buffer.from(String(input || "").trim());
  return left.length === right.length && timingSafeEqual(left, right);
}

function signAccessRequestToken({
  restaurantId,
  tableId,
  sessionId,
  requestId,
  deviceHash,
}) {
  return signScopedToken(
    {
      p: ACCESS_REQUEST_PURPOSE,
      rid: String(restaurantId),
      tid: String(tableId),
      sid: String(sessionId),
      req: String(requestId),
      dh: String(deviceHash),
    },
    getRequestTtl(),
  );
}

function signOrderSessionToken({
  restaurantId,
  tableId,
  sessionId,
  requestId,
  deviceHash,
}) {
  return signScopedToken(
    {
      p: ORDER_SESSION_PURPOSE,
      rid: String(restaurantId),
      tid: String(tableId),
      sid: String(sessionId),
      req: String(requestId),
      dh: String(deviceHash),
    },
    getSessionTtl(),
  );
}

function getHeaders(ctx) {
  return ctx?.req?.headers || ctx?.request?.headers || {};
}

function readHeader(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getPublicTableOrderCredentials(ctx) {
  const headers = getHeaders(ctx);
  return {
    orderSessionToken: String(
      readHeader(headers, "x-table-order-session") || "",
    ).trim(),
    deviceId: String(readHeader(headers, "x-table-order-device") || "").trim(),
  };
}

async function loadStaticTableAccess({ restaurantId, tableId, token }) {
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  const verified = verifyTableAccessToken(token);
  if (
    verified.restaurantId !== String(rid) ||
    verified.tableId !== String(tid)
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const table = await Table.findOne({ _id: tid, restaurantId: rid })
    .select({ _id: 1, code: 1, status: 1, tableAccessToken: 1 })
    .lean();
  if (!table) throw new Error("Table not found");
  if (
    !table.tableAccessToken ||
    table.tableAccessToken !== String(token || "").trim()
  ) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const tableCode = normalizePublicTableCode(table.code);
  if (verified.tableCode && verified.tableCode !== tableCode) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const session = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .lean({ virtuals: true });

  return { rid, tid, table, tableCode, session };
}

function getRequests(session) {
  return Array.isArray(session?.clientMeta?.qrOrderAccessRequests)
    ? session.clientMeta.qrOrderAccessRequests
    : [];
}

function assertSessionCanStartAccess({ table, session }) {
  if (!session?._id) {
    throw new GraphQLError(
      "Nhân viên cần mở phiên phục vụ cho bàn trước khi khách xác nhận gọi món.",
      { extensions: { code: "TABLE_SESSION_NOT_OPEN" } },
    );
  }
  const capability = getPublicTableOrderCapability({
    tableStatus: table?.status,
    session,
  });
  if (!capability.canOrder) {
    throw new GraphQLError(
      capability.reason || "Bàn hiện chưa sẵn sàng nhận món.",
      { extensions: { code: "TABLE_NOT_ACCEPTING_ORDERS" } },
    );
  }
}

export async function requestPublicTableOrderAccess(input = {}) {
  const access = await loadStaticTableAccess(input);
  assertSessionCanStartAccess(access);

  const deviceHash = hashPublicTableOrderDevice(input.deviceId);
  const now = new Date();
  const existing = getRequests(access.session).find(
    (request) =>
      request?.deviceHash === deviceHash &&
      request?.status === "pending" &&
      new Date(request?.expiresAt || 0).getTime() > now.getTime(),
  );

  if (existing) {
    const requestToken = signAccessRequestToken({
      restaurantId: access.rid,
      tableId: access.tid,
      sessionId: access.session._id,
      requestId: existing.requestId,
      deviceHash,
    });
    const verified = verifyScopedToken(requestToken, ACCESS_REQUEST_PURPOSE);
    return {
      ok: true,
      message: "Yêu cầu xác nhận đang chờ nhân viên tại bàn.",
      requestToken,
      requestId: existing.requestId,
      requestLabel:
        existing.requestLabel ||
        buildPublicTableOrderRequestLabel(existing.requestId),
      expiresAt: verified.expiresAt,
      restaurantId: String(access.rid),
      tableId: String(access.tid),
      tableCode: access.tableCode,
    };
  }

  const activePendingCount = getRequests(access.session).filter(
    (request) =>
      request?.status === "pending" &&
      new Date(request?.expiresAt || 0).getTime() > now.getTime(),
  ).length;
  if (activePendingCount >= MAX_PENDING_REQUESTS) {
    throw new GraphQLError(
      "Bàn đang có nhiều yêu cầu xác nhận. Vui lòng nhờ nhân viên hỗ trợ trực tiếp.",
      { extensions: { code: "TOO_MANY_TABLE_ACCESS_REQUESTS" } },
    );
  }

  const requestId = randomUUID();
  const requestLabel = buildPublicTableOrderRequestLabel(requestId);
  const expiresAt = new Date(
    now.getTime() +
      parseDurationMs(
        process.env.TABLE_ORDER_ACCESS_REQUEST_TTL,
        ACCESS_REQUEST_TTL_DEFAULT,
      ),
  );
  const request = {
    requestId,
    requestLabel,
    deviceHash,
    status: "pending",
    requestedAt: now,
    expiresAt,
    confirmedAt: null,
  };

  const updateResult = await Order.updateOne(
    {
      _id: access.session._id,
      restaurantId: access.rid,
      tableId: access.tid,
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    },
    {
      $push: {
        "clientMeta.qrOrderAccessRequests": {
          $each: [request],
          $slice: -MAX_STORED_REQUESTS,
        },
      },
    },
  );
  if (!updateResult.modifiedCount) {
    throw new GraphQLError("Phiên bàn vừa thay đổi. Vui lòng quét lại mã QR.", {
      extensions: { code: "TABLE_SESSION_CHANGED" },
    });
  }

  const requestToken = signAccessRequestToken({
    restaurantId: access.rid,
    tableId: access.tid,
    sessionId: access.session._id,
    requestId,
    deviceHash,
  });
  const verified = verifyScopedToken(requestToken, ACCESS_REQUEST_PURPOSE);

  return {
    ok: true,
    message: "Hãy đưa mã yêu cầu cho nhân viên tại bàn để nhận mã xác nhận.",
    requestToken,
    requestId,
    requestLabel,
    expiresAt: verified.expiresAt,
    restaurantId: String(access.rid),
    tableId: String(access.tid),
    tableCode: access.tableCode,
  };
}

export async function confirmPublicTableOrderAccess(input = {}) {
  const requestPayload = verifyScopedToken(
    input.requestToken,
    ACCESS_REQUEST_PURPOSE,
  );
  const deviceHash = hashPublicTableOrderDevice(input.deviceId);
  if (deviceHash !== requestPayload.deviceHash) {
    throw new GraphQLError(TABLE_ORDER_SESSION_REQUIRED_MESSAGE, {
      extensions: { code: TABLE_ORDER_SESSION_REQUIRED_CODE },
    });
  }

  const expectedCode = buildPublicTableOrderConfirmationCode({
    sessionId: requestPayload.sessionId,
    requestId: requestPayload.requestId,
    deviceHash,
  });
  if (!confirmationCodeMatches(expectedCode, input.confirmationCode)) {
    throw new GraphQLError("Mã xác nhận tại bàn không đúng.", {
      extensions: { code: "INVALID_TABLE_CONFIRMATION_CODE" },
    });
  }

  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    {
      _id: toId(requestPayload.sessionId),
      restaurantId: toId(requestPayload.restaurantId),
      tableId: toId(requestPayload.tableId),
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
      "clientMeta.qrOrderAccessRequests": {
        $elemMatch: {
          requestId: requestPayload.requestId,
          deviceHash,
          status: "pending",
          expiresAt: { $gt: now },
        },
      },
    },
    {
      $set: {
        "clientMeta.qrOrderAccessRequests.$.status": "confirmed",
        "clientMeta.qrOrderAccessRequests.$.confirmedAt": now,
        "clientMeta.qrOrderAccessActiveRequestId":
          requestPayload.requestId,
        "clientMeta.qrOrderAccessActiveDeviceHash": deviceHash,
      },
    },
    { new: true },
  ).lean({ virtuals: true });

  if (!updated) {
    throw new GraphQLError(
      "Yêu cầu xác nhận đã hết hạn hoặc phiên bàn vừa thay đổi. Vui lòng yêu cầu mã mới.",
      { extensions: { code: "TABLE_ACCESS_REQUEST_EXPIRED" } },
    );
  }

  const orderSessionToken = signOrderSessionToken({
    restaurantId: requestPayload.restaurantId,
    tableId: requestPayload.tableId,
    sessionId: requestPayload.sessionId,
    requestId: requestPayload.requestId,
    deviceHash,
  });
  const verified = verifyScopedToken(orderSessionToken, ORDER_SESSION_PURPOSE);

  return {
    ok: true,
    message: "Thiết bị đã được xác nhận cho phiên bàn này.",
    orderSessionToken,
    sessionId: requestPayload.sessionId,
    expiresAt: verified.expiresAt,
  };
}

export async function validatePublicTableOrderSessionAccess({
  ctx,
  restaurantId,
  tableId,
  requireOrderable = false,
}) {
  const { orderSessionToken, deviceId } = getPublicTableOrderCredentials(ctx);
  if (!orderSessionToken || !deviceId) {
    throw new GraphQLError(TABLE_ORDER_SESSION_REQUIRED_MESSAGE, {
      extensions: { code: TABLE_ORDER_SESSION_REQUIRED_CODE },
    });
  }

  const payload = verifyScopedToken(orderSessionToken, ORDER_SESSION_PURPOSE);
  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const deviceHash = hashPublicTableOrderDevice(deviceId);
  if (
    !rid ||
    !tid ||
    payload.restaurantId !== String(rid) ||
    payload.tableId !== String(tid) ||
    payload.deviceHash !== deviceHash
  ) {
    throw new GraphQLError(TABLE_ORDER_SESSION_REQUIRED_MESSAGE, {
      extensions: { code: TABLE_ORDER_SESSION_REQUIRED_CODE },
    });
  }

  const session = await Order.findOne({
    _id: toId(payload.sessionId),
    restaurantId: rid,
    tableId: tid,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    "clientMeta.qrOrderAccessActiveRequestId": payload.requestId,
    "clientMeta.qrOrderAccessActiveDeviceHash": deviceHash,
    "clientMeta.qrOrderAccessRequests": {
      $elemMatch: {
        requestId: payload.requestId,
        deviceHash,
        status: "confirmed",
      },
    },
  }).lean({ virtuals: true });

  if (!session) {
    throw new GraphQLError(TABLE_ORDER_SESSION_REQUIRED_MESSAGE, {
      extensions: { code: TABLE_ORDER_SESSION_REQUIRED_CODE },
    });
  }

  if (requireOrderable) {
    const table = await Table.findOne({ _id: tid, restaurantId: rid })
      .select({ status: 1 })
      .lean();
    const capability = getPublicTableOrderCapability({
      tableStatus: table?.status,
      session,
    });
    if (!capability.canOrder) {
      throw new GraphQLError(
        capability.reason || "Bàn hiện chưa sẵn sàng nhận món.",
        { extensions: { code: "TABLE_NOT_ACCEPTING_ORDERS" } },
      );
    }
  }

  return { payload, session, deviceId };
}

export async function hasValidPublicTableOrderSessionAccess(args) {
  try {
    await validatePublicTableOrderSessionAccess(args);
    return true;
  } catch {
    return false;
  }
}

export async function listPendingPublicTableOrderAccessRequests(
  restaurantId,
) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  const now = Date.now();
  const sessions = await Order.find({
    restaurantId: rid,
    orderKind: ORDER_KIND.TABLE_SESSION,
    sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    "clientMeta.qrOrderAccessRequests.status": "pending",
  })
    .select({
      _id: 1,
      tableId: 1,
      tableCode: 1,
      clientMeta: 1,
    })
    .sort({ openedAt: 1, createdAt: 1, _id: 1 })
    .lean();

  return sessions
    .flatMap((session) =>
      getRequests(session)
        .filter(
          (request) =>
            request?.status === "pending" &&
            new Date(request?.expiresAt || 0).getTime() > now,
        )
        .map((request) => ({
          requestId: request.requestId,
          requestLabel:
            request.requestLabel ||
            buildPublicTableOrderRequestLabel(request.requestId),
          tableId: String(session.tableId || ""),
          tableCode: normalizePublicTableCode(session.tableCode),
          requestedAt: request.requestedAt || null,
          expiresAt: request.expiresAt || null,
          confirmationCode: buildPublicTableOrderConfirmationCode({
            sessionId: session._id,
            requestId: request.requestId,
            deviceHash: request.deviceHash,
          }),
        })),
    )
    .sort(
      (left, right) =>
        new Date(left.requestedAt || 0).getTime() -
        new Date(right.requestedAt || 0).getTime(),
    );
}

export const __testables = {
  ACCESS_REQUEST_PURPOSE,
  ORDER_SESSION_PURPOSE,
  normalizeDeviceId,
  signAccessRequestToken,
  signOrderSessionToken,
  verifyScopedToken,
  confirmationCodeMatches,
};
