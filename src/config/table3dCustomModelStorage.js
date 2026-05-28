export const CUSTOM_TABLE_MODELS_STORAGE_KEY = "cohan.table3d.customModels.v1";

export const getCustomTableModelStorageKey = (scope = "default") =>
  `${CUSTOM_TABLE_MODELS_STORAGE_KEY}:${scope || "default"}`;

const canUseStorage = () =>
  typeof window !== "undefined" && !!window.localStorage;

export const normalizeStoredCustomModel = (item) => {
  if (!item?.key || !item?.customModelSpec) return null;

  const nowIso = new Date().toISOString();
  return {
    key: item.key,
    label: item.label || "Mẫu bàn tùy chỉnh",
    tableType: item.tableType || "custom-parametric",
    capacity: Number(item.capacity || item.customModelSpec?.capacity || 4),
    defaultScale: Number(item.defaultScale || 1),
    modelUrl: item.modelUrl || "",
    thumbnailUrl: item.thumbnailUrl || "",
    source: item.source || "user-generated",
    fallbackKind: item.fallbackKind || "parametric",
    customModelSpec: item.customModelSpec,
    createdAt: item.createdAt || nowIso,
    updatedAt: item.updatedAt || nowIso,
  };
};

export const loadCustomTableModels = (scope = "default") => {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(
      getCustomTableModelStorageKey(scope),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredCustomModel).filter(Boolean);
  } catch {
    return [];
  }
};

export const saveCustomTableModels = (models, scope = "default") => {
  if (!canUseStorage()) return [];

  const normalized = Array.isArray(models)
    ? models.map(normalizeStoredCustomModel).filter(Boolean)
    : [];

  const deduped = [];
  const indexByKey = new Map();
  normalized.forEach((item) => {
    const existedIndex = indexByKey.get(item.key);
    if (typeof existedIndex === "number") {
      deduped[existedIndex] = item;
      return;
    }
    indexByKey.set(item.key, deduped.length);
    deduped.push(item);
  });

  try {
    window.localStorage.setItem(
      getCustomTableModelStorageKey(scope),
      JSON.stringify(deduped),
    );
    return deduped;
  } catch {
    return deduped;
  }
};

export const upsertCustomTableModel = (model, scope = "default") => {
  const normalized = normalizeStoredCustomModel(model);
  if (!normalized) return loadCustomTableModels(scope);

  const current = loadCustomTableModels(scope);
  const foundIndex = current.findIndex((item) => item.key === normalized.key);

  if (foundIndex >= 0) {
    const existing = current[foundIndex];
    current[foundIndex] = {
      ...existing,
      ...normalized,
      createdAt: existing.createdAt || normalized.createdAt,
      updatedAt: new Date().toISOString(),
    };
    return saveCustomTableModels(current, scope);
  }

  return saveCustomTableModels(
    [{ ...normalized, updatedAt: new Date().toISOString() }, ...current],
    scope,
  );
};

export const deleteCustomTableModel = (key, scope = "default") => {
  const current = loadCustomTableModels(scope);
  const next = current.filter((item) => item.key !== key);
  return saveCustomTableModels(next, scope);
};

export const mergeCatalogWithCustomModels = (
  catalogModels = [],
  customModels = [],
) => {
  const catalog = Array.isArray(catalogModels) ? [...catalogModels] : [];
  const custom = Array.isArray(customModels) ? [...customModels] : [];
  const catalogKeys = new Set(catalog.map((item) => item?.key).filter(Boolean));

  const safeCustom = custom.filter(
    (item) => item && !catalogKeys.has(item.key),
  );
  return [...safeCustom, ...catalog];
};

export const getCustomModelCatalogTableType = (model) => {
  const shape = model?.customModelSpec?.shape;
  if (shape === "round") return "round-table";
  if (shape === "booth") return "booth-sofa";
  if (shape === "bar") return "bar-table";
  if (shape === "square") return "rect-4-seat";
  return "rect-4-seat";
};

export const doesCustomModelMatchTableType = (model, tableType) => {
  if (!isCustomTableModel(model)) return false;
  return getCustomModelCatalogTableType(model) === tableType;
};
export const isCustomTableModel = (item) =>
  item?.source === "user-generated" || !!item?.customModelSpec;
