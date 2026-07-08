import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatServingLabel } from "./Cart";

const cartSource = readFileSync(
  "src/components/Customer/Homepage_Client/components/Cart.jsx",
  "utf8",
);
const providerSource = readFileSync("src/context/CartProvider.jsx", "utf8");
const stylesSource = readFileSync("src/styles/Homepage/Cart.scss", "utf8");

describe("customer cart drawer product polish", () => {
  it("uses customer-facing serving labels", () => {
    expect(formatServingLabel("portion")).toBe("Phần tiêu chuẩn");
    expect(formatServingLabel("Phần lớn")).toBe("Phần lớn");
    expect(formatServingLabel("")).toBe("");
  });

  it("carries restaurant names with the authoritative cart", () => {
    expect(providerSource).toMatch(/restaurant\s*\{\s*id\s*name\s*\}/);
    expect(providerSource).toContain(
      "restaurantName: item.restaurant?.name || null",
    );
    expect(cartSource).not.toContain("query RestaurantById");
    expect(cartSource).not.toContain("Nhà hàng ${group.restaurantId}");
    expect(cartSource).toContain(
      'group.restaurantName || "Nhà hàng đã chọn"',
    );
  });

  it("uses production wording and responsive drawer primitives", () => {
    expect(cartSource).toContain("Tiếp tục thanh toán");
    expect(cartSource).toContain("Hoàn tất chọn món");
    expect(cartSource).toContain("Tạm tính tại nhà hàng");
    expect(cartSource).toContain("Khẩu phần");
    expect(stylesSource).toContain("height: 100dvh");
    expect(stylesSource).toContain(":focus-visible");
    expect(stylesSource).toContain("prefers-reduced-motion");
  });
});
