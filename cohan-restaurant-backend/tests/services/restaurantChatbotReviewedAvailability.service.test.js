import { describe, expect, it } from "vitest";
import { MENU_ITEM_INVENTORY_STATUS } from "../../src/services/menuItemInventoryAvailability.service.js";
import { __testables } from "../../src/services/ai/restaurantChatbotReviewed.service.js";

const {
  isSelectedMenuItemAvailabilityQuestion,
  buildSelectedMenuItemAvailabilityAnswer,
} = __testables;

describe("restaurant chatbot selected menu availability", () => {
  it("recognizes stock and remaining quantity questions", () => {
    expect(isSelectedMenuItemAvailabilityQuestion("Hết món rồi phải làm sao?")).toBe(true);
    expect(isSelectedMenuItemAvailabilityQuestion("Ở trang này còn lại bao nhiêu phần?")).toBe(true);
    expect(isSelectedMenuItemAvailabilityQuestion("Món này có cay không?")).toBe(false);
  });

  it("answers out-of-stock questions with a grounded zero quantity", () => {
    const answer = buildSelectedMenuItemAvailabilityAnswer({
      item: { name: "Phở bò" },
      availability: {
        inventoryStatus: MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK,
        maxAvailable: 0,
      },
    });

    expect(answer).toContain("Phở bò");
    expect(answer).toContain("hết nguyên liệu");
    expect(answer).toContain("là 0");
  });

  it("reports the calculated maximum when inventory is available", () => {
    const answer = buildSelectedMenuItemAvailabilityAnswer({
      item: { name: "Phở bò" },
      availability: {
        inventoryStatus: MENU_ITEM_INVENTORY_STATUS.LOW_STOCK,
        maxAvailable: 3,
      },
    });

    expect(answer).toContain("3 phần");
    expect(answer).toContain("gần hết");
  });

  it("does not invent an exact quantity when inventory is not tracked", () => {
    const answer = buildSelectedMenuItemAvailabilityAnswer({
      item: { name: "Phở bò" },
      availability: {
        inventoryStatus: MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED,
        maxAvailable: 0,
      },
    });

    expect(answer).toContain("chưa có số lượng còn lại chính xác");
    expect(answer).not.toContain("còn tối đa khoảng 0 phần");
  });
});
