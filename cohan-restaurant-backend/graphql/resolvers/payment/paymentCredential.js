import mongoose from "mongoose";
import { EventLog } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  disconnectRestaurantPaymentCredential,
  listRestaurantPaymentCredentialStatuses,
  normalizePaymentMode,
  normalizePaymentProvider,
  saveRestaurantPaymentCredential,
} from "../../../src/services/payment/paymentCredential.service.js";
import { listPaymentIntegrationReadiness } from "../../../src/services/payment/paymentIntegrationConfig.service.js";
import { getProviderPublicConfig } from "../../../src/services/payment/paymentSession.service.js";

const requireRestaurantId = (value) => {
  if (!mongoose.isValidObjectId(value)) throw new Error("Invalid restaurantId");
  return value;
};

const findStatus = (items, provider, mode) =>
  items.find((item) => item.provider === provider && item.mode === mode);

export const PaymentCredentialQuery = {
  async restaurantPaymentCredentialStatuses(_, { restaurantId }, ctx) {
    const rid = requireRestaurantId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
    return listRestaurantPaymentCredentialStatuses(rid);
  },

  async restaurantPaymentIntegrationReadiness(_, { restaurantId }, ctx) {
    const rid = requireRestaurantId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
    return listPaymentIntegrationReadiness();
  },

  async restaurantPaymentPublicConfig(_, { restaurantId }) {
    const rid = requireRestaurantId(restaurantId);
    const [config, statuses, readinessItems] = await Promise.all([
      getProviderPublicConfig(rid),
      listRestaurantPaymentCredentialStatuses(rid),
      Promise.resolve(listPaymentIntegrationReadiness()),
    ]);
    return {
      ...config,
      providers: config.providers.map((providerConfig) => {
        const status = findStatus(
          statuses,
          providerConfig.provider,
          providerConfig.mode,
        );
        const readiness = findStatus(
          readinessItems,
          providerConfig.provider,
          providerConfig.mode,
        );
        return {
          ...providerConfig,
          active:
            providerConfig.active &&
            Boolean(status?.configured) &&
            Boolean(readiness?.ready),
          configured: Boolean(status?.configured),
          credentialSource: status?.source || "none",
        };
      }),
    };
  },
};

export const PaymentCredentialMutation = {
  async saveRestaurantPaymentCredential(_, { input }, ctx) {
    const rid = requireRestaurantId(input?.restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);
    const provider = normalizePaymentProvider(input?.provider);
    const mode = normalizePaymentMode(input?.mode);
    const actorId = ctx?.user?.id || ctx?.user?._id || null;

    const document = await saveRestaurantPaymentCredential({
      restaurantId: rid,
      provider,
      mode,
      credentials: input?.credentialPayload || {},
      actorId,
    });
    await EventLog.log({
      restaurantId: rid,
      actorUserId: actorId,
      verb: "payment.settings.update",
      object: { kind: "PaymentProviderCredential", id: document._id },
      source: "web",
      status: "success",
      meta: { provider, mode, action: "credential_saved", version: document.version },
    }).catch(() => {});

    const statuses = await listRestaurantPaymentCredentialStatuses(rid);
    return findStatus(statuses, provider, mode);
  },

  async disconnectRestaurantPaymentCredential(_, { restaurantId, provider: providerValue, mode: modeValue }, ctx) {
    const rid = requireRestaurantId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);
    const provider = normalizePaymentProvider(providerValue);
    const mode = normalizePaymentMode(modeValue);
    const actorId = ctx?.user?.id || ctx?.user?._id || null;

    await disconnectRestaurantPaymentCredential({
      restaurantId: rid,
      provider,
      mode,
      actorId,
    });
    await EventLog.log({
      restaurantId: rid,
      actorUserId: actorId,
      verb: "payment.settings.update",
      object: { kind: "Restaurant", id: rid },
      source: "web",
      status: "success",
      meta: { provider, mode, action: "credential_disconnected" },
    }).catch(() => {});

    const statuses = await listRestaurantPaymentCredentialStatuses(rid);
    return findStatus(statuses, provider, mode);
  },
};
