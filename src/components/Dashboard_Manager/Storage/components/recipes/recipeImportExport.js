import {
  createWorkbookXlsx,
  createZip,
  dateStamp,
  downloadBlob,
  normalizeText,
  parseCSVLine,
  parseSpreadsheetMlXml,
  parseXlsxFirstSheet,
  toCSV,
} from "../ingredients/ingredientImportExport";

const RECIPE_HEADERS = [
  "menu_item_id",
  "ten_mon",
  "variant_key",
  "ten_variant",
  "mode",
  "sell_qty",
  "sell_unit",
  "gia_ban",
  "ingredient_id",
  "ten_nguyen_lieu",
  "qty",
  "unit",
  "waste_pct",
  "is_default",
  "ghi_chu",
];

const MODE_VALUES = ["PORTION", "BY_WEIGHT"];
const SELL_UNITS = ["portion", "g", "kg"];

function mapRowsToObjects(rows) {
  if (!rows?.length) return [];
  const header = rows[0].map((h) => normalizeText(h));
  const getIndex = (aliases) => {
    for (const alias of aliases) {
      const idx = header.findIndex((h) => h === normalizeText(alias));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idx = {
    menuItemId: getIndex(["menu_item_id", "menu item id", "id món", "menuItemId"]),
    name: getIndex(["ten_mon", "tên món", "name"]),
    variantKey: getIndex(["variant_key", "key biến thể", "variant key"]),
    variantName: getIndex(["ten_variant", "tên biến thể", "variant name"]),
    mode: getIndex(["mode", "kieu_ban", "kiểu bán"]),
    sellQty: getIndex(["sell_qty", "định lượng bán", "sell qty"]),
    sellUnit: getIndex(["sell_unit", "đơn vị bán", "sell unit"]),
    price: getIndex(["gia_ban", "giá bán", "price"]),
    ingredientId: getIndex(["ingredient_id", "id nguyên liệu", "ingredient id"]),
    ingredientName: getIndex(["ten_nguyen_lieu", "tên nguyên liệu", "ingredient name"]),
    qty: getIndex(["qty", "định lượng", "so_luong", "số lượng"]),
    unit: getIndex(["unit", "đơn vị"]),
    wastePct: getIndex(["waste_pct", "hao hụt", "waste pct"]),
    isDefault: getIndex(["is_default", "mặc định", "default"]),
    notes: getIndex(["ghi_chu", "ghi chú", "notes"]),
  };

  if (idx.menuItemId < 0 || idx.ingredientId < 0 || idx.qty < 0 || idx.unit < 0) {
    throw new Error("File thiếu cột bắt buộc: menu_item_id, ingredient_id, qty hoặc unit.");
  }

  return rows.slice(1).map((r, i) => ({
    rowNo: i + 2,
    menuItemId: r[idx.menuItemId] || "",
    name: idx.name >= 0 ? r[idx.name] || "" : "",
    variantKey: idx.variantKey >= 0 ? r[idx.variantKey] || "" : "",
    variantName: idx.variantName >= 0 ? r[idx.variantName] || "" : "",
    mode: idx.mode >= 0 ? r[idx.mode] || "" : "",
    sellQty: idx.sellQty >= 0 ? r[idx.sellQty] || "" : "",
    sellUnit: idx.sellUnit >= 0 ? r[idx.sellUnit] || "" : "",
    price: idx.price >= 0 ? r[idx.price] || "" : "",
    ingredientId: r[idx.ingredientId] || "",
    ingredientName: idx.ingredientName >= 0 ? r[idx.ingredientName] || "" : "",
    qty: r[idx.qty] || "",
    unit: r[idx.unit] || "",
    wastePct: idx.wastePct >= 0 ? r[idx.wastePct] || "" : "",
    isDefault: idx.isDefault >= 0 ? r[idx.isDefault] || "" : "",
    notes: idx.notes >= 0 ? r[idx.notes] || "" : "",
  }));
}

export async function parseRecipeImportFile(file) {
  const name = file?.name?.toLowerCase?.() || "";
  let rows = [];
  if (name.endsWith(".csv")) {
    const text = await file.text();
    rows = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map(parseCSVLine);
  } else if (name.endsWith(".xlsx")) {
    rows = parseXlsxFirstSheet(await file.arrayBuffer());
  } else if (name.endsWith(".xls")) {
    const text = await file.text();
    if (text.includes("<Workbook") && text.includes("<Row")) rows = parseSpreadsheetMlXml(text);
    else throw new Error("File .xls nhị phân chưa được hỗ trợ. Vui lòng lưu lại dưới dạng .xlsx hoặc .csv.");
  } else {
    throw new Error("Định dạng file không hợp lệ. Chỉ chấp nhận .xlsx, .xls, .csv");
  }
  return mapRowsToObjects(rows).filter((r) => Object.values(r).some((v) => String(v || "").trim()));
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value) {
  const s = normalizeText(value);
  return ["1", "true", "yes", "co", "có", "default"].includes(s);
}

export function buildRecipeImportPayloads(rows = [], existingRecipes = []) {
  const errors = [];
  const groups = new Map();
  const existingById = new Map((existingRecipes || []).map((r) => [String(r.id || r.menuItemId || ""), r]));

  rows.forEach((raw) => {
    const menuItemId = String(raw.menuItemId || "").trim();
    const ingredientId = String(raw.ingredientId || "").trim();
    const qty = toNumber(raw.qty, 0);
    const unit = String(raw.unit || "").trim();
    const mode = String(raw.mode || "PORTION").trim().toUpperCase();
    const sellUnit = String(raw.sellUnit || (mode === "BY_WEIGHT" ? "kg" : "portion")).trim();

    if (!menuItemId) errors.push({ ...raw, type: "VALIDATION", reason: "Thiếu menu_item_id" });
    if (!ingredientId) errors.push({ ...raw, type: "VALIDATION", reason: "Thiếu ingredient_id" });
    if (!(qty > 0)) errors.push({ ...raw, type: "VALIDATION", reason: "qty phải lớn hơn 0" });
    if (!unit) errors.push({ ...raw, type: "VALIDATION", reason: "Thiếu unit" });
    if (!MODE_VALUES.includes(mode)) errors.push({ ...raw, type: "VALIDATION", reason: "mode chỉ nhận PORTION/BY_WEIGHT" });
    if (!SELL_UNITS.includes(sellUnit)) errors.push({ ...raw, type: "VALIDATION", reason: "sell_unit chỉ nhận portion/g/kg" });
    if (errors.some((e) => e.rowNo === raw.rowNo)) return;

    if (!groups.has(menuItemId)) {
      groups.set(menuItemId, {
        menuItemId,
        name: raw.name || existingById.get(menuItemId)?.name || "",
        notes: raw.notes || existingById.get(menuItemId)?.notes || "",
        isActive: true,
        variants: new Map(),
      });
    }

    const group = groups.get(menuItemId);
    const variantKey = String(raw.variantKey || raw.variantName || "default").trim() || "default";
    if (!group.variants.has(variantKey)) {
      group.variants.set(variantKey, {
        key: variantKey,
        name: raw.variantName || (variantKey === "default" ? "Mặc định" : variantKey),
        mode,
        sellQty: mode === "PORTION" ? 1 : Math.max(0.001, toNumber(raw.sellQty, 1)),
        sellUnit: mode === "PORTION" ? "portion" : sellUnit,
        price: Math.max(0, toNumber(raw.price, 0)),
        isDefault: toBool(raw.isDefault),
        ingredients: [],
      });
    }

    group.variants.get(variantKey).ingredients.push({
      ingredientId,
      qty,
      unit,
      wastePct: Math.min(100, Math.max(0, toNumber(raw.wastePct, 0))),
    });
  });

  const payloads = Array.from(groups.values()).map((group) => {
    const servingVariants = Array.from(group.variants.values());
    if (servingVariants.length && !servingVariants.some((v) => v.isDefault)) {
      servingVariants[0].isDefault = true;
    }
    return {
      menuItemId: group.menuItemId,
      formData: {
        id: group.menuItemId,
        menuItemId: group.menuItemId,
        name: group.name,
        notes: group.notes,
        isActive: group.isActive,
        servingVariants,
      },
    };
  });

  return { payloads, errors };
}

export function downloadRecipeTemplate() {
  const example = [
    RECIPE_HEADERS,
    ["MENU_ITEM_ID_HERE", "Phở bò tái", "default", "Mặc định", "PORTION", "1", "portion", "65000", "INGREDIENT_ID_HERE", "Bánh phở", "180", "g", "0", "true", "Mẫu import"],
    ["MENU_ITEM_ID_HERE", "Phở bò tái", "default", "Mặc định", "PORTION", "1", "portion", "65000", "INGREDIENT_ID_HERE_2", "Thịt bò", "90", "g", "5", "false", ""],
  ];
  const guideRows = [
    ["HƯỚNG DẪN IMPORT CÔNG THỨC"],
    ["1) Cần có menu_item_id của món đã tồn tại trong menu."],
    ["2) Cần có ingredient_id của nguyên liệu đã tồn tại."],
    ["3) Nhiều dòng cùng menu_item_id + variant_key sẽ gom thành 1 biến thể."],
    ["4) mode hợp lệ: PORTION / BY_WEIGHT."],
    ["5) sell_unit hợp lệ: portion / g / kg."],
  ];
  const xlsx = createWorkbookXlsx([
    { name: "Du_lieu", rows: example },
    { name: "Huong_dan", rows: guideRows },
  ]);
  downloadBlob(new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `recipe-template-${dateStamp()}.xlsx`);
}

export function downloadRecipeImportErrors(errors = []) {
  const rows = [["dong", "menu_item_id", "ingredient_id", "loai_loi", "chi_tiet"], ...errors.map((e) => [e.rowNo, e.menuItemId || "", e.ingredientId || "", e.type || "VALIDATION", e.reason || ""] )];
  downloadBlob(new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" }), `recipe-import-errors-${dateStamp()}.csv`);
}

function recipeRowsForExport(recipes = []) {
  const rows = [];
  recipes.forEach((r) => {
    const variants = Array.isArray(r.servingVariants) ? r.servingVariants : [];
    if (!variants.length) {
      rows.push([r.id || r.menuItemId || "", r.name || "", "", "", "", "", "", "", "", "", "", "", "", "", r.notes || ""]);
      return;
    }
    variants.forEach((v) => {
      const lines = Array.isArray(v.ingredients) ? v.ingredients : Array.isArray(v.components) ? v.components : [];
      if (!lines.length) {
        rows.push([r.id || r.menuItemId || "", r.name || "", v.key || "", v.name || "", v.mode || "", v.sellQty || "", v.sellUnit || "", v.price || 0, "", "", "", "", "", v.isDefault ? "true" : "false", r.notes || ""]);
        return;
      }
      lines.forEach((line) => {
        rows.push([r.id || r.menuItemId || "", r.name || "", v.key || "", v.name || "", v.mode || "", v.sellQty || "", v.sellUnit || "", v.price || 0, line.ingredientId || "", line.name || "", line.qty ?? line.quantity ?? "", line.unit || "", line.wastePct || 0, v.isDefault ? "true" : "false", r.notes || ""]);
      });
    });
  });
  return rows;
}

export function exportRecipesFile({ recipes = [], format = "xlsx" }) {
  const rows = [RECIPE_HEADERS, ...recipeRowsForExport(recipes)];
  if (format === "csv") {
    downloadBlob(new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" }), `recipes-export-${dateStamp()}.csv`);
    return;
  }
  const bytes = createWorkbookXlsx([{ name: "Recipes", rows }]);
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `recipes-export-${dateStamp()}.xlsx`);
}

export function buildRecipeReportFiles({ recipes = [] }) {
  const rows = [RECIPE_HEADERS, ...recipeRowsForExport(recipes)];
  const summaryRows = [["ten_mon", "so_variant", "so_dong_nguyen_lieu", "co_cong_thuc"], ...recipes.map((r) => {
    const variants = Array.isArray(r.servingVariants) ? r.servingVariants : [];
    const totalLines = variants.reduce((sum, v) => sum + (Array.isArray(v.ingredients) ? v.ingredients.length : Array.isArray(v.components) ? v.components.length : 0), 0);
    return [r.name || "", variants.length, totalLines, variants.length ? "co" : "chua_co"];
  })];
  return [
    { name: "01-danh-sach-cong-thuc.xlsx", bytes: createWorkbookXlsx([{ name: "CongThuc", rows }]) },
    { name: "02-tong-quan-cong-thuc.xlsx", bytes: createWorkbookXlsx([{ name: "TongQuan", rows: summaryRows }]) },
  ];
}

export function downloadRecipeReportsZip(files) {
  const zip = createZip(files.map((f) => ({ name: f.name, data: f.bytes })));
  downloadBlob(new Blob([zip], { type: "application/zip" }), `recipe-reports-${dateStamp()}.zip`);
}
