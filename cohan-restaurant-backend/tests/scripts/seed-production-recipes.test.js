import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production recipe binding script", () => {
  it("validates all dish and core ingredient contracts without writing to the database", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/seedProductionRecipeBindings.js", "--validate-only"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MONGO_URI: "" },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Recipe binding validation passed");
    expect(result.stdout).toContain("bindings: 36");
    expect(result.stdout).toContain("phoCoreIngredients: 2");
    expect(result.stdout).toContain("No database changes were made");
  });
});
