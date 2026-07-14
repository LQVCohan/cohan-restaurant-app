import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotificationContext } from "./NotificationContext";

const ALERT_FALLBACK_MESSAGE = "Có thông báo mới từ hệ thống.";
const ALERT_SUCCESS_PATTERN =
  /(thành công|đã sao chép|đã lưu|đã cập nhật|đã gửi|hoàn tất|success)/i;
const ALERT_ERROR_PATTERN = /(lỗi|thất bại|không thể|failed|error)/i;
const ALERT_WARNING_PATTERN =
  /(vui lòng|cần\s|không hợp lệ|không tìm thấy|không có quyền)/i;

const USER_FACING_EVENT_CODE_LABELS = {
  ORDER_CREATED: "có đơn hàng mới",
  PAYMENT_VERIFIED: "thanh toán đã được xác nhận",
  ORDER_UPDATED: "đơn hàng đã được cập nhật",
  ORDER_STATUS_CHANGED: "trạng thái đơn hàng đã thay đổi",
  ORDER_CANCELLED: "đơn hàng đã bị hủy",
  ORDER_ITEM_UPDATED: "món trong đơn đã được cập nhật",
  ORDER_ITEM_STATUS_CHANGED: "trạng thái món đã thay đổi",
  TABLE_CUSTOMER_UPDATED: "thông tin khách tại bàn đã được cập nhật",
  TABLE_CUSTOMER_REQUEST_CREATED: "khách vừa gửi yêu cầu hỗ trợ",
  TABLE_PAYMENT_REQUESTED: "khách vừa yêu cầu thanh toán",
  CUSTOMER_PAYMENT_REQUESTED: "khách vừa yêu cầu thanh toán",
  CUSTOMER_STAFF_CALL_REQUESTED: "khách vừa yêu cầu nhân viên hỗ trợ",
  TABLE_QR_ORDER_ACCESS_REQUESTED: "có yêu cầu truy cập gọi món bằng mã QR",
  TABLE_QR_ORDER_ACCESS_CONFIRMED:
    "yêu cầu truy cập gọi món bằng mã QR đã được xác nhận",
  MENU_ITEM_OUT_OF_STOCK: "món đã hết hàng",
  MENU_ITEM_AVAILABLE_AGAIN: "món đã có thể bán lại",
};

const RAW_EVENT_CODE_PATTERN = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){1,}\b/g;
const REALTIME_EVENT_TOAST_PATTERN =
  /^\s*(?:realtime|cập nhật mới)\s*:\s*([A-Z][A-Z0-9_]+)(?:\s*\(([^)]+)\))?\s*[.!]?\s*$/i;

