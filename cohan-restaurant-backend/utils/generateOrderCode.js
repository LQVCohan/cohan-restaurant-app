// cohan-restaurant-backend/utils/generateOrderCode.js

/**
 * Chuẩn hoá prefix theo nguồn tạo đơn:
 * - "reservation" / "RES"  -> RES
 * - "pos"         / "POS"  -> POS
 * - "grab"        / "GRAB" -> GRAB
 * - "spfood"      / "SPFOOD" / "shopeefood" -> SPFOOD
 * - "ship"        / "SHIP"  / "delivery"    -> SHIP
 * - "web"         / "WEB"   -> WEB
 * - default (không truyền / lạ) -> POS
 */
const PREFIX_MAP = {
  RES: "RES",
  reservation: "RES",
  Reservation: "RES",

  POS: "POS",
  pos: "POS",

  GRAB: "GRAB",
  grab: "GRAB",

  SPFOOD: "SPFOOD",
  spfood: "SPFOOD",
  shopeefood: "SPFOOD",
  ShopeeFood: "SPFOOD",

  SHIP: "SHIP",
  ship: "SHIP",
  delivery: "SHIP",

  WEB: "WEB",
  web: "WEB",
};

function resolvePrefix(source) {
  if (!source) return "POS"; // default
  const key = String(source).trim();
  return PREFIX_MAP[key] || key.toUpperCase();
}

/**
 * Sinh orderCode theo format:
 *   Nếu có tableCode:
 *     <PREFIX>-YYYYMMDD-<TABLECODE>-XXXXXX
 *   Nếu không có tableCode:
 *     <PREFIX>-YYYYMMDD-XXXXXX
 *
 * Ví dụ:
 *   generateOrderCode("RES")                -> RES-20251115-F22DYA
 *   generateOrderCode("POS", null, "A1")   -> POS-20251115-A1-F22DYA
 *   generateOrderCode("GRAB")              -> GRAB-20251115-Z9X8QW
 *
 * @param {string} source     Nguồn tạo đơn: "RES" | "POS" | "GRAB" | "SPFOOD" | "SHIP" | "WEB" | ...
 * @param {Date}   date       (optional) ngày dùng để build code, mặc định là now
 * @param {string} tableCode  (optional) mã bàn, nếu có sẽ thêm vào ở giữa
 * @returns {string}          orderCode
 */
export function generateOrderCode(source, date = new Date(), tableCode = null) {
  const prefix = resolvePrefix(source);
  const d = date instanceof Date ? date : new Date(date);

  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");

  const rand = Math.random().toString(36).slice(2, 8).toUpperCase(); // 6 ký tự
  const dayPart = `${YYYY}${MM}${DD}`;

  const cleanTable =
    tableCode && String(tableCode).trim()
      ? String(tableCode).trim().toUpperCase()
      : null;

  // Nếu có tableCode -> PREFIX-YYYYMMDD-TABLE-RAND
  if (cleanTable) {
    return `${prefix}-${dayPart}-${cleanTable}-${rand}`;
  }

  // Không có tableCode -> PREFIX-YYYYMMDD-RAND
  return `${prefix}-${dayPart}-${rand}`;
}

export default generateOrderCode;
