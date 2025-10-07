// src/utils/pricing.js
import mongoose from "mongoose";
import { MenuItem, ModifierGroup } from "../models/index.js";

// Hàm helper: lấy giá của preparation theo id (ưu tiên id) hoặc theo name
function getPreparationPrice(item, preparationId, preparationName) {
  if (!Array.isArray(item.preparationMethods)) return item.basePrice || 0;

  if (preparationId && mongoose.isValidObjectId(preparationId)) {
    const found = item.preparationMethods.find(
      (p) => String(p._id) === String(preparationId)
    );
    if (found) return found.price;
  }
  if (preparationName) {
    const found = item.preparationMethods.find(
      (p) => p.name?.toLowerCase() === preparationName.toLowerCase()
    );
    if (found) return found.price;
  }
  // fallback: default preparation or basePrice
  const def = item.preparationMethods.find((p) => p.isDefault);
  if (def) return def.price;
  return item.basePrice || 0;
}

/**
 * Tính subtotal cho 1 line (một món) dựa trên:
 * - item.byWeight: true => thành tiền = weightKg * prepPrice
 * - item.byWeight: false => thành tiền = quantity * prepPrice
 * - Cộng tổng priceDelta của các modifier options
 */
export async function computeLineSubtotal({
  menuItemDoc, // document MenuItem (đã load từ DB)
  preparationId, // ID của cách chế biến (khuyến nghị)
  preparationName, // hoặc name nếu bạn hiển thị theo name
  quantity = 1, // số phần
  weightKg = 0, // số kg (nếu byWeight)
  modifierOptionIds = [], // danh sách option đã chọn
}) {
  // 1) Giá theo cách chế biến
  const prepPrice = getPreparationPrice(
    menuItemDoc,
    preparationId,
    preparationName
  );

  // 2) Loading tất cả modifier groups của món
  let modifiersTotal = 0;
  if (menuItemDoc.modifierGroupIds?.length) {
    const groups = await ModifierGroup.find({
      _id: { $in: menuItemDoc.modifierGroupIds },
    }).lean();
    const optionIdSet = new Set(modifierOptionIds.map(String));

    // Duyệt tất cả options của tất cả group, cộng dồn những option đã chọn
    for (const g of groups) {
      for (const opt of g.options || []) {
        if (optionIdSet.has(String(opt._id))) {
          modifiersTotal += Number(opt.priceDelta || 0);
        }
      }
    }
  }

  // 3) Thành tiền lõi (unit * prepPrice)
  const unit = menuItemDoc.byWeight
    ? Number(weightKg || 0)
    : Number(quantity || 0);
  const coreAmount = unit * prepPrice;

  // 4) Áp dụng modifiers: cũng nhân theo “unit”
  const modifiersAmount = unit * modifiersTotal;

  const subtotal = coreAmount + modifiersAmount;
  return {
    unit,
    prepPrice,
    modifiersTotalPerUnit: modifiersTotal,
    subtotal,
  };
}
