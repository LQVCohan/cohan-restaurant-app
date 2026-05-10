import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentFile = fileURLToPath(import.meta.url);
const bindingTestPath = path.resolve(
  path.dirname(currentFile),
  "./timesheet-shift-binding.test.js",
);
const bindingTestSource = readFileSync(bindingTestPath, "utf8");

describe("Timesheet official schedule binding no-publication regression contract", () => {
  it("keeps no-publication shifts out of official scheduled attendance coverage", () => {
    expect(bindingTestSource).toContain('it.each(["draft", "revision_draft"])');
    expect(bindingTestSource).toContain("check-in does not bind");
    expect(bindingTestSource).toContain("unscheduled_checkin");
    expect(bindingTestSource).toContain("SchedulePublication.findOne");
  });
});
