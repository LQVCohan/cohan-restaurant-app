import { beforeEach, describe, expect, it, vi } from "vitest";

const paymentService = vi.hoisted(() => ({
  applyPaymentProviderCallback: vi.fn(),
  createReservationPayment: vi.fn(),
  getPaymentSessionById: vi.fn(),
  listReservationPayments: vi.fn(),
  reconcileBankTransferWebhook: vi.fn(),
}));

const paymentRealtime = vi.hoisted(() => ({
  emitPaymentRealtime: vi.fn(),
}));

vi.mock("../../src/services/payment/paymentSession.service.js", () => paymentService);
vi.mock("../../src/services/payment/paymentRealtime.service.js", () => paymentRealtime);

const {
  buildPaymentReturnPage,
  getVnpayIpnValidationError,
  settleVerifiedVnpayReturn,
} = await import("../../src/server/createServer.js");

describe("payment provider callback contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates VNPAY IPN in checksum, order and amount order", () => {
    const payment = { amount: 150000 };
    const mismatched = { vnp_Amount: "10000000" };
    const matching = { vnp_Amount: "15000000" };

    expect(
      getVnpayIpnValidationError({
        signatureValid: false,
        payment,
        payload: mismatched,
      }),
    ).toEqual({ RspCode: "97", Message: "Invalid Checksum" });
    expect(
      getVnpayIpnValidationError({
        signatureValid: true,
        payment: null,
        payload: matching,
      }),
    ).toEqual({ RspCode: "01", Message: "Order not found" });
    expect(
      getVnpayIpnValidationError({
        signatureValid: true,
        payment,
        payload: mismatched,
      }),
    ).toEqual({ RspCode: "04", Message: "Invalid Amount" });
    expect(
      getVnpayIpnValidationError({
        signatureValid: true,
        payment,
        payload: matching,
      }),
    ).toBeNull();
  });

  it("renders a user-facing return page without raw callback data", () => {
    const html = buildPaymentReturnPage({
      provider: "vnpay",
      verified: true,
      successful: true,
      paymentFound: true,
      reference: '<script>alert("x")</script>',
    });

    expect(html).toContain("Đã ghi nhận kết quả thanh toán");
    expect(html).toContain("VNPAY");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("vnp_SecureHash");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("shows a clear error state for an unverified return", () => {
    const html = buildPaymentReturnPage({
      provider: "momo",
      verified: false,
      successful: false,
      paymentFound: true,
      reference: "MOMO-REF-1",
    });

    expect(html).toContain("Không thể xác thực kết quả thanh toán");
    expect(html).toContain("MoMo");
  });

  it("settles a verified successful VNPAY return and emits realtime", async () => {
    const originalPayment = { _id: "payment-1", status: "pending" };
    const updatedPayment = {
      _id: "payment-1",
      userId: "user-1",
      status: "success",
    };
    const io = {};
    paymentService.applyPaymentProviderCallback.mockResolvedValue(updatedPayment);

    await expect(
      settleVerifiedVnpayReturn({
        provider: "vnpay",
        payload: { vnp_TxnRef: "VNPAY-REF-1" },
        payment: originalPayment,
        verified: true,
        successful: true,
        io,
      }),
    ).resolves.toBe(updatedPayment);

    expect(paymentService.applyPaymentProviderCallback).toHaveBeenCalledWith({
      provider: "vnpay",
      payload: { vnp_TxnRef: "VNPAY-REF-1" },
      source: "return_fallback",
    });
    expect(paymentRealtime.emitPaymentRealtime).toHaveBeenCalledWith({
      io,
      payment: updatedPayment,
      eventType: "PAYMENT_VERIFIED",
    });
  });

  it("does not settle an unverified VNPAY return", async () => {
    const payment = { _id: "payment-1", status: "pending" };

    await expect(
      settleVerifiedVnpayReturn({
        provider: "vnpay",
        payload: { vnp_TxnRef: "VNPAY-REF-1" },
        payment,
        verified: false,
        successful: true,
        io: {},
      }),
    ).resolves.toBe(payment);

    expect(paymentService.applyPaymentProviderCallback).not.toHaveBeenCalled();
    expect(paymentRealtime.emitPaymentRealtime).not.toHaveBeenCalled();
  });
});
