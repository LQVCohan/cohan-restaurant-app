import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("./RestaurantPaymentMethodsSimple.css", import.meta.url),
  "utf8",
);
const mainEntry = readFileSync(
  new URL("../../../main.jsx", import.meta.url),
  "utf8",
);

describe("restaurant payment method presentation", () => {
  it("loads the scoped payment-method presentation rules", () => {
    expect(mainEntry).toContain(
      'import "./components/Dashboard_Manager/RestaurantInfo/RestaurantPaymentMethodsSimple.css";',
    );
  });

  it("hides internal provider configuration and keeps the enable control visible", () => {
    expect(css).toContain(".payment-provider-card");
    expect(css).toContain("> .ant-col:nth-child(-n + 3)");
    expect(css).toContain("display: none !important");
    expect(css).toContain("> .ant-col:last-child");
    expect(css).toContain("flex: 0 0 100%");
  });
});
