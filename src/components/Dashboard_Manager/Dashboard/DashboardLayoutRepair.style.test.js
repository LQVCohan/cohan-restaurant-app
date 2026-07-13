import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Dashboard synchronized layout repair", () => {
  it("loads the repair after older dashboard theme and empty-state overrides", () => {
    const entry = readProjectFile(
      "src/components/Dashboard_Manager/Dashboard/DashboardSynchronized.jsx",
    );

    expect(entry.indexOf('import "./DashboardLayoutRepair.scss";')).toBeGreaterThan(
      entry.indexOf('import "./DashboardPromotionTheme.scss";'),
    );
  });

  it("owns the responsive grid with higher specificity and natural card heights", () => {
    const styles = readProjectFile(
      "src/components/Dashboard_Manager/Dashboard/DashboardLayoutRepair.scss",
    );

    expect(styles).toContain(
      ".manager-dashboard:not(.manager-dashboard--no-restaurant)",
    );
    expect(styles).toContain(
      "grid-template-columns: repeat(12, minmax(0, 1fr));",
    );
    expect(styles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    expect(styles).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
    expect(styles).toContain("height: auto;");
    expect(styles).toContain("align-self: start;");
  });
});
