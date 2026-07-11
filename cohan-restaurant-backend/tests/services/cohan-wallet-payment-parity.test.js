import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import PaymentSession from "../../models/payment-session.model.js";

const readSource = (relativePath) =>
  readFileSync(join(process.cwd(), "cohan-restaurant-backend", relativePath), "utf8");

const walletServiceSource = readSource("src/services/wallet/wallet.service.js");
const walletResolverSource = readSource("graphql/resolvers/wallet/index.js");
const walletSchemaSource = readSource("graphql/schema/wallet.graphql");
const deferredCheckoutSource = readSource(
  "graphql/resolvers/order/deferredOnlineCheckout.js",
);
const managerWalletSource = readFileSync(
  join(
    process.cwd(),
    "src/components/Dashboard_Manager/Wallet/ManagerWalletPage.jsx",
  ),
  "utf8",
);

describe("Cohan wallet payment parity", () => {
  it("supports an internal payment session without external credentials", () => {
    expect(PaymentSession.schema.path("provider").enumValues).toContain(
      "cohan_wallet",
    );
    expect(walletServiceSource).toContain('provider: WALLET_PROVIDER');
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
    expect(payFlow).toContain(
      '"payment.paidAmount": roundMoney(',
    );
    expect(payFlow).not.toContain("PaymentTransaction.create(");
    expect(payFlow).not.toContain("Cashflow.create(");
  });

  it("keeps wallet checkout deferred until the debit succeeds", () => {
    expect(deferredCheckoutSource).toContain(
      'const ONLINE_CHECKOUT_METHODS = new Set(["card", "wallet"]);',
    );
    expect(deferredCheckoutSource).toContain("await payOrdersWithWallet({");
    expect(deferredCheckoutSource.indexOf("await payOrdersWithWallet({")).toBeLessThan(
      deferredCheckoutSource.indexOf('"payment.status": "paid"'),
    );
    expect(deferredCheckoutSource).toContain("await emitPaymentRealtime({");
  });

  it("keeps duplicate submissions idempotent", () => {
    expect(walletServiceSource).toContain("findExistingWalletPayment({");
    expect(walletServiceSource).toContain("safeIdempotencyKey");
    expect(walletServiceSource).toContain("if (error?.code === 11000)");
    expect(walletServiceSource).toContain(
      'reference: safeIdempotencyKey',
    );
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
    expect(managerWalletSource).toContain("restaurantId,\n        userId: customer.id");
  });

  it("records partial and full refund state across source documents", () => {
    expect(walletServiceSource).toContain('method: "e_wallet"');
    expect(walletServiceSource).toContain(
      'paymentTransaction.refundStatus =',
    );
    expect(walletServiceSource).toContain('"partial_refunded"');
    expect(walletServiceSource).toContain('"partially_refunded"');
    expect(walletServiceSource).toContain("invoice.status = invoicePaymentStatus(invoice)");
    expect(walletServiceSource).toContain('verb: "payment.refund"');
    expect(walletServiceSource).toContain('verb: "wallet.adjust"');
  });
});