const buildRealtimeEventCopy = (message) => {
  const match = String(message || "").match(REALTIME_EVENT_TOAST_PATTERN);
  if (!match) return "";

  const eventCode = String(match[1] || "").toUpperCase();
  const tableCode = String(match[2] || "").trim();
  const orderSubject = tableCode ? `Đơn tại bàn ${tableCode}` : "Đơn hàng";

  switch (eventCode) {
    case "ORDER_CREATED":
      return tableCode ? `Có đơn mới tại bàn ${tableCode}.` : "Có đơn hàng mới.";
    case "PAYMENT_VERIFIED":
      return tableCode
        ? `Thanh toán của bàn ${tableCode} đã được xác nhận.`
        : "Thanh toán của đơn hàng đã được xác nhận.";
    case "ORDER_UPDATED":
      return `${orderSubject} vừa được cập nhật.`;
    case "ORDER_STATUS_CHANGED":
      return tableCode
        ? `Trạng thái đơn tại bàn ${tableCode} vừa thay đổi.`
        : "Trạng thái đơn hàng vừa thay đổi.";
    case "ORDER_CANCELLED":
      return `${orderSubject} đã bị hủy.`;
    case "ORDER_ITEM_UPDATED":
      return tableCode
        ? `Món trong đơn tại bàn ${tableCode} vừa được cập nhật.`
        : "Món trong đơn hàng vừa được cập nhật.";
    case "ORDER_ITEM_STATUS_CHANGED":
      return tableCode
        ? `Trạng thái món tại bàn ${tableCode} vừa thay đổi.`
        : "Trạng thái món trong đơn vừa thay đổi.";
    case "TABLE_CUSTOMER_UPDATED":
      return tableCode
        ? `Thông tin khách tại bàn ${tableCode} vừa được cập nhật.`
        : "Thông tin khách tại bàn vừa được cập nhật.";
    case "TABLE_CUSTOMER_REQUEST_CREATED":
    case "CUSTOMER_STAFF_CALL_REQUESTED":
      return tableCode
        ? `Bàn ${tableCode} vừa yêu cầu nhân viên hỗ trợ.`
        : "Khách hàng vừa yêu cầu nhân viên hỗ trợ.";
    case "TABLE_PAYMENT_REQUESTED":
    case "CUSTOMER_PAYMENT_REQUESTED":
      return tableCode
        ? `Bàn ${tableCode} vừa yêu cầu thanh toán.`
        : "Khách hàng vừa yêu cầu thanh toán.";
    case "TABLE_QR_ORDER_ACCESS_REQUESTED":
      return tableCode
        ? `Bàn ${tableCode} vừa yêu cầu truy cập gọi món bằng mã QR.`
        : "Có yêu cầu truy cập gọi món bằng mã QR.";
    case "TABLE_QR_ORDER_ACCESS_CONFIRMED":
      return tableCode
        ? `Đã xác nhận quyền gọi món bằng mã QR cho bàn ${tableCode}.`
        : "Yêu cầu truy cập gọi món bằng mã QR đã được xác nhận.";
    case "MENU_ITEM_OUT_OF_STOCK":
      return "Một món vừa được cập nhật là đã hết hàng.";
    case "MENU_ITEM_AVAILABLE_AGAIN":
      return "Một món vừa được mở bán trở lại.";
    default:
      return tableCode
        ? `Bàn ${tableCode} vừa có cập nhật mới.`
        : "Hệ thống vừa có cập nhật mới.";
  }
};

const TECHNICAL_COPY_REPLACEMENTS = [
  [/\bEmail\s*\/\s*SMS provider\b/gi, "dịch vụ gửi email/SMS"],
  [/\brestaurantId\b/gi, "nhà hàng"],
  [/\btableId\b/gi, "bàn"],
  [/\borderId\b/gi, "đơn hàng"],
  [/\buserId\b/gi, "tài khoản"],
  [/\bfront[-\s]?end\b/gi, "giao diện"],
  [/\bback[-\s]?end\b/gi, "hệ thống xử lý"],
  [/\bdatabase\b|\bdb\b|\bmongodb\b|\bmongo\b/gi, "dữ liệu"],
  [/\bgraphql\b|\bapi\b|\bendpoint\b|\bschema\b/gi, "kết nối hệ thống"],
  [/\baccess token\b|\brefresh token\b|\bjwt\b|\btoken\b/gi, "phiên đăng nhập"],
  [/\bnetwork\b/gi, "kết nối"],
  [/\bwebhook\b|\bcallback\b/gi, "xác nhận tự động"],
  [/\bserver\b/gi, "hệ thống"],
  [/\bpayload\b/gi, "dữ liệu gửi đi"],
  [/\bprovider\b/gi, "dịch vụ"],
  [/\bchunk\b|\bmodule\b/gi, "thành phần giao diện"],
  [/\brealtime\b/gi, "cập nhật mới"],
  [/\bonline\b/gi, "trực tuyến"],
  [/\bdev\b|\bdebug\b/gi, "kiểm tra"],
  [/\bvr\b/gi, "ảnh 360"],
  [/\bupload\b/gi, "tải lên"],
  [/\bimport\b/gi, "nhập file"],
  [/\bexport\b/gi, "xuất file"],
];

