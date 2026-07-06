import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scripts = [
  "scripts/repairDemoOperatorAccountTypes.js",
  "scripts/prepareStaffPerformanceDemoPeriods.js",
  "scripts/seedStaffPerformanceDemo.js",
  "scripts/seedStaffPerformanceDemoUtc.js",
  "scripts/seedStaffPerformanceWeekRoster.js",
  "scripts/seedStaffPerformanceWeekRosterUtc.js",
  "scripts/verifyStaffPerformanceDemoData.js",
  "scripts/verifyStaffPerformanceDemoDataUtc.js",
  "scripts/verifyStaffPerformanceWeekRoster.js",
];

const utcWrappers = [
  "scripts/seedStaffPerformanceDemoUtc.js",
  "scripts/seedStaffPerformanceWeekRosterUtc.js",
  "scripts/verifyStaffPerformanceDemoDataUtc.js",
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

  for (const script of utcWrappers) {
    it(`${script} sets UTC before importing the worker`, () => {
      const source = readFileSync(script, "utf8");
      expect(source.indexOf('process.env.TZ = "UTC"')).toBeGreaterThanOrEqual(0);
      expect(source.indexOf('process.env.TZ = "UTC"')).toBeLessThan(
        source.indexOf("await import"),
      );
    });
  }
});
