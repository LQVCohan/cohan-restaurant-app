import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production recipe rebuild script", () => {
  it("validates all recipe guides without writing to the database", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/seedProductionRecipes.js", "--validate-only"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MONGO_URI: "" },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Recipe guide validation passed");
    expect(result.stdout).toContain("dishes: 36");
    expect(result.stdout).toContain("No database changes were made");
  });
});
