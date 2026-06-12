import {
  createWorkbookXlsx,
  createZip,
  dateStamp,
  downloadBlob,
  normalizeSku,
  normalizeText,
  parseCSVLine,
  parseSpreadsheetMlXml,
  parseXlsxFirstSheet,
  toCSV,
} from "../ingredients/ingredientImportExport";

const SUPPLY_CATEGORIES = ["drink", "tissue", "clean", "sauce", "other"];
const SUPPLY_UNITS = ["unit", "piece", "pack", "bottle", "can"];
const STATUS_VALUES = ["active", "inactive"];
const SUPPLY_HEADERS = [
  "ten_vat_tu",
  "sku",
  "danh_muc",
  "don_vi",
  "gia_von",
  "gia_ban",
  "ton_toi_thieu",
  "ton_dau_ky",
  "trang_thai",
  "ghi_chu",
];

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
    name: getIndex(["ten_vat_tu", "tên vật tư", "name"]),
    sku: getIndex(["sku", "ma", "mã"]),
    category: getIndex(["danh_muc", "danh mục", "category"]),
    unit: getIndex(["don_vi", "đơn vị", "unit"]),
    cost: getIndex(["gia_von", "giá vốn", "cost"]),
    price: getIndex(["gia_ban", "giá bán", "price"]),
    minStock: getIndex(["ton_toi_thieu", "tồn tối thiểu", "min stock"]),
    openingStock: getIndex(["ton_dau_ky", "tồn đầu kỳ", "opening stock"]),
    status: getIndex(["trang_thai", "trạng thái", "status"]),
    notes: getIndex(["ghi_chu", "ghi chú", "notes"]),
  };

  if (idx.name < 0 || idx.unit < 0) {
    throw new Error("File thiếu cột bắt buộc: ten_vat_tu hoặc don_vi.");
  }

  return rows.slice(1).map((r, i) => ({
    rowNo: i + 2,
    name: r[idx.name] || "",
    sku: idx.sku >= 0 ? r[idx.sku] || "" : "",
    category: idx.category >= 0 ? r[idx.category] || "" : "",
    unit: idx.unit >= 0 ? r[idx.unit] || "" : "",
    costPerUnit: idx.cost >= 0 ? r[idx.cost] || "" : "",
    pricePerUnit: idx.price >= 0 ? r[idx.price] || "" : "",
    minStock: idx.minStock >= 0 ? r[idx.minStock] || "" : "",
    openingStock: idx.openingStock >= 0 ? r[idx.openingStock] || "" : "",
    status: idx.status >= 0 ? r[idx.status] || "" : "",
    notes: idx.notes >= 0 ? r[idx.notes] || "" : "",
  }));
}

