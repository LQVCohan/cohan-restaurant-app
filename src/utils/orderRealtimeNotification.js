const ORDER_STATUS_LABELS = {
  draft: "Chờ thanh toán",
  pending: "Chờ xử lý",
  customer_attached: "Đã ghi nhận khách tại bàn",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng phục vụ",
  served: "Đã phục vụ",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  failed: "Không thành công",
};

const SILENT_ORDER_EVENT_TYPES = new Set([
  "TABLE_CUSTOMER_REQUEST_CREATED",
  "TABLE_PAYMENT_REQUESTED",
  "CUSTOMER_PAYMENT_REQUESTED",
  "CUSTOMER_STAFF_CALL_REQUESTED",
]);

const normalizeValue = (value) => String(value || "").trim();
const normalizeKey = (value) => normalizeValue(value).toLowerCase();

export function getOrderStatusLabel(status) {
  const key = normalizeKey(status);
  return ORDER_STATUS_LABELS[key] || "Đã cập nhật";
}

export function getRealtimeTableCode(evt) {
  return normalizeValue(evt?.order?.tableCode || evt?.tableCode);
}

export function getRealtimeOrderCode(evt) {
  return normalizeValue(evt?.order?.orderCode || evt?.orderCode);
}

function getOrderSubject(evt) {
  const tableCode = getRealtimeTableCode(evt);
  if (tableCode) {
    return {
      sentence: `Đơn tại bàn ${tableCode}`,
      object: `đơn tại bàn ${tableCode}`,
      location: `bàn ${tableCode}`,
    };
  }

  const orderCode = getRealtimeOrderCode(evt);
  if (orderCode) {
    return {
      sentence: `Đơn ${orderCode}`,
      object: `đơn ${orderCode}`,
      location: "",
    };
  }

  return {
    sentence: "Đơn hàng",
    object: "đơn hàng",
    location: "",
  };
}

function getStatusNotificationType(status) {
  const normalized = normalizeKey(status);
  if (["ready", "served", "completed"].includes(normalized)) return "success";
  if (["cancelled", "failed"].includes(normalized)) return "warning";
  return "info";
}

/**
 * Chuyển sự kiện socket kỹ thuật thành nội dung ngắn, rõ và hoàn toàn bằng tiếng Việt.
 * Trả về null cho các sự kiện đã có thông báo nghiệp vụ riêng để tránh hiển thị trùng.
 */
export function formatOrderRealtimeNotification(evt) {
  const eventType = normalizeValue(evt?.type).toUpperCase();
  if (!eventType || SILENT_ORDER_EVENT_TYPES.has(eventType)) return null;

  const subject = getOrderSubject(evt);
  const currentStatus =
    evt?.meta?.statusTo || evt?.order?.currentStatus || evt?.currentStatus;

  switch (eventType) {
    case "ORDER_CREATED":
      return {
        message: subject.location
          ? `Có đơn mới tại ${subject.location}.`
          : `Có ${subject.object} mới.`,
        type: "info",
      };

    case "PAYMENT_VERIFIED":
      return {
        message: `Đã xác nhận thanh toán cho ${subject.object}.`,
        type: "success",
      };

    case "ORDER_UPDATED":
      return {
        message: `${subject.sentence} vừa được cập nhật.`,
        type: "info",
      };

    case "ORDER_STATUS_CHANGED":
      return {
        message: `${subject.sentence} đã chuyển sang trạng thái “${getOrderStatusLabel(
          currentStatus,
        )}”.`,
        type: getStatusNotificationType(currentStatus),
      };

    case "ORDER_CANCELLED":
      return {
        message: `${subject.sentence} đã bị hủy.`,
        type: "warning",
      };

    case "TABLE_CUSTOMER_UPDATED": {
      const tableCode = getRealtimeTableCode(evt);
      return {
        message: tableCode
          ? `Thông tin khách tại bàn ${tableCode} vừa được cập nhật.`
          : "Thông tin khách tại bàn vừa được cập nhật.",
        type: "info",
      };
    }

    default:
      return {
        message: `${subject.sentence} vừa có cập nhật mới.`,
        type: "info",
      };
  }
}

export function formatCustomerRequestLocation(evt) {
  const tableCode = getRealtimeTableCode(evt);
  if (tableCode) return `Bàn ${tableCode}`;

  const trackingCode = normalizeValue(
    evt?.trackingCode || evt?.order?.trackingCode,
  );
  if (trackingCode) return `Khách ${trackingCode}`;

  return "Khách hàng";
}
