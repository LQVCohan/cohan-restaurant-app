import { describe, expect, it } from "vitest";
import {
  buildPaymentReturnPage,
  getVnpayIpnRejection,
} from "../../src/server/createServer.js";

describe("payment provider callback contracts", () => {
  it("maps rejected VNPAY IPN callbacks to provider response codes", () => {
    expect(
      getVnpayIpnRejection(
        { callbackStatus: "rejected", amount: 150000 },
        { vnp_Amount: "10000000" },
      ),
    ).toEqual({ RspCode: "04", Message: "Invalid Amount" });

    expect(
      getVnpayIpnRejection(
        { callbackStatus: "rejected", amount: 150000 },
        { vnp_Amount: "15000000" },
      ),
    ).toEqual({ RspCode: "97", Message: "Invalid Checksum" });

    expect(
      getVnpayIpnRejection(
        { callbackStatus: "accepted", amount: 150000 },
        { vnp_Amount: "15000000" },
      ),
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
});
