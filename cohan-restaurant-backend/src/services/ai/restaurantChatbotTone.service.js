import mongoose from "mongoose";
import {
  AiChatConversation,
  AiChatMessage,
  Order,
} from "../../../models/index.js";
import { handleRestaurantChatbotMessage as handleRoutingGuardRestaurantChatbotMessage } from "./restaurantChatbotRoutingGuard.service.js";

const ORDER_STATUS_COPY = {
  ORDER_RECEIVED: "Nhà hàng đã nhận đơn và đang bắt đầu xử lý",
  CONFIRMED: "Nhà hàng đã xác nhận đơn",
  PREPARING: "Bếp đang chuẩn bị món",
  PARTIALLY_READY: "Một số món trong đơn đã sẵn sàng",
  READY_TO_SERVE: "Đơn đã sẵn sàng để phục vụ",
  SERVED: "Đơn đã được phục vụ",
  WAITING_FOR_PAYMENT: "Đơn đang chờ thanh toán",
  PAID: "Đơn đã được thanh toán",
  CANCELLED: "Đơn đã bị hủy",
  ISSUE_REPORTED: "Nhà hàng đang kiểm tra vấn đề được báo cho đơn này",
  draft: "Đơn đang được tạo",
  pending: "Đơn đang chờ nhà hàng xác nhận",
  confirmed: "Nhà hàng đã xác nhận đơn",
  customer_attached: "Đơn đã được liên kết với tài khoản của bạn",
  preparing: "Bếp đang chuẩn bị món",
  ready: "Đơn đã sẵn sàng",
  served: "Đơn đã được phục vụ",
  completed: "Đơn đã hoàn tất",
  cancelled: "Đơn đã bị hủy",
  failed: "Đơn chưa thể xử lý thành công",
};

const PAYMENT_STATUS_COPY = {
  unpaid: "Đơn hiện chưa thanh toán",
  payment_requested: "Nhà hàng đang chờ bạn hoàn tất thanh toán",
  pending: "Thanh toán đang được xử lý",
  partial: "Đơn đã được thanh toán một phần",
  paid: "Đơn đã được thanh toán",
  failed: "Thanh toán chưa thành công",
  refunded: "Khoản thanh toán đã được hoàn lại",
  partially_refunded: "Một phần khoản thanh toán đã được hoàn lại",
};

const RESERVATION_STATUS_COPY = {
  pending: "đang chờ nhà hàng xác nhận",
  confirmed: "đã được nhà hàng xác nhận",
  accepted: "đã được nhà hàng tiếp nhận",
  seated: "đã được xếp bàn",
  completed: "đã hoàn tất",
  cancelled: "đã được hủy",
  rejected: "chưa được nhà hàng chấp nhận",
  no_show: "được ghi nhận là khách chưa đến",
};

