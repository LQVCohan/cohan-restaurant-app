import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Order mutation sessionUserId scope", () => {
  it("uses sessionUserId only inside createOrderForTable block", () => {
    const filePath = path.resolve(process.cwd(), "graphql/resolvers/order/mutation.js");
    const src = fs.readFileSync(filePath, "utf8");

    const start = src.indexOf("async createOrderForTable");
    const end = src.indexOf("async createOffPremiseOrder");

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const createOrderForTableBlock = src.slice(start, end);
    const outsideBlock = `${src.slice(0, start)}\n${src.slice(end)}`;

    expect(createOrderForTableBlock).toContain("sessionUserId");
    expect(outsideBlock).not.toContain("sessionUserId");
  });
});
