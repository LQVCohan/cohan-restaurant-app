import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fingerprintPaymentRequest,
  normalizePaymentIdempotencyKey,
} from "../../src/services/payment/paymentRequestIdempotency.service.js";

const repoRoot =
  basename(process.cwd()) === "cohan-restaurant-backend"
    ? join(process.cwd(), "..")
    : process.cwd();
const backendRoot = join(repoRoot, "cohan-restaurant-backend");
const readBackendSource = (relativePath) =>
  readFileSync(join(backendRoot, relativePath), "utf8");

const idempotencyServiceSource = readBackendSource(
  "src/services/payment/paymentRequestIdempotency.service.js",
);
const wrapperSource = readBackendSource(
  "graphql/resolvers/payment/paymentIdempotencyMutation.js",
);
const walletWrapperSource = readBackendSource(
  "graphql/resolvers/payment/walletMoneyIdempotencyMutation.js",
);
const resolverIndexSource = readBackendSource(
  "graphql/resolvers/payment/index.js",
);
const schemaSource = readBackendSource(
  "graphql/schema/paymentIdempotency.graphql",
);
const modelSource = readBackendSource(
  "models/payment-request-lock.model.js",
);
const apolloSource = readFileSync(join(repoRoot, "src/apollo/client.js"), "utf8");
const reservationModalSource = readFileSync(
  join(repoRoot, "src/components/Customer/QRPaymentModal/QRPaymentModal.jsx"),
  "utf8",
);

describe("unified payment idempotency", () => {
  it("creates a deterministic SHA-256 fingerprint for the canonical request", () => {
    const first = fingerprintPaymentRequest({
      operation: "CreateWalletTopup",
      userId: "64b000000000000000000001",
      input: { provider: "momo", amount: 100000, metadata: { source: "wallet" } },
    });
    const reordered = fingerprintPaymentRequest({
      operation: "CreateWalletTopup",
      userId: "64b000000000000000000001",
      input: { metadata: { source: "wallet" }, amount: 100000, provider: "momo" },
    });
    const differentAmount = fingerprintPaymentRequest({
      operation: "CreateWalletTopup",
      userId: "64b000000000000000000001",
      input: { provider: "momo", amount: 200000, metadata: { source: "wallet" } },
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(reordered);
    expect(first).not.toBe(differentAmount);
  });

  it("rejects missing, short and unsupported request keys", () => {
    expect(() => normalizePaymentIdempotencyKey("")).toThrow(/between 16 and 200/);
    expect(() => normalizePaymentIdempotencyKey("short-key")).toThrow(/between 16 and 200/);
    expect(() => normalizePaymentIdempotencyKey("payment key with spaces 123")).toThrow(
      /unsupported characters/,
    );
    expect(
      normalizePaymentIdempotencyKey("CreateWalletTopup:v1:1234567890abcdef"),
    ).toBe("CreateWalletTopup:v1:1234567890abcdef");
  });

  it("uses one durable claim contract at the final payment resolver boundary", () => {
    expect(modelSource).toContain("unique: true");
    expect(modelSource).toContain('enum: ["PROCESSING", "COMPLETED", "FAILED"]');
    expect(modelSource).toContain("expireAfterSeconds: 0");
    expect(resolverIndexSource).toContain("withPaymentIdempotency(paymentMutation)");
    expect(resolverIndexSource).toContain("withWalletMoneyIdempotency(");
    for (const operation of [
      "CreateReservationPayment",
      "CreateOrderPayment",
      "CreateWalletTopup",
      "PayOrdersByTableId",
      "PayOrdersByOrderIds",
    ]) {
      expect(wrapperSource).toContain(`"${operation}"`);
    }
    for (const operation of ["RefundToWallet", "AdjustWalletBalance"]) {
      expect(walletWrapperSource).toContain(`"${operation}"`);
    }
    expect(wrapperSource).toContain("recoverPaymentSession");
    expect(wrapperSource).toContain("recoverWalletTopup");
    expect(wrapperSource).toContain("recoverPosPayment");
    expect(walletWrapperSource).toContain("findRefundResult");
    expect(walletWrapperSource).toContain("findAdjustmentResult");
  });

  it("never reclaims an ambiguous processing money command", () => {
    const processingStart = idempotencyServiceSource.indexOf(
      '  if (claim.status === "PROCESSING") {',
    );
    const failedStart = idempotencyServiceSource.indexOf(
      '  if (claim.status === "FAILED") {',
      processingStart,
    );
    const processingBranch = idempotencyServiceSource.slice(
      processingStart,
      failedStart,
    );

    expect(processingStart).toBeGreaterThanOrEqual(0);
    expect(failedStart).toBeGreaterThan(processingStart);
    expect(processingBranch).toContain('claim.status === "PROCESSING"');
    expect(processingBranch).toContain('"PAYMENT_IN_PROGRESS"');
    expect(processingBranch).not.toContain("findOneAndUpdate(");
  });

  it("requires a key on every active money-command input", () => {
    for (const inputName of [
      "PayOrdersByTableIdInput",
      "PayOrdersByOrderIdsInput",
      "CreateOrderPaymentInput",
      "CreateReservationPaymentInput",
      "WalletTopupInput",
      "RefundToWalletInput",
      "AdjustWalletBalanceInput",
    ]) {
      expect(schemaSource).toMatch(
        new RegExp(`extend input ${inputName} \\{[\\s\\S]*idempotencyKey: String!`),
      );
    }
  });

  it("generates and retains secure keys for all payment mutation names", () => {
    for (const operation of [
      "CreateCheckoutOrders",
      "CreateWalletTopup",
      "CreateOrderPayment",
      "CreateReservationPayment",
      "PayOrdersByTableId",
      "PayOrdersByOrderIds",
      "PayOrdersWithWallet",
      "RefundToWallet",
      "AdjustWalletBalance",
    ]) {
      expect(apolloSource).toContain(`${operation}:`);
    }
    expect(apolloSource).toContain("cryptoApi.randomUUID");
    expect(apolloSource).toContain("cryptoApi.getRandomValues");
    expect(apolloSource).toContain("getStablePaymentIdempotencyKey");
    expect(apolloSource).toContain("removeStoredIdempotencyKey");
    expect(apolloSource).not.toContain("Math.random()");
  });

  it("routes reservation deposit creation through the GraphQL boundary", () => {
    expect(reservationModalSource).toContain("mutation CreateReservationPayment");
    expect(reservationModalSource).toContain("createReservationPayment({");
    expect(reservationModalSource).not.toContain("/api/payments/reservations/");
    expect(reservationModalSource).not.toContain("readStorageValue");
  });
});