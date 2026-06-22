import crypto from "crypto";
import { GraphQLError } from "graphql";

export const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PROCESSING_WAIT_MS = 3000;
export const PROCESSING_POLL_MS = 250;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeCheckoutIdempotencyKey(input = {}) {
  const value = String(
    input.idempotencyKey || input.clientMeta?.idempotencyKey || "",
  ).trim();

  if (!value) {
    throw new GraphQLError("idempotencyKey is required for checkout", {
      extensions: { code: "IDEMPOTENCY_KEY_REQUIRED" },
    });
  }

  if (value.length < 16 || value.length > 200) {
    throw new GraphQLError("idempotencyKey must be between 16 and 200 characters", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(value)) {
    throw new GraphQLError("idempotencyKey contains unsupported characters", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .filter((key) => key !== "idempotencyKey")
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
}

export function fingerprintCheckoutInput(input = {}) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

export function resolveCheckoutUserId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

export function assertClaimMatches(claim, { userId, requestFingerprint }) {
  if (!claim) return;

  if (String(claim.userId || "") !== String(userId || "")) {
    throw new GraphQLError("idempotencyKey belongs to another account", {
      extensions: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  }

  if (claim.requestFingerprint !== requestFingerprint) {
    throw new GraphQLError(
      "idempotencyKey was already used for another checkout payload",
      { extensions: { code: "IDEMPOTENCY_KEY_REUSED" } },
    );
  }
}
