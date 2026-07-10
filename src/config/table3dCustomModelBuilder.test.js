import { describe, expect, it } from "vitest";
import {
  buildAiGeneratedTableCatalogItem,
  buildCustomTableCatalogItem,
  buildUploadedTableCatalogItem,
  DEFAULT_CUSTOM_TABLE_SPEC,
  mapCustomTableSpecToTableForm,
  normalizeCustomTableSpec,
} from "./table3dCustomModelBuilder";

describe("table3dCustomModelBuilder", () => {
  describe("normalizeCustomTableSpec", () => {
    it("applies defaults and fallbacks", () => {
      const normalized = normalizeCustomTableSpec({
        shape: "weird",
        area: "strange",
        material: "",
        color: "",
      });

      expect(normalized.shape).toBe("rect");
      expect(normalized.area).toBe("standard");
      expect(normalized.material).toBe("wood");
      expect(normalized.color).toBe("#b98962");
      expect(normalized.capacity).toBe(DEFAULT_CUSTOM_TABLE_SPEC.capacity);
    });

    it("trims text and clamps numeric values", () => {
      const normalized = normalizeCustomTableSpec({
        name: "  Bàn cửa sổ  ",
        notes: "  ưu tiên góc trái ",
        referenceImageName: "  inspo.png  ",
        capacity: 0,
        widthCm: 0,
        depthCm: -5,
        heightCm: "abc",
        diameterCm: null,
      });

      expect(normalized.name).toBe("Bàn cửa sổ");
      expect(normalized.notes).toBe("ưu tiên góc trái");
      expect(normalized.referenceImageName).toBe("inspo.png");
      expect(normalized.capacity).toBe(1);
      expect(normalized.widthCm).toBe(1);
      expect(normalized.depthCm).toBe(1);
      expect(normalized.heightCm).toBe(75);
      expect(normalized.diameterCm).toBe(1);
    });

    it("accepts the modal label alias", () => {
      expect(normalizeCustomTableSpec({ label: "  Bàn AI  " }).name).toBe(
        "Bàn AI",
      );
    });
  });

  describe("buildCustomTableCatalogItem", () => {
    it("builds parametric user-generated catalog item", () => {
      const item = buildCustomTableCatalogItem(
        { name: "Booth Family", capacity: 6, area: "booth" },
        { timestamp: 999 },
      );

      expect(item.key).toBe("custom-booth-family-999");
      expect(item.source).toBe("user-generated");
      expect(item.fallbackKind).toBe("parametric");
      expect(item.customModelSpec).toBeTruthy();
      expect(item.capacity).toBe(6);
      expect(item.customModelSpec.area).toBe("booth");
    });

    it("creates vietnamese-friendly slug with deterministic timestamp", () => {
      const item = buildCustomTableCatalogItem(
        { name: "Bàn cửa sổ" },
        { timestamp: 123 },
      );
      expect(item.key).toContain("custom-ban-cua-so-123");
    });

    it("generates different keys for same name with different timestamps", () => {
      const first = buildCustomTableCatalogItem(
        { name: "Bàn cửa sổ" },
        { timestamp: 123 },
      );
      const second = buildCustomTableCatalogItem(
        { name: "Bàn cửa sổ" },
        { timestamp: 124 },
      );
      expect(first.key).not.toBe(second.key);
    });

    it("falls back to table slug when name is empty", () => {
      const item = buildCustomTableCatalogItem(
        { name: "" },
        { timestamp: 123 },
      );
      expect(item.key).toBe("custom-table-123");
    });
  });

  describe("buildUploadedTableCatalogItem", () => {
    it("builds uploaded user catalog item with upload metadata", () => {
      const item = buildUploadedTableCatalogItem(
        {
          name: "Uploaded GLB",
          tableType: "booth-sofa",
          capacity: 6,
          modelUrl: "https://cdn.example.com/table.glb",
          thumbnailUrl: "https://cdn.example.com/table.webp",
          source: "Vendor source note",
          uploadedFileName: "table.glb",
          uploadedSizeBytes: 2048,
          tags: "upload, glb",
        },
        { timestamp: 999 },
      );

      expect(item.key).toBe("custom-upload-uploaded-glb-999");
      expect(item.source).toBe("user-upload");
      expect(item.sourceLabel).toBe("Vendor source note");
      expect(item.customModelKind).toBe("upload");
      expect(item.fallbackKind).toBe("model");
      expect(item.uploadedFileName).toBe("table.glb");
      expect(item.uploadedSizeBytes).toBe(2048);
      expect(item.tags).toEqual(["upload", "glb"]);
    });
  });

  describe("buildAiGeneratedTableCatalogItem", () => {
    it("builds an AI generated custom catalog item when generatedModelUrl exists", () => {
      const item = buildAiGeneratedTableCatalogItem(
        {
          name: "AI Patio",
          tableType: "outdoor-table",
          capacity: 4,
          defaultScale: 1.1,
          generatedModelUrl: "https://cdn.example.com/ai-table.glb",
          generatedThumbnailUrl: "https://cdn.example.com/ai-table.webp",
          aiJobId: "job-123",
          aiProvider: "configured-provider",
          generationStatus: "completed",
          tags: "ai, patio",
          widthCm: 120,
        },
        { timestamp: 555 },
      );

      expect(item).toMatchObject({
        key: "custom-ai-ai-patio-555",
        source: "ai-generated",
        sourceType: "ai-generated",
        customModelKind: "ai-generated",
        fallbackKind: "model",
        modelUrl: "https://cdn.example.com/ai-table.glb",
        thumbnailUrl: "https://cdn.example.com/ai-table.webp",
        aiJobId: "job-123",
        aiProvider: "configured-provider",
        generationStatus: "completed",
      });
      expect(item.tags).toEqual(["ai", "patio"]);
      expect(item.dimensionsCm).toEqual({ width: 120 });
    });

    it("normalizes modal aliases and the backend-relative Hi3D GLB path", () => {
      const item = buildAiGeneratedTableCatalogItem(
        {
          name: "",
          tableType: "rect-4-seat",
          label: "Bàn Hi3D sân vườn",
          type: "outdoor-table",
          modelUrl: "/uploads/table-3d/models/generated.glb",
          thumbnailUrl: "https://cdn.hi3d.test/cover.webp",
          jobId: "hi3d-job-1",
          provider: "hi3d",
        },
        { timestamp: 777 },
      );

      expect(item).toMatchObject({
        key: "custom-ai-ban-hi3d-san-vuon-777",
        label: "Bàn Hi3D sân vườn",
        tableType: "outdoor-table",
        modelUrl: "http://localhost:4000/uploads/table-3d/models/generated.glb",
        thumbnailUrl: "https://cdn.hi3d.test/cover.webp",
        aiJobId: "hi3d-job-1",
        aiProvider: "hi3d",
      });
    });

    it("does not create a catalog item without a real generatedModelUrl", () => {
      expect(
        buildAiGeneratedTableCatalogItem({
          name: "Pending AI",
          aiJobId: "job-1",
        }),
      ).toBeNull();
    });
  });

  describe("mapCustomTableSpecToTableForm", () => {
    it("maps spec into table form payload", () => {
      expect(
        mapCustomTableSpecToTableForm({
          name: "Round rooftop",
          area: "outdoor",
          capacity: 3,
        }),
      ).toEqual({
        area: "outdoor",
        seats: 3,
        visualTemplate: "Round rooftop",
      });
    });
  });
});
