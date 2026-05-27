import { mapTable3DTypeToArea } from "@/config/table3dCatalog";

export const buildPreviewModelItemFromVisualConfig = (visualConfig) => {
  const config = visualConfig && typeof visualConfig === "object" ? visualConfig : {};
  const modelKey = config.modelKey || "saved-model";
  const modelLabel = config.modelLabel || config.label || "Mẫu bàn đã lưu";

  return {
    key: modelKey,
    label: modelLabel,
    tableType: config.tableType || null,
    capacity: Number.isFinite(Number(config.capacity)) ? Number(config.capacity) : 4,
    customModelSpec: config.dimensions
      ? {
          name: modelLabel,
          capacity: Number.isFinite(Number(config.capacity)) ? Number(config.capacity) : 4,
          widthCm: Number(config.dimensions.widthCm) || 0,
          depthCm: Number(config.dimensions.depthCm) || 0,
          heightCm: Number(config.dimensions.heightCm) || 0,
          area: config.tableArea || mapTable3DTypeToArea(config.tableType),
          shape: config.shape || "rect",
        }
      : null,
  };
};

export const formatVisualConfigSavedAt = (savedAt) => {
  if (!savedAt) return "Không rõ thời gian lưu";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian lưu";
  return date.toLocaleString("vi-VN");
};
