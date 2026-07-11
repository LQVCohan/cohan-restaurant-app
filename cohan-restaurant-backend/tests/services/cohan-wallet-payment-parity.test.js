import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import PaymentSession from "../../models/payment-session.model.js";
import { fingerprintWalletPaymentRequest } from "../../src/services/wallet/idempotentWalletPayment.service.js";

const repoRoot =
  basename(process.cwd()) === "cohan-restaurant-backend"
    ? join(process.cwd(), "..")
    : process.cwd();
const backendRoot = join(repoRoot, "cohan-restaurant-backend");
const readBackendSource = (relativePath) =>
  readFileSync(join(backendRoot, relativePath), "utf8");

const walletServiceSource = readBackendSource(
  "src/services/wallet/wallet.service.js",
);
const walletIdempotencySource = readBackendSource(
  "src/services/wallet/idempotentWalletPayment.service.js",
);
const walletResolverSource = readBackendSource("graphql/resolvers/wallet/index.js");
const walletSchemaSource = readBackendSource("graphql/schema/wallet.graphql");
const deferredCheckoutSource = readBackendSource(
  "graphql/resolvers/order/deferredOnlineCheckout.js",
);
const apolloClientSource = readFileSync(
  join(repoRoot, "src/apollo/client.js"),
  "utf8",
);
const managerWalletSource = readFileSync(
  join(
    repoRoot,
    "src/components/Dashboard_Manager/Wallet/ManagerWalletPage.jsx",
  ),
  "utf8",
);

