import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Keep this filename executable for targeted CI patterns such as:
// npm test -- staff-shifts-lifecycle-guard
// The resolver-level suite below contains the real mocked resolver invocation
// coverage for createStaffShift/createStaffShifts lifecycle behavior.
import "./staff-shifts-lifecycle-guard.resolver.test.js";

const currentFile = fileURLToPath(import.meta.url);
const mutationPath = path.resolve(
  path.dirname(currentFile),
  "../../graphql/resolvers/staff/mutation.js",
);
const mutationSource = readFileSync(mutationPath, "utf8");

describe("createStaffShift lifecycle guard source contract", () => {
  it("allows direct creation when effectiveStatus is revision_draft", () => {
    expect(mutationSource).toContain('["draft", "revision_draft"].includes(effectiveStatus)');
  });

  it("rejects direct creation for unknown non-draft lifecycle states with the draft-state message", () => {
    expect(mutationSource).toContain('if (!["draft", "revision_draft"].includes(effectiveStatus))');
    expect(mutationSource).toContain(
      "Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.",
    );
  });
});
