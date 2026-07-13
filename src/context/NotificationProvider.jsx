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
  if (TECHNICAL_ERROR_PATTERN.test(message)) {
    return toTechnicalErrorFallback(message);
  }
  TECHNICAL_COPY_REPLACEMENTS.forEach(([pattern, replacement]) => {
    message = message.replace(pattern, replacement);
  });
  return message.replace(/\s{2,}/g, " ").trim();
};

const toAlertMessage = (message) => {
  if (message == null) return ALERT_FALLBACK_MESSAGE;
  if (message instanceof Error) return toUserFacingCopy(message.message || ALERT_FALLBACK_MESSAGE);
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
        actionLabel: normalized.actionLabel ? toUserFacingCopy(normalized.actionLabel) : null,
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
    []
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
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
