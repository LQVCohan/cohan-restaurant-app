import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(stylesDir, "..");
const cssPath = path.join(stylesDir, "ShiftDetailModalWorkspace.css");
const mainPath = path.join(sourceRoot, "main.jsx");

describe("ShiftDetailModal workspace polish", () => {
  it("is loaded after the existing application styles", async () => {
    const source = await readFile(mainPath, "utf8");
    expect(source).toContain('import "./styles/ShiftDetailModalWorkspace.css";');
  });

  it("provides a wide two-column desktop workspace with a sticky action bar", async () => {
    const css = await readFile(cssPath, "utf8");

    expect(css).toContain("width: min(1120px, 100%);");
    expect(css).toContain(
      "grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);",
    );
    expect(css).toContain(".section-block.add-section");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("bottom: 0;");
  });

  it("collapses to one column and a full-height mobile modal", async () => {
    const css = await readFile(cssPath, "utf8");

    expect(css).toContain("@media (max-width: 920px)");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("height: 100dvh;");
    expect(css).toContain("grid-template-columns: 1fr;");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps keyboard focus and reduced-motion accessibility contracts", async () => {
    const css = await readFile(cssPath, "utf8");

    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
