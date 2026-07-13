import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/restaurantChatbotTone.service.js";

const {
  buildFriendlyOrderAnswer,
  extractOrderLookupCode,
  humanizeStatusPhrase,
  humanizeTechnicalTokens,
  polishAnswerTone,
  softenRigidPhrases,
} = __testables;

describe("restaurant chatbot friendly tone", () => {
  it("turns technical order data into a natural Vietnamese answer", () => {
    const answer = buildFriendlyOrderAnswer({
      orderCode: "POS-20260713-T308-E1HK5J",
      publicStatus: "ORDER_RECEIVED",
      orderPaymentStatus: "unpaid",
      totals: { grandTotal: 0 },
      payment: { currency: "VND" },
    });

    expect(answer).toContain("Mình đã tìm thấy đơn POS-20260713-T308-E1HK5J của bạn");
    expect(answer).toContain("Nhà hàng đã nhận đơn và đang bắt đầu xử lý");
    expect(answer).toContain("Đơn hiện chưa thanh toán");
    expect(answer).toContain("xem chi tiết nhé");
    expect(answer).not.toContain("ORDER_RECEIVED");
    expect(answer).not.toContain("unpaid");
    expect(answer).not.toContain("0đ");
  });

  it("keeps a real total and formats it for customers", () => {
    const answer = buildFriendlyOrderAnswer({
      orderCode: "ORD-1001",
      publicStatus: "PREPARING",
      orderPaymentStatus: "paid",
      totals: { grandTotal: 125000 },
      payment: { currency: "VND" },
    });

    expect(answer).toContain("Bếp đang chuẩn bị món");
    expect(answer).toContain("Đơn đã được thanh toán");
    expect(answer).toContain("125.000đ");
  });

  it("softens rigid fallback phrases and adds a useful next step", () => {
    const answer = polishAnswerTone(
      "Hiện mình chưa tìm thấy coupon phù hợp. Bạn hãy kiểm tra lại sau.",
      {
        intent: "promotion",
        actions: [{ type: "link", label: "Xem coupon", href: "/coupons" }],
      },
    );

    expect(answer).toContain("Mình chưa tìm thấy coupon phù hợp");
    expect(answer).toContain("Bạn có thể kiểm tra lại sau");
    expect(answer).toContain("chọn nút bên dưới để tiếp tục nhé");
  });

  it("translates technical uppercase tokens without changing normal lowercase words", () => {
    expect(humanizeTechnicalTokens("Trạng thái ORDER_RECEIVED, kho OUT_OF_STOCK"))
      .toBe("Trạng thái nhà hàng đã nhận đơn, kho đã hết món");
    expect(humanizeTechnicalTokens("đơn pending")).toBe("đơn pending");
  });

  it("humanizes reservation status phrases", () => {
    expect(
      humanizeStatusPhrase(
        "Đặt bàn gần nhất hiện ở trạng thái pending.",
        "reservationHelp",
      ),
    ).toBe("Đặt bàn gần nhất hiện đang chờ nhà hàng xác nhận.");
  });

  it("extracts an explicit order code from a natural question", () => {
    expect(extractOrderLookupCode("kiểm tra đơn POS-20260713-T308-E1HK5J giúp tôi"))
      .toBe("POS-20260713-T308-E1HK5J");
    expect(extractOrderLookupCode("kiểm tra đơn gần nhất")).toBe("");
  });

  it("removes zero-value technical totals from legacy fallback text", () => {
    const answer = softenRigidPhrases(
      "Đơn ORD-1 hiện ở trạng thái đã xác nhận. Thanh toán: Đơn hiện chưa thanh toán. Tổng tiền: 0đ.",
    );
    expect(answer).not.toContain("0đ");
    expect(answer).toContain("Đơn hiện chưa thanh toán");
  });
});
