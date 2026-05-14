import mongoose from "mongoose";
import { PayrollPeriod } from "../../../models/index.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function findPayrollPeriodOverlap({
  restaurantId,
  startDate,
  endDate,
  statuses = ["finalized", "locked", "paid"],
}) {
  const rid = toObjectId(restaurantId);
  if (!rid || !startDate || !endDate) return null;

  return PayrollPeriod.findOne({
    restaurantId: rid,
    status: { $in: statuses },
    startDate: { $lte: new Date(endDate) },
    endDate: { $gte: new Date(startDate) },
  })
    .sort({ startDate: -1 })
    .lean();
}

export async function assertNoLockedPayrollPeriodOverlap({
  restaurantId,
  employeeId,
  startDate,
  endDate,
  action = "update_source_data",
}) {
  const overlap = await findPayrollPeriodOverlap({
    restaurantId,
    employeeId,
    startDate,
    endDate,
    statuses: ["finalized", "locked", "paid"],
  });

  if (overlap) {
    if (action === "attendance") {
      throw new Error("Không thể chỉnh bảng công vì kỳ lương tương ứng đã chốt, khóa hoặc đã thanh toán.");
    }
    throw new Error("Không thể chỉnh dữ liệu hồi tố vì kỳ lương liên quan đã chốt, khóa hoặc đã thanh toán. Vui lòng tạo điều chỉnh ở kỳ lương tiếp theo.");
  }
}

export function assertPayrollPeriodEditable(period) {
  if (!period) throw new Error("Không tìm thấy kỳ lương.");
  if (String(period.status) !== "draft") {
    throw new Error("Không thể tính lại hoặc ghi đè dữ liệu vì kỳ lương đã được chốt.");
  }
}


export function assertPayrollPeriodCanMarkPaid(period) {
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  const status = String(period.status || "draft");
  if (status === "draft") throw new Error("PAYROLL_PERIOD_NOT_FINALIZED");
  if (status === "locked") throw new Error("PAYROLL_PERIOD_LOCKED");
  if (!["finalized", "paid"].includes(status)) {
    throw new Error("PAYROLL_PERIOD_NOT_PAYABLE");
  }
}

export function assertPayrollPeriodAllowsManualItemEdit(period) {
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (["paid", "locked"].includes(String(period.status || ""))) {
    throw new Error("PAYROLL_ITEM_EDIT_LOCKED");
  }
}