const TECHNICAL_ERROR_PATTERN =
  /(Variable\s+"\$|got invalid value|cannot represent|GraphQL|ApolloError|TypeError|ReferenceError|SyntaxError|ObjectId|ECONN(?:REFUSED|RESET)|\bat input\.[a-z]|\bextensions\.code\b|\bstatus code\s*\d{3}\b|\b[a-f0-9]{24}\b|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b)/i;
const DATE_TIME_ERROR_PATTERN =
  /(datetime|date-time|cannot represent.*date|invalid.*(?:startDate|endDate))/i;
const ORDER_CODE_PATTERN = /#?\b(?:ORD|POS|RSV)-[A-Z0-9-]+\b/i;

const toTechnicalErrorFallback = (message) => {
  const orderCode = message.match(ORDER_CODE_PATTERN)?.[0]?.replace(/^#/, "");
  const fallback = DATE_TIME_ERROR_PATTERN.test(message)
    ? "Thời gian đã chọn chưa hợp lệ. Vui lòng kiểm tra và thử lại."
    : "Thao tác chưa hoàn tất. Vui lòng kiểm tra thông tin và thử lại.";
  return orderCode ? `${fallback} Mã đơn: ${orderCode}.` : fallback;
};

export const toUserFacingCopy = (value) => {
  if (value == null) return value;
  let message = String(value);

  const realtimeEventCopy = buildRealtimeEventCopy(message);
  if (realtimeEventCopy) return realtimeEventCopy;

  if (TECHNICAL_ERROR_PATTERN.test(message)) {
    return toTechnicalErrorFallback(message);
  }

  message = message.replace(RAW_EVENT_CODE_PATTERN, (eventCode) => {
    return (
      USER_FACING_EVENT_CODE_LABELS[String(eventCode).toUpperCase()] ||
      "cập nhật hệ thống"
    );
  });

  TECHNICAL_COPY_REPLACEMENTS.forEach(([pattern, replacement]) => {
    message = message.replace(pattern, replacement);
  });
  return message.replace(/\s{2,}/g, " ").trim();
};

const toAlertMessage = (message) => {
  if (message == null) return ALERT_FALLBACK_MESSAGE;
  if (message instanceof Error)
    return toUserFacingCopy(message.message || ALERT_FALLBACK_MESSAGE);
  return toUserFacingCopy(String(message) || ALERT_FALLBACK_MESSAGE);
};

const getAlertNotificationType = (message) => {
  if (ALERT_SUCCESS_PATTERN.test(message)) return "success";
  if (ALERT_ERROR_PATTERN.test(message)) return "error";
  if (ALERT_WARNING_PATTERN.test(message)) return "warning";
  return "info";
};

/**
 * UI-only toast/local notification provider.
 *
 * This provider intentionally stores short-lived interface feedback in React state.
 * It is not the persistent notification workflow used by NotificationBell.
 */
const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timeoutRefs = useRef({});

  const showNotification = useCallback(
    (message, type = "info", duration = 4000) => {
      if (!message) return;
      const id = Date.now() + Math.random();
      const normalized =
        typeof message === "object"
          ? message
          : { message, actionLabel: null, onAction: null };
      const n = {
        id,
        message: toUserFacingCopy(normalized.message),
        type,
        actionLabel: normalized.actionLabel
          ? toUserFacingCopy(normalized.actionLabel)
          : null,
        onAction:
          typeof normalized.onAction === "function" ? normalized.onAction : null,
      };
      setNotifications((prev) => [...prev, n]);

      const t = setTimeout(() => {
        setNotifications((prev) => prev.filter((x) => x.id !== id));
        delete timeoutRefs.current[id];
      }, duration);
      timeoutRefs.current[id] = t;
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const nativeAlert = window.alert;
    const notifyAlert = (message) => {
      const rawMessage =
        message instanceof Error
          ? message.message || ALERT_FALLBACK_MESSAGE
          : String(message || ALERT_FALLBACK_MESSAGE);
      const alertMessage = toAlertMessage(message);
      const type = TECHNICAL_ERROR_PATTERN.test(rawMessage)
        ? "error"
        : getAlertNotificationType(rawMessage);
      showNotification(alertMessage, type);
    };

    window.alert = notifyAlert;

    return () => {
      if (window.alert === notifyAlert) {
        window.alert = nativeAlert;
      }
    };
  }, [showNotification]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const clearAll = useCallback(() => {
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};
    setNotifications([]);
  }, []);

  const triggerNotificationAction = useCallback((id) => {
    let action = null;
    setNotifications((prev) => {
      const row = prev.find((x) => x.id === id);
      action = row?.onAction || null;
      return prev.filter((x) => x.id !== id);
    });
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
    if (typeof action === "function") action();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {};
    };
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      showNotification,
      removeNotification,
      clearAll,
      triggerNotificationAction,
    }),
    [
      notifications,
      showNotification,
      removeNotification,
      clearAll,
      triggerNotificationAction,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
