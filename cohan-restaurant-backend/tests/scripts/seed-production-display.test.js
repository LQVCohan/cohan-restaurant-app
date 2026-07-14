import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(testDir, "../..");
const repoRoot = path.resolve(backendDir, "..");

const menuSeedPath = path.join(
  backendDir,
  "scripts/seedMenuManagementDemo.js",
);
const couponSeedPath = path.join(
  backendDir,
  "scripts/seedCouponPromotionDemo.js",
);

const menuAssets = [
  "public/images/menu/pho-bo-dac-biet.svg",
  "public/images/menu/tra-dao-cam-sa.svg",
  "public/images/menu/bo-nuong-tieu-den.svg",
  "public/images/menu/sup-bi-do.svg",
];

describe("production-facing seed display data", () => {
  it("ships every menu image referenced by the production catalog", async () => {
    for (const relativePath of menuAssets) {
      await expect(access(path.join(repoRoot, relativePath))).resolves.toBeUndefined();
    }
  });

  it("uses commercial menu names and keeps legacy tags only in cleanup rules", async () => {
    const source = await readFile(menuSeedPath, "utf8");

    expect(source).toContain('name: "Món nước"');
    expect(source).toContain('name: "Phở bò đặc biệt"');
    expect(source).toContain('name: "Trà đào cam sả"');
    expect(source).toContain('name: "Bò nướng sốt tiêu đen"');
    expect(source).toContain('name: "Súp bí đỏ kem tươi"');
    expect(source).not.toMatch(/name:\s*`?[^\n]*(?:demo-menu|\[demo)/i);
    expect(source).not.toMatch(/description:\s*`?[^\n]*(?:demo-menu|\[demo)/i);
  });

  it("uses customer-facing coupon and promotion names", async () => {
    const source = await readFile(couponSeedPath, "utf8");

    expect(source).toContain('name: "Ưu đãi thành viên 10%"');
    expect(source).toContain('name: `Tặng ${tea.name} khi gọi ${pho.name}`');
    expect(source).toContain('code: "THANHVIEN10"');
    expect(source).toContain('code: "PHOTANGTRA"');
    expect(source).not.toMatch(/name:\s*"(?:Active|Expired|Demo|Fixed 20k)/i);
  });
});
