import { describe, expect, it } from "vitest";

import { toReadableNotificationMessage } from "./useNotification";

describe("toReadableNotificationMessage", () => {
  it("turns a missing stock-item failure into a user-facing message", () => {
    expect(
      toReadableNotificationMessage(
        "StockItem not found for ingredients: unknown-item",
        "error",
      ),
    ).toContain("nguyên liệu của món chưa được thiết lập trong kho");
  });

  it("turns invalid date-time details into a short instruction", () => {
    expect(
      toReadableNotificationMessage(
        "DateTime cannot represent invalid date-time-string",
        "error",
      ),
    ).toContain("Ngày hoặc giờ chưa hợp lệ");
  });

  it("keeps a successful message unchanged", () => {
    expect(
      toReadableNotificationMessage("Đã lưu đơn thành công.", "success"),
    ).toBe("Đã lưu đơn thành công.");
  });
});
