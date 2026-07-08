import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/Customer/Homepage_Client/components/DishGrid.jsx",
  "utf8",
);

describe("DishGrid", () => {
  it("routes fallback combo card to /combos", () => {
    expect(source).toContain('cta: "Xem combo"');
    expect(source).toContain('path: "/combos"');
  });

  it("refreshes the authoritative server cart after a successful add", () => {
    expect(source).toContain("const { refetchServerCart } = useCart();");
    expect(source).toContain("await refetchServerCart();");
    expect(source).not.toContain(
      "Không thể đồng bộ dòng giỏ hàng từ máy chủ",
    );
    expect(source).not.toContain("returnedItem");
  });
});
