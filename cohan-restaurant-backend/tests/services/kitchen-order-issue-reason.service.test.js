import { describe, expect, it } from "vitest";
import { classifyKitchenOrderIssueReason } from "../../src/services/kitchen/kitchenOrderIssueReason.service.js";

describe("kitchenOrderIssueReason service", () => {
  it("classifies kitchen and non-kitchen reasons", () => {
    expect(classifyKitchenOrderIssueReason("món cháy")).toMatchObject({ category: "kitchen_quality", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("ra món quá lâu")).toMatchObject({ category: "kitchen_delay", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("bếp làm sai món")).toMatchObject({ category: "kitchen_wrong_item", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("hết nguyên liệu")).toMatchObject({ category: "kitchen_unavailable", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("nhân viên nhập sai món")).toMatchObject({ category: "service_order_mistake", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason("khách đổi ý")).toMatchObject({ category: "customer_request", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason("sai bill")).toMatchObject({ category: "payment_or_bill", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason("Món nguội")).toMatchObject({ category: "kitchen_quality", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Món cháy / khét")).toMatchObject({ category: "kitchen_quality", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Món sống hoặc chưa chín")).toMatchObject({ category: "kitchen_quality", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Bếp làm sai món")).toMatchObject({ category: "kitchen_wrong_item", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Ra món quá lâu")).toMatchObject({ category: "kitchen_delay", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Hết món / hết nguyên liệu")).toMatchObject({ category: "kitchen_unavailable", isKitchenRelated: true });
    expect(classifyKitchenOrderIssueReason("Khách đổi ý")).toMatchObject({ category: "customer_request", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason("Sai bill / sai hóa đơn")).toMatchObject({ category: "payment_or_bill", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason("")).toMatchObject({ category: "unknown", isKitchenRelated: false });
    expect(classifyKitchenOrderIssueReason(null)).toMatchObject({ category: "unknown", isKitchenRelated: false });
  });
});