const TECHNICAL_TOKEN_COPY = {
  ORDER_RECEIVED: "nhà hàng đã nhận đơn",
  CONFIRMED: "đã xác nhận",
  PREPARING: "đang chuẩn bị",
  PARTIALLY_READY: "một số món đã sẵn sàng",
  READY_TO_SERVE: "sẵn sàng phục vụ",
  SERVED: "đã phục vụ",
  WAITING_FOR_PAYMENT: "đang chờ thanh toán",
  PAID: "đã thanh toán",
  CANCELLED: "đã hủy",
  ISSUE_REPORTED: "đang được kiểm tra",
  OUT_OF_STOCK: "đã hết món",
  LOW_STOCK: "sắp hết món",
  IN_STOCK: "đang còn món",
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatCurrency = (value, currency = "VND") => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (String(currency || "VND").toUpperCase() === "USD") {
    return `$${amount.toFixed(2)}`;
  }
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const humanizeTechnicalTokens = (answer = "") => {
  let output = String(answer || "");
  const keys = Object.keys(TECHNICAL_TOKEN_COPY).sort(
    (left, right) => right.length - left.length,
  );
  for (const key of keys) {
    output = output.replace(
      new RegExp(`\\b${escapeRegex(key)}\\b`, "g"),
      TECHNICAL_TOKEN_COPY[key],
    );
  }
  return output;
};

const humanizeStatusPhrase = (answer = "", intent = "") => {
  if (intent !== "reservationHelp") return String(answer || "");
  return String(answer || "").replace(
    /hiện (?:đang )?ở trạng thái\s+([a-z_]+)/giu,
    (match, rawStatus) => {
      const copy = RESERVATION_STATUS_COPY[String(rawStatus || "").toLowerCase()];
      return copy ? `hiện ${copy}` : match;
    },
  );
};

const softenRigidPhrases = (answer = "") =>
  String(answer || "")
    .replace(/^Hiện mình chưa tìm thấy/iu, "Mình chưa tìm thấy")
    .replace(/^Hiện mình chưa thấy/iu, "Mình chưa thấy")
    .replace(/^Mình chỉ thấy/iu, "Mình tìm được")
    .replace(/^Bạn hãy/iu, "Bạn có thể")
    .replace(/\bBạn hãy\b/giu, "Bạn có thể")
    .replace(/Thanh toán:\s*Đơn hiện chưa thanh toán\.?/giu, "Đơn hiện chưa thanh toán.")
    .replace(/Thanh toán:\s*Đơn đã được thanh toán\.?/giu, "Đơn đã được thanh toán.")
    .replace(/Tổng tiền:\s*0(?:[.,]0+)?đ\.?/giu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

const hasFriendlyNextStep = (answer = "") =>
  /(?:bấm|chọn|mở|xem|thử|hỏi|liên hệ|theo dõi|tiếp tục).*(?:nhé|bên dưới|trong ứng dụng|trên app)/iu.test(
    String(answer || ""),
  );

const appendFriendlyNextStep = (answer = "", response = {}) => {
  const actions = Array.isArray(response?.actions) ? response.actions : [];
  if (!answer || !actions.length || hasFriendlyNextStep(answer)) return answer;
  if (answer.length > 700 || answer.includes("\n1.")) return answer;
  return `${answer}\nBạn có thể chọn nút bên dưới để tiếp tục nhé.`;
};

const polishAnswerTone = (answer = "", response = {}) => {
  let output = humanizeStatusPhrase(answer, response?.intent);
  output = humanizeTechnicalTokens(output);
  output = softenRigidPhrases(output);
  output = appendFriendlyNextStep(output, response);
  return output;
};

const buildFriendlyOrderAnswer = (order = {}) => {
  const code = String(order.orderCode || order.trackingCode || "gần nhất").trim();
  const statusKey = String(order.publicStatus || order.currentStatus || "pending");
  const statusCopy =
    ORDER_STATUS_COPY[statusKey] ||
    ORDER_STATUS_COPY[statusKey.toLowerCase()] ||
    "Đơn đang được nhà hàng xử lý";
  const paymentKey = String(
    order.orderPaymentStatus || order.payment?.status || "",
  ).toLowerCase();
  const paymentCopy = PAYMENT_STATUS_COPY[paymentKey] || "";
  const currency = order.payment?.currency || "VND";
  const total = formatCurrency(order.totals?.grandTotal, currency);
  const eta = formatDateTime(
    order.estimatedDeliveryAt || order.estimatedReadyAt,
  );

  const parts = [
    `Mình đã tìm thấy đơn ${code} của bạn.`,
    `${statusCopy}.`,
    paymentCopy ? `${paymentCopy}.` : "",
    total ? `Tổng tiền hiện tại là ${total}.` : "",
    eta ? `Thời gian dự kiến là ${eta}.` : "",
    "Bạn có thể bấm “Mở đơn hàng” bên dưới để xem chi tiết nhé.",
  ].filter(Boolean);

  return parts.join(" ").replace(/\.\./g, ".");
};

const extractOrderLookupCode = (message = "") => {
  const match = String(message || "").match(
    /\b(?:POS|ORD|ORDER|DH|TRACK)[-_A-Z0-9]{4,}\b/i,
  );
  return match?.[0] || "";
};

const latestOrderForUser = async (options = {}, response = {}) => {
  const userId = options?.user?.id || options?.user?._id;
  if (!userId || !mongoose.isValidObjectId(userId)) return null;

  const filter = { userId: new mongoose.Types.ObjectId(userId) };
  const restaurantId =
    response?.resolvedRestaurantId ||
    options?.restaurantId ||
    options?.pageContext?.restaurantId;
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    filter.restaurantId = new mongoose.Types.ObjectId(restaurantId);
  }
  const lookupCode = extractOrderLookupCode(options?.message);
  if (lookupCode) {
    filter.$or = [{ orderCode: lookupCode }, { trackingCode: lookupCode }];
  }

  return Order.findOne(filter).sort({ createdAt: -1 }).lean();
};

const persistPolishedResponse = async (response = {}) => {
  const updates = [];
  if (
    response.answerMessageId &&
    mongoose.isValidObjectId(response.answerMessageId)
  ) {
    updates.push(
      AiChatMessage.updateOne(
        { _id: response.answerMessageId },
        { $set: { content: String(response.answer || "") } },
      ),
    );
  }
  if (
    response.conversationId &&
    mongoose.isValidObjectId(response.conversationId)
  ) {
    updates.push(
      AiChatConversation.updateOne(
        { _id: response.conversationId },
        {
          $set: {
            lastMessagePreview: String(response.answer || "").slice(0, 300),
            lastMessageAt: new Date(),
          },
        },
      ),
    );
  }
  if (updates.length) await Promise.all(updates);
};

export async function handleRestaurantChatbotMessage(options = {}) {
  const response = await handleRoutingGuardRestaurantChatbotMessage(options);
  let answer = String(response?.answer || "");

  try {
    if (response?.intent === "orderHelp") {
      const order = await latestOrderForUser(options, response);
      if (order) answer = buildFriendlyOrderAnswer(order);
    }
  } catch (error) {
    console.warn("[ai-chatbot] friendly order wording skipped", {
      code: error?.code || "FRIENDLY_ORDER_WORDING_ERROR",
    });
  }

  answer = polishAnswerTone(answer, response);
  const polished = { ...response, answer };

  try {
    if (answer && answer !== response?.answer) {
      await persistPolishedResponse(polished);
    }
  } catch (error) {
    console.warn("[ai-chatbot] polished response persistence skipped", {
      code: error?.code || "TONE_PERSISTENCE_ERROR",
    });
  }

  return polished;
}

export const __testables = {
  ORDER_STATUS_COPY,
  PAYMENT_STATUS_COPY,
  RESERVATION_STATUS_COPY,
  formatCurrency,
  formatDateTime,
  humanizeTechnicalTokens,
  humanizeStatusPhrase,
  softenRigidPhrases,
  appendFriendlyNextStep,
  polishAnswerTone,
  buildFriendlyOrderAnswer,
  extractOrderLookupCode,
};
