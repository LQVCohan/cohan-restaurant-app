import { describe, expect, it } from "vitest";
import {
  LOCAL_TABLE_3D_CATALOG,
  TABLE_3D_TYPES,
  TABLE_3D_TYPE_TO_AREA,
  mapModelToTableForm,
  mapTable3DTypeToArea,
  normalizeCatalogItem,
  canOpenModelViewerAr,
  getArUnavailableReason,
  getModelAssetBadges,
  getModelAssetSummary,
} from "./table3dCatalog";

describe("table3dCatalog", () => {
  describe("TABLE_3D_TYPE_TO_AREA", () => {
    it("contains expected mappings", () => {
      expect(TABLE_3D_TYPE_TO_AREA).toMatchObject({
        [TABLE_3D_TYPES.ROUND]: "standard",
        [TABLE_3D_TYPES.RECT_2]: "standard",
        [TABLE_3D_TYPES.RECT_4]: "standard",
        [TABLE_3D_TYPES.VIP]: "vip",
        [TABLE_3D_TYPES.BOOTH]: "booth",
      });
    });
  });

  describe("mapTable3DTypeToArea", () => {
    it("maps known types correctly", () => {
      expect(mapTable3DTypeToArea(TABLE_3D_TYPES.ROUND)).toBe("standard");
      expect(mapTable3DTypeToArea(TABLE_3D_TYPES.RECT_2)).toBe("standard");
      expect(mapTable3DTypeToArea(TABLE_3D_TYPES.RECT_4)).toBe("standard");
      expect(mapTable3DTypeToArea(TABLE_3D_TYPES.VIP)).toBe("vip");
      expect(mapTable3DTypeToArea(TABLE_3D_TYPES.BOOTH)).toBe("booth");
    });

    it("falls back to standard for unknown or missing types", () => {
      expect(mapTable3DTypeToArea("unknown")).toBe("standard");
      expect(mapTable3DTypeToArea(null)).toBe("standard");
      expect(mapTable3DTypeToArea(undefined)).toBe("standard");
    });
  });

  describe("mapModelToTableForm", () => {
    it("maps VIP model into vip area", () => {
      expect(
        mapModelToTableForm({
          key: "vip-sofa-6",
          tableType: TABLE_3D_TYPES.VIP,
          capacity: 6,
        })
      ).toEqual({
        area: "vip",
        seats: 6,
        visualTemplate: "vip-sofa-6",
      });
    });

    it("maps BOOTH model into booth area", () => {
      expect(
        mapModelToTableForm({
          key: "booth-sofa-4",
          tableType: TABLE_3D_TYPES.BOOTH,
          capacity: 4,
        })
      ).toEqual({
        area: "booth",
        seats: 4,
        visualTemplate: "booth-sofa-4",
      });
    });

    it("maps ROUND/RECT models into standard area", () => {
      expect(
        mapModelToTableForm({ key: "round-oak-4", tableType: TABLE_3D_TYPES.ROUND, capacity: 4 })
          .area
      ).toBe("standard");
      expect(
        mapModelToTableForm({
          key: "rect-2-walnut",
          tableType: TABLE_3D_TYPES.RECT_2,
          capacity: 2,
        }).area
      ).toBe("standard");
      expect(
        mapModelToTableForm({
          key: "rect-4-modern",
          tableType: TABLE_3D_TYPES.RECT_4,
          capacity: 4,
        }).area
      ).toBe("standard");
    });


    it("maps custom model spec into custom area/seats/template", () => {
      expect(
        mapModelToTableForm({
          key: "custom-booth-window",
          customModelSpec: {
            name: "Booth cửa sổ",
            area: "booth",
            capacity: 5,
          },
        })
      ).toEqual({
        area: "booth",
        seats: 5,
        visualTemplate: "custom-booth-window",
      });
    });

    it("uses defaults for missing capacity and key", () => {
      expect(mapModelToTableForm({ tableType: TABLE_3D_TYPES.RECT_4 })).toEqual({
        area: "standard",
        seats: 4,
        visualTemplate: "",
      });
    });
  });

  describe("LOCAL_TABLE_3D_CATALOG consistency", () => {
    it("keeps booth and vip templates aligned with form area mapping", () => {
      const booth = LOCAL_TABLE_3D_CATALOG.find((item) => item.key === "booth-sofa-4");
      const vip = LOCAL_TABLE_3D_CATALOG.find((item) => item.key === "vip-sofa-6");

      expect(booth).toBeTruthy();
      expect(vip).toBeTruthy();
      expect(mapModelToTableForm(booth).area).toBe("booth");
      expect(mapModelToTableForm(vip).area).toBe("vip");
    });
  });

  describe("normalizeCatalogItem", () => {
    it("normalizes unknown tableType to RECT_4 and keeps default capacity", () => {
      const normalized = normalizeCatalogItem({
        key: "x",
        label: "X",
        tableType: "unknown-type",
      });

      expect(normalized.tableType).toBe(TABLE_3D_TYPES.RECT_4);
      expect(normalized.capacity).toBe(4);
    });
  });

  describe("AR helpers", () => {
    it("detects whether model-viewer AR can be opened from a public modelUrl", () => {
      expect(canOpenModelViewerAr({ modelUrl: "https://example.com/table.glb" })).toBe(true);
      expect(canOpenModelViewerAr({ modelUrl: "   " })).toBe(false);
      expect(canOpenModelViewerAr({ modelUrl: "" })).toBe(false);
      expect(canOpenModelViewerAr({})).toBe(false);
      expect(canOpenModelViewerAr(null)).toBe(false);
    });

    it("returns human-readable unavailable reason when AR cannot be opened", () => {
      expect(getArUnavailableReason(null)).toBe("Chọn mẫu để kiểm tra hỗ trợ AR.");
      expect(getArUnavailableReason({ modelUrl: "" })).toBe(
        "Mẫu này chưa có model 3D công khai để mở AR."
      );
      expect(getArUnavailableReason({ modelUrl: "https://example.com/table.glb" })).toBe("");
    });
  });

  describe("model asset helpers", () => {
    it("returns 3D and AR badges when modelUrl is available", () => {
      expect(
        getModelAssetBadges({
          key: "round-oak-4",
          modelUrl: "https://example.com/table.glb",
        })
      ).toEqual(["3D", "AR"]);
    });

    it("returns Placeholder badge when modelUrl is missing", () => {
      expect(getModelAssetBadges({ key: "rect-2-walnut", modelUrl: "" })).toEqual([
        "Placeholder",
      ]);
    });

    it("returns Tùy chỉnh and Placeholder badges for custom model without modelUrl", () => {
      expect(
        getModelAssetBadges({
          key: "custom-vip-1",
          modelUrl: "",
          customModelSpec: { name: "custom-vip-1" },
        })
      ).toEqual(["Tùy chỉnh", "Placeholder"]);
    });

    it("returns correct model asset summary status", () => {
      expect(
        getModelAssetSummary({
          key: "round-oak-4",
          source: "public-fallback",
          modelUrl: "https://example.com/table.glb",
        })
      ).toEqual({
        has3DModel: true,
        arReady: true,
        source: "public-fallback",
        modelKey: "round-oak-4",
      });

      expect(
        getModelAssetSummary({
          key: "rect-2-walnut",
          source: "public-fallback",
          modelUrl: "",
        })
      ).toEqual({
        has3DModel: false,
        arReady: false,
        source: "public-fallback",
        modelKey: "rect-2-walnut",
      });
    });
  });
});
