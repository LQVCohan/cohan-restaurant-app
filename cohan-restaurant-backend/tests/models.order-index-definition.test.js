import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Order model activeSessionKey index definition", () => {
  it("uses partial unique index for string activeSessionKey", () => {
    const modelPath = path.resolve(process.cwd(), "models/order.model.js");
    const src = fs.readFileSync(modelPath, "utf8");

    expect(src).toContain('name: "unique_active_table_session_key"');
    expect(src).toContain("partialFilterExpression");
    expect(src).toContain('activeSessionKey: { $type: "string" }');
    expect(src).not.toContain("sparse: true");
  });
});
