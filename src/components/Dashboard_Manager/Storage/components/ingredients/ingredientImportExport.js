const INGREDIENT_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "piece",
  "tbsp",
  "tsp",
  "pack",
  "bottle",
  "can",
];

const STATUS_VALUES = ["active", "inactive"];

const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const xmlEscape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeSku = (value) => normalizeText(value);

const CSV_HEADERS = [
  "ten_nguyen_lieu",
  "sku",
  "ten_danh_muc",
  "don_vi_goc",
  "gia_von",
  "ton_toi_thieu",
  "ton_dau_ky",
  "trang_thai",
  "ghi_chu",
];

function parseCSVLine(line = "") {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? "");
          if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
          return str;
        })
        .join(",")
    )
    .join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// --- Tiny ZIP (store/no compression) ---
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1);
  return c >>> 0;
});

function crc32(uint8) {
  let c = 0xffffffff;
  for (let i = 0; i < uint8.length; i += 1) c = CRC_TABLE[(c ^ uint8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = textEncoder.encode(name);
    const body = data instanceof Uint8Array ? data : textEncoder.encode(String(data));
    const crc = crc32(body);

    const local = new Uint8Array(30 + nameBytes.length + body.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(14, crc & 0xffff, true);
    dv.setUint16(16, crc >>> 16, true);
    dv.setUint32(18, body.length, true);
    dv.setUint32(22, body.length, true);
    dv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(body, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(central.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, body.length, true);
    cdv.setUint32(24, body.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(offset + centralSize + 22);
  let ptr = 0;
  localParts.forEach((p) => {
    out.set(p, ptr);
    ptr += p.length;
  });
  const centralOffset = ptr;
  centralParts.forEach((p) => {
    out.set(p, ptr);
    ptr += p.length;
  });

  const ed = new DataView(out.buffer, ptr, 22);
  ed.setUint32(0, 0x06054b50, true);
  ed.setUint16(8, files.length, true);
  ed.setUint16(10, files.length, true);
  ed.setUint32(12, centralSize, true);
  ed.setUint32(16, centralOffset, true);
  return out;
}

function extractZipEntries(uint8) {
  const entries = new Map();
  let ptr = 0;
  while (ptr + 30 <= uint8.length) {
    const dv = new DataView(uint8.buffer, ptr);
    if (dv.getUint32(0, true) !== 0x04034b50) break;
    const method = dv.getUint16(8, true);
    const compSize = dv.getUint32(18, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    const nameStart = ptr + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = textDecoder.decode(uint8.slice(nameStart, nameStart + nameLen));
    const raw = uint8.slice(dataStart, dataStart + compSize);
    if (method !== 0) throw new Error("File XLSX đang dùng nén không hỗ trợ trong trình nhập nhẹ.");
    entries.set(name, raw);
    ptr = dataStart + compSize;
  }
  return entries;
}

function colToName(col) {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function createWorksheetXml(rows) {
  const rowXml = rows
    .map((row, rIdx) => {
      const cells = row
        .map((cell, cIdx) => {
          if (cell === null || cell === undefined || cell === "") return null;
          const ref = `${colToName(cIdx)}${rIdx + 1}`;
          const n = Number(cell);
          if (Number.isFinite(n) && String(cell).trim() === String(n)) {
            return `<c r="${ref}"><v>${n}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
        })
        .filter(Boolean)
        .join("");
      return `<row r="${rIdx + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createWorkbookXlsx(sheets) {
  const files = [];
  files.push({
    name: "[Content_Types].xml",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets
  .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
  .join("\n")}
</Types>`,
  });

  files.push({
    name: "_rels/.rels",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  });

  files.push({
    name: "xl/workbook.xml",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets
  .map((sheet, i) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
  .join("")}</sheets>
</workbook>`,
  });

  files.push({
    name: "xl/_rels/workbook.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
  .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
  .join("\n")}
</Relationships>`,
  });

  sheets.forEach((sheet, i) => {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: createWorksheetXml(sheet.rows),
    });
  });

  return createZip(files);
}

function parseXlsxFirstSheet(arrayBuffer) {
  const entries = extractZipEntries(new Uint8Array(arrayBuffer));
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("Không đọc được sheet đầu tiên trong file XLSX.");
  const parser = new DOMParser();
  const xml = parser.parseFromString(textDecoder.decode(sheet), "application/xml");
  const rows = Array.from(xml.getElementsByTagName("row")).map((row) => {
    const cells = Array.from(row.getElementsByTagName("c"));
    return cells.map((cell) => {
      const t = cell.getAttribute("t");
      if (t === "inlineStr") return cell.textContent?.trim() || "";
      const v = cell.getElementsByTagName("v")[0]?.textContent;
      return v?.trim() || "";
    });
  });
  return rows;
}

function parseSpreadsheetMlXml(text) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const rows = Array.from(xml.getElementsByTagName("Row")).map((row) =>
    Array.from(row.getElementsByTagName("Cell")).map(
      (cell) => cell.getElementsByTagName("Data")[0]?.textContent?.trim() || ""
    )
  );
  return rows;
}

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
    name: getIndex(["ten_nguyen_lieu", "tên nguyên liệu", "name"]),
    sku: getIndex(["sku", "ma", "mã"]),
    category: getIndex(["ten_danh_muc", "tên danh mục", "danh mục"]),
    unit: getIndex(["don_vi_goc", "đơn vị gốc", "base unit"]),
    cost: getIndex(["gia_von", "giá vốn"]),
    minStock: getIndex(["ton_toi_thieu", "tồn tối thiểu"]),
    openingStock: getIndex(["ton_dau_ky", "tồn đầu kỳ"]),
    status: getIndex(["trang_thai", "trạng thái"]),
    notes: getIndex(["ghi_chu", "ghi chú", "notes"]),
  };

  if (idx.name < 0 || idx.unit < 0) {
    throw new Error("File thiếu cột bắt buộc: ten_nguyen_lieu hoặc don_vi_goc.");
  }

  return rows.slice(1).map((r, i) => ({
    rowNo: i + 2,
    name: r[idx.name] || "",
    sku: idx.sku >= 0 ? r[idx.sku] || "" : "",
    categoryName: idx.category >= 0 ? r[idx.category] || "" : "",
    baseUnit: idx.unit >= 0 ? r[idx.unit] || "" : "",
    costPerBaseUnit: idx.cost >= 0 ? r[idx.cost] || "" : "",
    minStock: idx.minStock >= 0 ? r[idx.minStock] || "" : "",
    openingStock: idx.openingStock >= 0 ? r[idx.openingStock] || "" : "",
    status: idx.status >= 0 ? r[idx.status] || "" : "",
    notes: idx.notes >= 0 ? r[idx.notes] || "" : "",
  }));
}

export async function parseIngredientImportFile(file) {
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
    if (text.includes("<Workbook") && text.includes("<Row")) {
      rows = parseSpreadsheetMlXml(text);
    } else {
      throw new Error("File .xls nhị phân chưa được hỗ trợ. Vui lòng lưu lại dưới dạng .xlsx hoặc .csv.");
    }
  } else {
    throw new Error("Định dạng file không hợp lệ. Chỉ chấp nhận .xlsx, .xls, .csv");
  }
  return mapRowsToObjects(rows).filter((r) => Object.values(r).some((v) => String(v || "").trim()));
}

export function validateAndNormalizeImportRow(raw) {
  const errors = [];
  const name = String(raw.name || "").trim();
  const baseUnit = normalizeText(raw.baseUnit);
  const sku = String(raw.sku || "").trim();
  const status = normalizeText(raw.status || "active") || "active";

  const costPerBaseUnit = Number(String(raw.costPerBaseUnit ?? "").replace(/,/g, ""));
  const minStock = Number(String(raw.minStock ?? "").replace(/,/g, ""));
  const openingStock = Number(String(raw.openingStock ?? "").replace(/,/g, ""));

  if (!name) errors.push("Thiếu tên nguyên liệu");
  if (!INGREDIENT_UNITS.includes(baseUnit)) errors.push(`Đơn vị không hợp lệ: ${raw.baseUnit}`);
  if (raw.status && !STATUS_VALUES.includes(status)) errors.push("Trạng thái chỉ nhận active/inactive");

  const normalized = {
    rowNo: raw.rowNo,
    name,
    nameKey: normalizeText(name),
    sku,
    skuKey: normalizeSku(sku),
    categoryName: String(raw.categoryName || "").trim(),
    categoryKey: normalizeText(raw.categoryName || ""),
    baseUnit,
    costPerBaseUnit: Number.isFinite(costPerBaseUnit) ? costPerBaseUnit : 0,
    minStock: Number.isFinite(minStock) ? minStock : 0,
    openingStock: Number.isFinite(openingStock) ? openingStock : 0,
    isActive: status !== "inactive",
    notes: String(raw.notes || "").trim(),
  };

  if (normalized.minStock < 0) errors.push("Tồn tối thiểu không được âm");
  if (normalized.openingStock < 0) errors.push("Tồn đầu kỳ không được âm");
  if (normalized.costPerBaseUnit < 0) errors.push("Giá vốn không được âm");
  if (normalized.openingStock > 0 && normalized.costPerBaseUnit <= 0) {
    errors.push("Có tồn đầu kỳ thì giá vốn phải > 0");
  }

  return { normalized, errors };
}

export function downloadIngredientTemplate() {
  const example = [
    CSV_HEADERS,
    ["Thịt bò Mỹ", "ING-BEEF-001", "Thịt", "kg", "235000", "10", "20", "active", "Nhập mẫu"],
    ["Rau xà lách", "", "Rau", "kg", "28000", "5", "", "active", "Không có tồn đầu kỳ"],
  ];

  const guideRows = [
    ["HƯỚNG DẪN IMPORT NGUYÊN LIỆU"],
    ["1) Chỉ dùng sheet 'Du_lieu' để import."],
    ["2) Trạng thái hợp lệ: active / inactive."],
    ["3) Đơn vị hợp lệ xem sheet 'Enum'."],
    ["4) Có tồn đầu kỳ > 0: bắt buộc chọn 1 kho cụ thể và giá vốn > 0."],
    ["5) SKU ưu tiên nhận diện, nếu thiếu SKU sẽ fallback theo tên normalize."],
    ["6) Conflict SKU/tên khác bản ghi sẽ bị bỏ qua và ghi file lỗi."],
    ["7) Dòng lỗi không làm fail toàn bộ file."],
    ["8) Không import ảnh từ file Excel."],
  ];

  const enumRows = [["don_vi_hop_le"], ...INGREDIENT_UNITS.map((u) => [u]), ["trang_thai_hop_le"], ...STATUS_VALUES.map((s) => [s])];

  const xlsx = createWorkbookXlsx([
    { name: "Du_lieu", rows: example },
    { name: "Huong_dan", rows: guideRows },
    { name: "Enum", rows: enumRows },
  ]);

  downloadBlob(
    new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `ingredient-template-${dateStamp()}.xlsx`
  );
}

export function downloadImportErrors(errors) {
  const rows = [["dong", "ten", "sku", "loai_loi", "chi_tiet"], ...errors.map((e) => [e.rowNo, e.name || "", e.sku || "", e.type || "VALIDATION", e.reason || ""])];
  const csv = toCSV(rows);
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), `ingredient-import-errors-${dateStamp()}.csv`);
}

function ingredientRowsForExport(ingredients, warehouseLabel = "") {
  return ingredients.map((ing) => [
    ing.name,
    ing.sku || "",
    ing.category || "",
    ing.baseUnit,
    Number(ing.availableStock || 0),
    Number(ing.costPerBaseUnit || 0),
    Number(ing.minStock || 0),
    ing.isActive ? "active" : "inactive",
    warehouseLabel,
    ing.notes || "",
  ]);
}

export function exportIngredientsFile({ ingredients, format = "xlsx", warehouseLabel = "" }) {
  const rows = [
    ["ten_nguyen_lieu", "sku", "danh_muc", "don_vi_goc", "ton_hien_tai", "gia_von_hien_tai", "ton_toi_thieu", "trang_thai", "ngu_canh_kho", "ghi_chu"],
    ...ingredientRowsForExport(ingredients, warehouseLabel),
  ];

  if (format === "csv") {
    downloadBlob(new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8;" }), `ingredients-export-${dateStamp()}.csv`);
    return;
  }

  const bytes = createWorkbookXlsx([{ name: "Ingredients", rows }]);
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `ingredients-export-${dateStamp()}.xlsx`);
}

export function buildIngredientReportFiles({ ingredients, movements, fromDate, toDate, warehouseLabel = "" }) {
  const listRows = [
    ["ten_nguyen_lieu", "sku", "danh_muc", "don_vi", "ton_hien_tai", "gia_von", "trang_thai", "kho"],
    ...ingredients.map((i) => [i.name, i.sku || "", i.category || "", i.baseUnit, Number(i.availableStock || 0), Number(i.costPerBaseUnit || 0), i.isActive ? "active" : "inactive", warehouseLabel]),
  ];

  const stockRows = [
    ["ten_nguyen_lieu", "ton_hien_tai", "ton_toi_thieu", "trang_thai_ton"],
    ...ingredients.map((i) => {
      const current = Number(i.availableStock || 0);
      const min = Number(i.minStock || 0);
      const status = current <= 0 ? "het_hang" : current <= min ? "sap_het" : "con_hang";
      return [i.name, current, min, status];
    }),
  ];

  const byIngredient = new Map();
  ingredients.forEach((i) => {
    byIngredient.set(String(i.id), { name: i.name, inbound: 0, outbound: 0, adjustment: 0, closing: Number(i.availableStock || 0), unit: i.baseUnit });
  });

  movements.forEach((m) => {
    const key = String(m.ingredientId || "");
    if (!byIngredient.has(key)) return;
    const row = byIngredient.get(key);
    const qty = Number(m.qty || 0);
    if (m.type === "inbound") row.inbound += qty;
    else if (m.type === "outbound") row.outbound += qty;
    else row.adjustment += qty;
  });

  const ioRows = [
    ["tu_ngay", fromDate, "den_ngay", toDate],
    ["ten_nguyen_lieu", "don_vi", "nhap", "xuat", "dieu_chinh", "ton_hien_tai"],
    ...Array.from(byIngredient.values()).map((v) => [v.name, v.unit, v.inbound, v.outbound, v.adjustment, v.closing]),
  ];

  const costRows = [
    ["ten_nguyen_lieu", "gia_von_hien_tai", "ton_hien_tai", "gia_tri_ton", "ghi_chu"],
    ...ingredients.map((i) => {
      const cost = Number(i.costPerBaseUnit || 0);
      const stock = Number(i.availableStock || 0);
      return [i.name, cost, stock, cost * stock, "Biến động giá vốn: chưa đủ dữ liệu lịch sử chi tiết để tính chuẩn."];
    }),
  ];

  return [
    { name: "01-danh-sach-nguyen-lieu.xlsx", bytes: createWorkbookXlsx([{ name: "DanhSach", rows: listRows }]) },
    { name: "02-ton-kho-nguyen-lieu.xlsx", bytes: createWorkbookXlsx([{ name: "TonKho", rows: stockRows }]) },
    { name: "03-nhap-xuat-ton.xlsx", bytes: createWorkbookXlsx([{ name: "NXT", rows: ioRows }]) },
    { name: "04-gia-von-nguyen-lieu.xlsx", bytes: createWorkbookXlsx([{ name: "GiaVon", rows: costRows }]) },
  ];
}

export function downloadReportsZip(files) {
  const zip = createZip(files.map((f) => ({ name: f.name, data: f.bytes })));
  downloadBlob(new Blob([zip], { type: "application/zip" }), `ingredient-reports-${dateStamp()}.zip`);
}

export { INGREDIENT_UNITS, STATUS_VALUES, normalizeText, normalizeSku };
