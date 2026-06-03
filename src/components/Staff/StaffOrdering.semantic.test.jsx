import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const staffOrderingSourcePath = join(process.cwd(), "src/components/Staff/StaffOrdering.jsx");

describe("StaffOrdering semantics", () => {
  it("does not declare the legacy nested staff POS main element", () => {
    const source = readFileSync(staffOrderingSourcePath, "utf8");

    expect(source).not.toContain('<main className="staff-pos-main">');
  });
});
