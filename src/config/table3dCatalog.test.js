import { describe, expect, it } from "vitest";
import {
  LOCAL_TABLE_3D_CATALOG,
  TABLE_3D_TYPES,
  TABLE_3D_TYPE_TO_AREA,
  mapModelToTableForm,
  mapTable3DTypeToArea,
  normalizeCatalogItem,
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
});
