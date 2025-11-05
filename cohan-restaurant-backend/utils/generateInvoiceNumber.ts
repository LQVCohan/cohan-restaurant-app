// src/utils/generateInvoiceNumber.ts
import dayjs from "dayjs";

export async function generateInvoiceNumber(
  InvoiceModel: any,
  session?: any
): Promise<string> {
  const yymm = dayjs().format("YYMM");
  const prefix = `INV-${yymm}-`;
  // Tìm hoá đơn gần nhất cùng prefix để tăng số thứ tự
  const latest =
    (await InvoiceModel.findOne({ number: new RegExp(`^${prefix}`) })
      .sort({ number: -1 })
      .session?.(session)) ??
    (await InvoiceModel.findOne({ number: new RegExp(`^${prefix}`) }).sort({
      number: -1,
    }));

  const next = latest?.number
    ? parseInt(String(latest.number).split("-").pop()!, 10) + 1
    : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
