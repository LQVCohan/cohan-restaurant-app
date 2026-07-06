import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production recipe stock seed", () => {
  it("validates stock targets without writing to MongoDB", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/seedProductionRecipeStock.js",
        "--validate-only",
        "--portion-target=30",
        "--weight-target=5",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MONGO_URI: "" },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Recipe stock validation passed");
    expect(result.stdout).toContain("portionTarget: 30");
    expect(result.stdout).toContain("weightTarget: 5");
    expect(result.stdout).toContain("No database changes were made");
  });

  it("rejects a non-positive portion target", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/seedProductionRecipeStock.js", "--portion-target=0"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MONGO_URI: "" },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--portion-target must be a positive integer");
  });
});
