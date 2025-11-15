// graphql/resolvers/order/helper/tableUtils.js
import { Table } from "../../../../models/index.js";
import { toId } from "./orderUtils.js";

/**
 * 🔹 Đánh dấu trạng thái bàn
 * @param {string} restaurantId
 * @param {string} tableCode
 * @param {string} status - "available" | "occupied" | "reserved" | "cleaning"
 */
export async function markTableStatus(restaurantId, tableCode, status) {
  if (!restaurantId || !tableCode) {
    console.warn("[TABLE] Missing restaurantId/tableCode when marking status");
    return;
  }

  try {
    const res = await Table.updateOne(
      { restaurantId: toId(restaurantId), code: tableCode },
      { $set: { status } }
    );

    if (res.matchedCount === 0) {
      console.warn(`[TABLE] No table found for code=${tableCode}`);
    } else {
      console.log(`[TABLE] ${tableCode} -> ${status}`);
    }
  } catch (err) {
    console.error(`[TABLE] Failed to update ${tableCode}:`, err.message);
  }
}

/**
 * 🔹 Lấy thông tin bàn (đơn giản)
 */
export async function getTable(restaurantId, tableCode) {
  try {
    const table = await Table.findOne(
      { restaurantId: toId(restaurantId), code: tableCode },
      { _id: 1, code: 1, name: 1, status: 1 }
    ).lean();
    return table || null;
  } catch (err) {
    console.error("[TABLE] getTable error:", err.message);
    return null;
  }
}

/**
 * ✅ resolveTableSafe
 * Đảm bảo bàn tồn tại — nếu chưa có thì tạo mới.
 *
 * @param {string} restaurantId
 * @param {string} tableCode
 * @param {object} [extra] - dữ liệu bổ sung (nếu muốn lưu thêm thông tin khi tạo)
 * @returns {Promise<{ _id, code, name, status } | null>}
 */
export async function resolveTableSafe(restaurantId, tableCode, extra = {}) {
  if (!restaurantId || !tableCode) return null;

  const rid = toId(restaurantId);
  const code = String(tableCode).trim().toUpperCase();

  try {
    let table = await Table.findOne(
      { restaurantId: rid, code },
      { _id: 1, code: 1, name: 1, status: 1 }
    ).lean();

    if (!table) {
      // nếu bàn chưa tồn tại → tạo mới
      const newTable = await Table.create({
        restaurantId: rid,
        code,
        name: extra.name || `Bàn ${code}`,
        status: extra.status || "available",
        ...extra,
      });
      console.log(`[TABLE] Auto-created table: ${code}`);
      table = {
        _id: newTable._id,
        code: newTable.code,
        name: newTable.name,
        status: newTable.status,
      };
    }

    return table;
  } catch (err) {
    console.error("[TABLE] resolveTableSafe error:", err.message);
    return null;
  }
}
