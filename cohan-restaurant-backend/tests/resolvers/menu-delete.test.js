import { describe, expect, it } from "vitest";

const MENU_HAS_ITEMS_MESSAGE = "MENU_HAS_ITEMS";

function mapMenuRemovalMessage(error) {
  const code = error?.extensions?.code || error?.message;
  if (code === MENU_HAS_ITEMS_MESSAGE) {
    return "Không thể xóa thực đơn vì vẫn còn món ăn thuộc thực đơn này.";
  }
  return error?.message || "Không thể xóa thực đơn.";
}

describe("menu deletion workflow", () => {
  it("maps MENU_HAS_ITEMS to a clear Vietnamese message", () => {
    expect(
      mapMenuRemovalMessage({ extensions: { code: MENU_HAS_ITEMS_MESSAGE } }),
    ).toBe("Không thể xóa thực đơn vì vẫn còn món ăn thuộc thực đơn này.");
  });

  it("keeps a fallback message for unknown errors", () => {
    expect(mapMenuRemovalMessage(new Error("UNKNOWN"))).toBe("UNKNOWN");
  });
});
