import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AuthProvider logout", () => {
  it("clears Apollo account cache", () => {
    const source = readFileSync(
      new URL("../AuthProvider.jsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("apolloClient.clearStore()");
  });
});
