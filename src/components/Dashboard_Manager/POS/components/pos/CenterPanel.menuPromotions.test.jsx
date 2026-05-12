import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/Dashboard_Manager/POS/components/pos/CenterPanel.jsx",
  ),
  "utf8",
);

const styleSource = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/Dashboard_Manager/POS/components/pos/CenterPanel.module.scss",
  ),
  "utf8",
);

describe("CenterPanel menu promotions", () => {
  it("loads active item and category promotions for menu cards", () => {
    expect(source).toContain("useActiveMenuPromotions");
    expect(source).toContain("getPromotionForMenuItem");
    expect(source).toContain("getPromotionLabel");
    expect(source).toContain("_promotion");
    expect(source).toContain("_promotionLabel");
  });

  it("renders promotion badge and name on menu cards", () => {
    expect(source).toContain("promoBadge");
    expect(source).toContain("promoName");
    expect(source).toContain("item._promotionLabel");
    expect(source).toContain("item._promotion?.name");
  });

  it("styles promotion badge and promotion name", () => {
    expect(styleSource).toContain(".promoBadge");
    expect(styleSource).toContain(".promoName");
  });
});
