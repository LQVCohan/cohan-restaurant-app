import { useContext } from "react";
import { usePOS as usePOSContext } from "../context/PosContext";

/**
 * usePOS() – Custom hook wrapper để dùng trong toàn dự án
 * -------------------------------------------------------
 * Giúp truy cập state POS (bàn, order, modal, tính tiền...) từ bất kỳ component nào.
 * Có thể bổ sung thêm helper như formatDate, formatTime, isTableBusy, ...
 */
export default function usePOS() {
  const ctx = usePOSContext();
  if (!ctx) {
    throw new Error("usePOS must be used within <PosProvider>");
  }

  // helper: xác định trạng thái bàn
  const isTableAvailable = (code) => {
    const t = Object.values(ctx.tables)
      .flat()
      .find((tb) => tb.code === code);
    return t?.status === "available";
  };

  const isTableOccupied = (code) => {
    const t = Object.values(ctx.tables)
      .flat()
      .find((tb) => tb.code === code);
    return t?.status === "occupied";
  };

  const isTableReserved = (code) => {
    const t = Object.values(ctx.tables)
      .flat()
      .find((tb) => tb.code === code);
    return t?.status === "reserved";
  };

  // helper: format thời gian
  const formatDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return {
    ...ctx,
    // helpers bổ sung
    isTableAvailable,
    isTableOccupied,
    isTableReserved,
    formatDateTime,
  };
}
