import { describe, expect, it } from "vitest";

import { parseTableAccessQr } from "./tableQrAccess";

const restaurantId = "6a5018c92a9577d6a9cf4bb1";
const tableId = "6a5018c92a9577d6a9cf4bb2";

describe("parseTableAccessQr", () => {
  it("rebuilds a safe internal route from a signed table URL", () => {
    const result = parseTableAccessQr(
      `https://example.com/table/${restaurantId}/${tableId}?token=signed.table.token`,
    );

    expect(result).toMatchObject({
      ok: true,
      restaurantId,
      tableId,
      path: `/table/${restaurantId}/${tableId}?token=signed.table.token`,
    });
  });

  it.each([
    ["unrelated QR", "https://example.com/promotions/today"],
    ["missing token", `https://example.com/table/${restaurantId}/${tableId}`],
    ["invalid restaurant id", `https://example.com/table/not-an-id/${tableId}?token=signed`],
    ["unsafe protocol", `javascript:/table/${restaurantId}/${tableId}?token=signed`],
  ])("rejects %s", (_label, value) => {
    expect(parseTableAccessQr(value).ok).toBe(false);
  });
});

