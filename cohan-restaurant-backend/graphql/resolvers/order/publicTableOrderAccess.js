import jwt from "jsonwebtoken";

import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  confirmPublicTableOrderAccess,
  hasValidPublicTableOrderSessionAccess,
  listPendingPublicTableOrderAccessRequests,
  requestPublicTableOrderAccess,
  validatePublicTableOrderSessionAccess,
} from "../../../src/services/publicTableOrderAccess.service.js";
import { ensurePublicTableSessionForAccess } from "../../../src/services/publicTableSessionBootstrap.service.js";
import {
  setTableOrderSessionCookies,
  withTableOrderSessionCookieCredentials,
} from "../shared/tableOrderSessionCookies.js";
import { emitRestaurantEvent } from "./helper/emitOrderEvent.js";
import publicTableOrderMutation from "./publicTableOrderMutation.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";

function buildRestrictedSession(session) {
  if (!session?.id) return null;
  return {
    id: session.id,
    orderCode: null,
    orderKind: session.orderKind || "table_session",
    currentStatus: session.currentStatus || null,
    sessionStatus: session.sessionStatus || null,
    orderPaymentStatus: session.orderPaymentStatus || null,
    payment: session.payment || null,
  };
}

export const PublicTableOrderAccessQuery = {
  async publicActiveTableSessionOrders(parent, args, ctx, info) {
    const result = await publicTableSessionQuery.publicActiveTableSessionOrders(
      parent,
      args,
      ctx,
      info,
    );
    const operationalCanOrder = Boolean(result?.canOrder);
    const hasActiveSession = Boolean(result?.session?.id);
    const credentialContext = withTableOrderSessionCookieCredentials(
      ctx,
      args.tableId,
    );
    const orderAccessConfirmed = hasActiveSession
      ? await hasValidPublicTableOrderSessionAccess({
          ctx: credentialContext,
          restaurantId: args.restaurantId,
          tableId: args.tableId,
        })
      : false;

    const canRequestOrderAccess =
      operationalCanOrder && !orderAccessConfirmed;
    const orderAccessBlockedReason = !operationalCanOrder
      ? result?.orderBlockedReason || "Bàn hiện chưa sẵn sàng nhận món."
      : !orderAccessConfirmed
        ? "Cần xác nhận thiết bị với nhân viên tại bàn trước khi xem và gọi món."
        : null;

    return {
      ...result,
      canRequestOrderAccess,
      orderAccessConfirmed,
      orderAccessBlockedReason,
      canOrder: operationalCanOrder && orderAccessConfirmed,
      orderBlockedReason: orderAccessBlockedReason,
      session: orderAccessConfirmed
        ? result.session
        : buildRestrictedSession(result.session),
      orders: orderAccessConfirmed ? result.orders : [],
      customerRequests: orderAccessConfirmed ? result.customerRequests : [],
    };
  },

  async tableQrOrderAccessRequests(_parent, { restaurantId }, ctx) {
    await requireRestaurantPermission(
      ctx,
      restaurantId,
      PERMISSIONS.ORDER_READ,
    );
    return listPendingPublicTableOrderAccessRequests(restaurantId);
  },
};

export const PublicTableOrderAccessMutation = {
  async publicRequestTableOrderAccess(_parent, { input }, ctx) {
    await ensurePublicTableSessionForAccess(input || {});
    const result = await requestPublicTableOrderAccess(input || {});
    try {
      await emitRestaurantEvent(
        ctx,
        result.restaurantId,
        "TABLE_QR_ORDER_ACCESS_REQUESTED",
        {
          restaurantId: result.restaurantId,
          tableId: result.tableId,
          tableCode: result.tableCode,
          requestId: result.requestId,
          requestLabel: result.requestLabel,
          expiresAt: result.expiresAt,
        },
      );
    } catch (error) {
      console.warn(
        "[QR_ORDER_ACCESS] Failed to emit access request",
        error?.message || error,
      );
    }
    return result;
  },

  async publicConfirmTableOrderAccess(_parent, { input }, ctx) {
    const result = await confirmPublicTableOrderAccess(input || {});
    const requestScope = jwt.decode(String(input?.requestToken || "")) || {};
    const restaurantId = String(requestScope.rid || "");
    const tableId = String(requestScope.tid || "");

    setTableOrderSessionCookies(ctx, {
      tableId,
      orderSessionToken: result.orderSessionToken,
      deviceId: input?.deviceId,
      expiresAt: result.expiresAt,
    });

    try {
      await emitRestaurantEvent(
        ctx,
        restaurantId,
        "TABLE_QR_ORDER_ACCESS_CONFIRMED",
        {
          restaurantId,
          tableId,
          sessionId: result.sessionId,
        },
      );
    } catch {
      // The access cookie is already issued; realtime refresh is secondary.
    }
    return result;
  },

  async publicRequestTableIdentityOtp(parent, args, ctx, info) {
    const credentialContext = withTableOrderSessionCookieCredentials(
      ctx,
      args?.input?.tableId,
    );
    await validatePublicTableOrderSessionAccess({
      ctx: credentialContext,
      restaurantId: args?.input?.restaurantId,
      tableId: args?.input?.tableId,
      requireOrderable: true,
    });
    return publicTableOrderMutation.publicRequestTableIdentityOtp(
      parent,
      args,
      ctx,
      info,
    );
  },

  async publicSubmitTableOrder(parent, args, ctx, info) {
    const credentialContext = withTableOrderSessionCookieCredentials(
      ctx,
      args?.input?.tableId,
    );
    await validatePublicTableOrderSessionAccess({
      ctx: credentialContext,
      restaurantId: args?.input?.restaurantId,
      tableId: args?.input?.tableId,
      requireOrderable: true,
    });
    return publicTableOrderMutation.publicSubmitTableOrder(
      parent,
      args,
      ctx,
      info,
    );
  },
};

export default {
  Query: PublicTableOrderAccessQuery,
  Mutation: PublicTableOrderAccessMutation,
};
