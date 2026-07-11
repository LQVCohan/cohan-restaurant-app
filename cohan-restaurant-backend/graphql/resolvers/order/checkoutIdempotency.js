import { GraphQLError } from "graphql";
import {
  fingerprintCheckoutInput,
  normalizeCheckoutIdempotencyKey,
  resolveCheckoutUserId,
} from "./checkoutIdempotency.utils.js";
import {
  claimCheckout,
  loadCheckoutResult,
  markCheckoutCompleted,
  markCheckoutFailed,
} from "./checkoutIdempotency.store.js";

export function withCheckoutIdempotency(mutations = {}) {
  const createCheckoutOrders = mutations.createCheckoutOrders;
  if (typeof createCheckoutOrders !== "function") return mutations;

  return {
    ...mutations,
    async createCheckoutOrders(parent, args, ctx, info) {
      const input = args?.input || {};
      const userId = resolveCheckoutUserId(ctx);

      if (!userId) {
        return createCheckoutOrders.call(this, parent, args, ctx, info);
      }

      const key = normalizeCheckoutIdempotencyKey(input);
      const requestFingerprint = fingerprintCheckoutInput(input);
      let claimResult;

      try {
        claimResult = await claimCheckout({
          key,
          userId,
          requestFingerprint,
        });
      } catch (error) {
        if (error?.extensions?.code === "CHECKOUT_IN_PROGRESS") {
          const recovered = await loadCheckoutResult({ key, claim: null, userId });
          if (recovered) {
            await markCheckoutCompleted({ key, result: recovered });
            return recovered;
          }
        }
        throw error;
      }

      if (!claimResult.owner) {
        const existing = await loadCheckoutResult({
          key,
          claim: claimResult.claim,
          userId,
        });
        if (existing) return existing;

        throw new GraphQLError("Checkout result is not available yet", {
          extensions: { code: "CHECKOUT_IN_PROGRESS", retryAfterMs: 1000 },
        });
      }

      try {
        const result = await createCheckoutOrders.call(
          this,
          parent,
          args,
          ctx,
          info,
        );
        await markCheckoutCompleted({ key, result });
        return result;
      } catch (error) {
        const recovered = await loadCheckoutResult({ key, claim: null, userId });
        if (recovered) {
          await markCheckoutCompleted({ key, result: recovered });
          return recovered;
        }

        await markCheckoutFailed({ key, error });
        throw error;
      }
    },
  };
}
