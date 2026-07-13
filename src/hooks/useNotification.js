import { useContext, useMemo } from "react";
import { NotificationContext } from "../context/NotificationContext";

export const toReadableNotificationMessage = (value, type) => {
  const text = String(value?.message || value || "").trim();
  if (type !== "error") return text;

  if (text.includes("StockItem not found") || text.includes("ingredients:")) {
    return "Một số nguyên liệu của món chưa được thiết lập trong kho. Vui lòng kiểm tra công thức hoặc chọn món khác.";
  }
  if (text.includes("DateTime cannot represent") || text.includes("invalid date-time")) {
    return "Ngày hoặc giờ chưa hợp lệ. Vui lòng chọn lại thời gian rồi thử lại.";
  }
  if (
    text.includes("Variable") ||
    text.includes("ValidationError") ||
    text.includes("GraphQL")
  ) {
    return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.";
  }
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "Kết nối đang gián đoạn. Vui lòng kiểm tra mạng và thử lại.";
  }
  return text || "Thao tác chưa hoàn tất. Vui lòng thử lại.";
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within <NotificationProvider />");
  }

  return useMemo(
    () => ({
      ...ctx,
      showNotification: (message, type, duration) =>
        ctx.showNotification(
          toReadableNotificationMessage(message, type),
          type,
          duration,
        ),
    }),
    [ctx],
  );
};