export async function parseSupplyImportFile(file) {
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

export function validateAndNormalizeSupplyRow(raw) {
  const errors = [];
  const name = String(raw.name || "").trim();
  const category = normalizeText(raw.category || "other") || "other";
  const unit = normalizeText(raw.unit || "unit") || "unit";
  const status = normalizeText(raw.status || "active") || "active";
  const costPerUnit = Number(String(raw.costPerUnit ?? "").replace(/,/g, ""));
  const pricePerUnit = Number(String(raw.pricePerUnit ?? "").replace(/,/g, ""));
  const minStock = Number(String(raw.minStock ?? "").replace(/,/g, ""));
  const openingStock = Number(String(raw.openingStock ?? "").replace(/,/g, ""));
  const sku = String(raw.sku || "").trim();

  if (!name) errors.push("Thiếu tên vật tư");
  if (!SUPPLY_CATEGORIES.includes(category)) errors.push(`Danh mục không hợp lệ: ${raw.category}`);
  if (!SUPPLY_UNITS.includes(unit)) errors.push(`Đơn vị không hợp lệ: ${raw.unit}`);
  if (raw.status && !STATUS_VALUES.includes(status)) errors.push("Trạng thái chỉ nhận active/inactive");

  const normalized = {
    rowNo: raw.rowNo,
    name,
    nameKey: normalizeText(name),
    sku,
    skuKey: normalizeSku(sku),
    category,
    unit,
    costPerUnit: Number.isFinite(costPerUnit) ? costPerUnit : 0,
    pricePerUnit: Number.isFinite(pricePerUnit) ? pricePerUnit : 0,
    minStock: Number.isFinite(minStock) ? minStock : 0,
    openingStock: Number.isFinite(openingStock) ? openingStock : 0,
    isActive: status !== "inactive",
    notes: String(raw.notes || "").trim(),
  };

  if (normalized.costPerUnit < 0) errors.push("Giá vốn không được âm");
  if (normalized.pricePerUnit < 0) errors.push("Giá bán không được âm");
  if (normalized.minStock < 0) errors.push("Tồn tối thiểu không được âm");
  if (normalized.openingStock < 0) errors.push("Tồn đầu kỳ không được âm");

  return { normalized, errors };
}

export function downloadSupplyTemplate() {
  const example = [
    SUPPLY_HEADERS,
    ["Coca", "SUP-COCA-001", "drink", "can", "10000", "15000", "6", "24", "active", "Nước ngọt lon"],
    ["Khăn", "SUP-TISSUE-001", "tissue", "pack", "3000", "5000", "50", "100", "active", "Khăn giấy bàn"],
  ];
  const guideRows = [
    ["HƯỚNG DẪN IMPORT VẬT TƯ"],
    ["1) Chỉ dùng sheet 'Du_lieu' để import."],
    ["2) Danh mục hợp lệ: drink / tissue / clean / sauce / other."],
    ["3) Đơn vị hợp lệ: unit / piece / pack / bottle / can."],
    ["4) Có tồn đầu kỳ > 0: cần chọn 1 kho cụ thể trước khi import."],
    ["5) SKU ưu tiên nhận diện, thiếu SKU sẽ fallback theo tên."],
  ];
  const enumRows = [
    ["danh_muc_hop_le"],
    ...SUPPLY_CATEGORIES.map((c) => [c]),
    ["don_vi_hop_le"],
    ...SUPPLY_UNITS.map((u) => [u]),
    ["trang_thai_hop_le"],
    ...STATUS_VALUES.map((s) => [s]),
  ];

  const xlsx = createWorkbookXlsx([
    { name: "Du_lieu", rows: example },
    { name: "Huong_dan", rows: guideRows },
    { name: "Enum", rows: enumRows },
  ]);
  downloadBlob(new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `supply-template-${dateStamp()}.xlsx`);
}

export function downloadSupplyImportErrors(errors) {
  const rows = [["dong", "ten", "sku", "loai_loi", "chi_tiet"], ...errors.map((e) => [e.rowNo, e.name || "", e.sku || "", e.type || "VALIDATION", e.reason || ""] )];
  downloadBlob(new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" }), `supply-import-errors-${dateStamp()}.csv`);
}

function supplyRowsForExport(supplies = []) {
  return supplies.map((item) => {
    const stock = item.stockItem || {};
    return [
      item.name || "",
      item.sku || "",
      item.category || "",
      item.unit || "",
      Number(stock.onHand ?? 0),
      Number(stock.costPerUnit ?? item.costPerUnit ?? 0),
      Number(stock.pricePerUnit ?? item.pricePerUnit ?? 0),
      Number(item.minStock ?? 0),
      item.isActive === false ? "inactive" : "active",
      stock.note || item.notes || "",
    ];
  });
}

export function exportSuppliesFile({ supplies = [], format = "xlsx" }) {
  const rows = [["ten_vat_tu", "sku", "danh_muc", "don_vi", "ton_hien_tai", "gia_von", "gia_ban", "ton_toi_thieu", "trang_thai", "ghi_chu"], ...supplyRowsForExport(supplies)];
  if (format === "csv") {
    downloadBlob(new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" }), `supplies-export-${dateStamp()}.csv`);
    return;
  }
  const bytes = createWorkbookXlsx([{ name: "Supplies", rows }]);
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `supplies-export-${dateStamp()}.xlsx`);
}

export function buildSupplyReportFiles({ supplies = [] }) {
  const listRows = [["ten_vat_tu", "sku", "danh_muc", "don_vi", "ton_hien_tai", "gia_von", "gia_ban", "ton_toi_thieu", "trang_thai"], ...supplyRowsForExport(supplies).map((row) => row.slice(0, 9))];
  const lowRows = [["ten_vat_tu", "ton_hien_tai", "ton_toi_thieu", "trang_thai_ton"], ...supplies.map((item) => {
    const current = Number(item.stockItem?.onHand ?? 0);
    const min = Number(item.minStock ?? 0);
    const status = current <= 0 ? "het_hang" : current <= min ? "sap_het" : "con_hang";
    return [item.name || "", current, min, status];
  })];
  const valueRows = [["ten_vat_tu", "ton_hien_tai", "gia_von", "gia_tri_ton"], ...supplies.map((item) => {
    const stock = Number(item.stockItem?.onHand ?? 0);
    const cost = Number(item.stockItem?.costPerUnit ?? item.costPerUnit ?? 0);
    return [item.name || "", stock, cost, stock * cost];
  })];
  return [
    { name: "01-danh-sach-vat-tu.xlsx", bytes: createWorkbookXlsx([{ name: "DanhSach", rows: listRows }]) },
    { name: "02-canh-bao-vat-tu.xlsx", bytes: createWorkbookXlsx([{ name: "CanhBao", rows: lowRows }]) },
    { name: "03-gia-tri-ton-vat-tu.xlsx", bytes: createWorkbookXlsx([{ name: "GiaTriTon", rows: valueRows }]) },
  ];
}

export function downloadSupplyReportsZip(files) {
  const zip = createZip(files.map((f) => ({ name: f.name, data: f.bytes })));
  downloadBlob(new Blob([zip], { type: "application/zip" }), `supply-reports-${dateStamp()}.zip`);
}

export { SUPPLY_CATEGORIES, SUPPLY_UNITS };
