import { describe, expect, it } from "vitest";
import {
  localizeDemoLabel,
  localizeDemoLabelList,
  stripDemoTags,
} from "./vietnameseDemoLabels";

describe("vietnameseDemoLabels", () => {
  it("translates seeded staff names while preserving branch names", () => {
    expect(localizeDemoLabel("Demo Cashier")).toBe(
      "Nhân viên mẫu - Thu ngân",
    );
    expect(localizeDemoLabel("COHAN Demo Server - Thủ Đức")).toBe(
      "Nhân viên mẫu - Phục vụ - Thủ Đức",
    );
  });

  it("translates menu and inventory demo labels and removes technical tags", () => {
    expect(
      localizeDemoLabel("Pho Signature [demo-menu-management-2026]"),
    ).toBe("Phở đặc biệt");
    expect(
      localizeDemoLabel("Beef Slice [demo-menu-management-2026]"),
    ).toBe("Thịt bò thái lát");
    expect(stripDemoTags("Tên mới [demo-menu-management-2026]")).toBe(
      "Tên mới",
    );
  });

  it("keeps real user data unchanged and supports lists", () => {
    expect(localizeDemoLabel("Nguyễn Văn An")).toBe("Nguyễn Văn An");
    expect(localizeDemoLabelList(["Pho Signature", "Bún bò Huế"])).toEqual([
      "Phở đặc biệt",
      "Bún bò Huế",
    ]);
  });
});
