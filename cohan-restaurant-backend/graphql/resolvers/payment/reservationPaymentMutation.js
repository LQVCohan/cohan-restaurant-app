import {
  createReservationPayment,
  sanitizePaymentSessionForClient,
} from "../../../src/services/payment/paymentSession.service.js";
import {
  getPaymentBaseApiUrl,
  getPaymentClientIp,
} from "../../../src/services/payment/paymentRequestContext.js";

export async function createReservationProviderPayment(_parent, { input }, ctx) {
  const userId = ctx?.user?.id || ctx?.user?._id;
  if (!userId) throw new Error("Unauthorized");

  const payment = await createReservationPayment({
    reservationId: input?.reservationId,
    provider: input?.provider,
    userId: String(userId),
    baseApiUrl: getPaymentBaseApiUrl(ctx),
    clientIp: getPaymentClientIp(ctx),
  });

  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
}

export default {
  createReservationPayment: createReservationProviderPayment,
};