describe("Cohan wallet payment parity", () => {
  it("supports an internal payment session without external credentials", () => {
    expect(PaymentSession.schema.path("provider").enumValues).toContain(
      "cohan_wallet",
    );
    expect(walletServiceSource).toContain("provider: WALLET_PROVIDER");
    expect(walletServiceSource).toContain('paymentMethod: "e_wallet"');
    expect(walletServiceSource).toContain('callbackStatus: "verified"');
  });

  it("settles wallet payments through the same invoice and ledger boundary", () => {
    const payFlow = walletServiceSource.slice(
      walletServiceSource.indexOf("export async function payOrdersWithWallet"),
      walletServiceSource.indexOf("async function findRefundPaymentTransaction"),
    );

    expect(payFlow).toContain("settlePaidOrderPaymentSession({");
    expect(payFlow).toContain("settlement.paymentTransactionId");
    expect(payFlow).toContain("settlement.invoiceId");
    expect(payFlow).toContain('type: "PAYMENT"');
    expect(payFlow).toContain('referenceType: "ORDER_PAYMENT"');
    expect(payFlow).toContain('"payment.provider": WALLET_PROVIDER');
    expect(payFlow).toContain('"payment.paidAmount": roundMoney(');
    expect(payFlow).not.toContain("PaymentTransaction.create(");
    expect(payFlow).not.toContain("Cashflow.create(");
  });

  it("keeps wallet checkout deferred until the debit succeeds", () => {
    expect(deferredCheckoutSource).toContain(
      'const ONLINE_CHECKOUT_METHODS = new Set(["card", "wallet"]);',
    );
    expect(deferredCheckoutSource).toContain("await payOrdersWithWallet({");
    expect(
      deferredCheckoutSource.indexOf("await payOrdersWithWallet({"),
    ).toBeLessThan(deferredCheckoutSource.indexOf('"payment.status": "paid"'));
    expect(deferredCheckoutSource).toContain("await emitPaymentRealtime({");
    expect(deferredCheckoutSource).toContain(
      "idempotentWalletPayment.service.js",
    );
  });

  it("binds a wallet key to the canonical user, restaurant and order payload", () => {
    const first = fingerprintWalletPaymentRequest({
      userId: "64b000000000000000000001",
      restaurantId: "64b000000000000000000002",
      orderIds: [
        "64b000000000000000000004",
        "64b000000000000000000003",
      ],
    });
    const reordered = fingerprintWalletPaymentRequest({
      userId: "64b000000000000000000001",
      restaurantId: "64b000000000000000000002",
      orderIds: [
        "64b000000000000000000003",
        "64b000000000000000000004",
      ],
    });
    const differentOrder = fingerprintWalletPaymentRequest({
      userId: "64b000000000000000000001",
      restaurantId: "64b000000000000000000002",
      orderIds: ["64b000000000000000000005"],
    });

    expect(first).toBe(reordered);
    expect(first).not.toBe(differentOrder);
    expect(walletIdempotencySource).toContain('"IDEMPOTENCY_KEY_REUSED"');
    expect(walletIdempotencySource).toContain("requestFingerprint");
    expect(walletIdempotencySource).toContain("correlationId");
    expect(walletIdempotencySource).toContain("settledTransaction");
    expect(walletIdempotencySource).toContain(
      "if (error?.code !== 11000) throw error;",
    );
    expect(walletIdempotencySource).toContain("racedSession");
    expect(walletResolverSource).toContain(
      "idempotentWalletPayment.service.js",
    );
    expect(walletSchemaSource).toMatch(
      /input PayOrdersWithWalletInput[\s\S]*idempotencyKey: String!/,
    );
  });

  it("keeps an ambiguous checkout retry key until a success response arrives", () => {
    expect(apolloClientSource).toContain("cryptoApi.randomUUID");
    expect(apolloClientSource).toContain("cryptoApi.getRandomValues");
    expect(apolloClientSource).toContain("hashIdempotencyPayload(input)");
    expect(apolloClientSource).toContain("removeStoredCheckoutKey");
    expect(apolloClientSource).toContain(
      "result?.data?.createCheckoutOrders",
    );
    expect(apolloClientSource).toContain(":v1:${randomPart}");
    expect(apolloClientSource).not.toContain("Math.random()");
  });

  it("keeps duplicate submissions idempotent", () => {
    expect(walletServiceSource).toContain("findExistingWalletPayment({");
    expect(walletServiceSource).toContain("safeIdempotencyKey");
    expect(walletServiceSource).toContain("if (error?.code === 11000)");
    expect(walletServiceSource).toContain("reference: safeIdempotencyKey");
  });

  it("requires a real order source and restaurant scope for money changes", () => {
    expect(walletSchemaSource).toMatch(
      /input RefundToWalletInput[\s\S]*orderIds: \[ID!\]!/,
    );
    expect(walletSchemaSource).toMatch(
      /input AdjustWalletBalanceInput[\s\S]*restaurantId: ID!/,
    );
    expect(walletServiceSource).toContain(
      'throw new Error("Exactly one refund order is required")',
    );
    expect(walletServiceSource).toContain(
      'throw new Error("Customer does not belong to selected restaurant")',
    );
    expect(walletResolverSource).toContain("PERMISSIONS.REFUND_WRITE");
    expect(walletResolverSource).toContain(
      "requireRestaurantPermission(\n        ctx,\n        input.restaurantId,\n        PERMISSIONS.PAYMENT_WRITE",
    );
    expect(managerWalletSource).toContain(
      "Bắt buộc nhập đúng một mã đơn thuộc nhà hàng đã chọn.",
    );
    expect(managerWalletSource).toContain(
      "restaurantId,\n        userId: customer.id",
    );
  });

  it("records partial and full refund state across source documents", () => {
    expect(walletServiceSource).toContain('method: "e_wallet"');
    expect(walletServiceSource).toContain("paymentTransaction.refundStatus =");
    expect(walletServiceSource).toContain('"partial_refunded"');
    expect(walletServiceSource).toContain('"partially_refunded"');
    expect(walletServiceSource).toContain(
      "invoice.status = invoicePaymentStatus(invoice)",
    );
    expect(walletServiceSource).toContain('verb: "payment.refund"');
    expect(walletServiceSource).toContain('verb: "wallet.adjust"');
  });
});
