import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";

describe("cart resolver composition", () => {
  it("maps stored servingKey through the root CartItem resolver", () => {
    expect(resolvers.CartItem?.servingVariantKey).toBeTypeOf("function");
    expect(
      resolvers.CartItem.servingVariantKey({ servingKey: "default" }),
    ).toBe("default");
  });
});
