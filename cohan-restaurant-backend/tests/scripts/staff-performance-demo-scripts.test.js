import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scripts = [
  "scripts/repairDemoOperatorAccountTypes.js",
  "scripts/seedStaffPerformanceDemo.js",
  "scripts/verifyStaffPerformanceDemoData.js",
];

describe("staff performance demo scripts", () => {
  for (const script of scripts) {
    it(`${script} has valid JavaScript syntax`, () => {
      const result = spawnSync(process.execPath, ["--check", script], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    });
  }
});
