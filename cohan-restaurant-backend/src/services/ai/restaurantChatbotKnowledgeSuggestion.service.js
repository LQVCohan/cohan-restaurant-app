import mongoose from "mongoose";
import {
  AiChatbotKnowledgeSuggestion,
  Coupon,
  MenuItem,
  Restaurant,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  requireAnyRestaurantPermission,
  requireRestaurantPermission,
} from "../auth/authorization.service.js";
import { createRestaurantAiChatbotKnowledgeItem } from "./restaurantChatbotKnowledge.service.js";

const MAX_QUESTION = 500;
const MAX_TITLE = 160;
const MAX_CONTENT = 3000;
const MAX_CATEGORY = 80;
const MAX_TAG = 40;
const MAX_TAGS = 10;
const MIN_QUESTION_LEN = 6;
const TRIGGER_TYPES = new Set([
  "fallback",
  "low_confidence",
  "handoff",
  "no_knowledge_match",
]);
const STATUSES = new Set(["pending", "approved", "dismissed"]);
const AUTO_SOURCES = new Set([
  "restaurant_info",
  "opening_hours",
  "booking",
  "menu",
  "payment",
  "promotions",
  "delivery_pickup",
]);
const DEFAULT_AUTO_SOURCES = [...AUTO_SOURCES];

const clean = (v, max) =>
  String(v || "")
    .trim()
    .slice(0, max);
const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
const normalizeQuestion = (q) =>
  clean(q, MAX_QUESTION)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[!?.,;:]+/g, "")
    .trim();
const isSensitiveQuestion = (q) =>
  /\b\d{9,16}\b|@|\b(?:cccd|cmnd|visa|mastercard|otp|password|mật khẩu)\b/i.test(
    q,
  );
const toTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map((t) => clean(t, MAX_TAG))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
const toDto = (row) => ({
  ...row,
  id: String(row?._id || row?.id || ""),
  restaurantId: row?.restaurantId ? String(row.restaurantId) : "",
  approvedKnowledgeItemId: row?.approvedKnowledgeItemId
    ? String(row.approvedKnowledgeItemId)
    : null,
  tags: Array.isArray(row?.tags) ? row.tags : [],
  occurrenceCount: Number(row?.occurrenceCount || 1),
  status: STATUSES.has(row?.status) ? row.status : "pending",
});

const ensureAuth = (ctx) => {
  if (!ctx?.user?.id && !ctx?.user?._id)
    throw Object.assign(new Error("Cần đăng nhập"), {
      code: "UNAUTHENTICATED",
    });
};
const ensurePermission = async (ctx, restaurantId, permissionCode) => {
  ensureAuth(ctx);

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw Object.assign(new Error("restaurantId không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  }

  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
};

const ensureAnyPermission = async (ctx, restaurantId, permissionCodes) => {
  ensureAuth(ctx);

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw Object.assign(new Error("restaurantId không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  }

  await requireAnyRestaurantPermission(ctx, restaurantId, permissionCodes);
};

export async function recordKnowledgeGapSuggestion({
  restaurantId,
  question,
  triggerType,
  confidence,
  conversationId,
  messageId,
}) {
  const rid = toObjectId(restaurantId);
  const safeQuestion = clean(question, MAX_QUESTION);
  const normalizedQuestion = normalizeQuestion(safeQuestion);
  if (
    !rid ||
    !TRIGGER_TYPES.has(String(triggerType || "")) ||
    !normalizedQuestion ||
    normalizedQuestion.length < MIN_QUESTION_LEN ||
    isSensitiveQuestion(safeQuestion)
  )
    return null;

  const now = new Date();
  const found = await AiChatbotKnowledgeSuggestion.findOne({
    restaurantId: rid,
    normalizedQuestion,
    status: "pending",
  });
  if (found) {
    found.occurrenceCount = Number(found.occurrenceCount || 1) + 1;
    found.lastAskedAt = now;
    found.triggerType = TRIGGER_TYPES.has(String(triggerType || ""))
      ? String(triggerType)
      : found.triggerType;
    if (Number.isFinite(Number(confidence)))
      found.confidence = Number(confidence);
    if (mongoose.isValidObjectId(conversationId))
      found.sourceConversationId = toObjectId(conversationId);
    if (mongoose.isValidObjectId(messageId))
      found.sourceMessageId = toObjectId(messageId);
    await found.save();
    return toDto(found.toObject());
  }

  const doc = await AiChatbotKnowledgeSuggestion.create({
    restaurantId: rid,
    question: safeQuestion,
    normalizedQuestion,
    triggerType: String(triggerType),
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
    sourceConversationId: toObjectId(conversationId),
    sourceMessageId: toObjectId(messageId),
    lastAskedAt: now,
  });
  return toDto(doc.toObject());
}

const normalizeAutoSources = (sources) => {
  const src = Array.isArray(sources) && sources.length ? sources : DEFAULT_AUTO_SOURCES;
  return src
    .map((source) => clean(source, 40))
    .filter((source) => AUTO_SOURCES.has(source));
};

const formatAddress = (address = {}) =>
  [address.line1, address.ward, address.district, address.city, address.country]
    .map((part) => clean(part, 120))
    .filter(Boolean)
    .join(", ");

const formatMoney = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${Math.round(number).toLocaleString("vi-VN")}đ`;
};

const providerLabel = (provider) => {
  const value = String(provider?.provider || provider || "").toLowerCase();
  if (provider?.label) return provider.label;
  if (value === "momo") return "MoMo";
  if (value === "vnpay") return "VNPAY";
  if (value === "cash") return "tiền mặt";
  if (value === "bank_transfer") return "chuyển khoản ngân hàng";
  return value || "phương thức thanh toán khác";
};

const pushCandidate = (candidates, candidate) => {
  const question = clean(candidate?.question, MAX_QUESTION);
  const title = clean(candidate?.suggestedTitle, MAX_TITLE);
  const content = clean(candidate?.suggestedContent, MAX_CONTENT);
  if (!question || !title || !content) return;
  candidates.push({
    question,
    normalizedQuestion: normalizeQuestion(question),
    suggestedTitle: title,
    suggestedContent: content,
    category: clean(candidate?.category || "general", MAX_CATEGORY),
    tags: toTags(candidate?.tags || []),
    triggerType: "no_knowledge_match",
    confidence: Number.isFinite(Number(candidate?.confidence))
      ? Number(candidate.confidence)
      : 0.9,
  });
};

const buildRestaurantCandidates = ({ restaurant, sources, menuItems, coupons }) => {
  const candidates = [];
  const name = clean(restaurant?.name || "nhà hàng", 120);
  const address = formatAddress(restaurant?.address || {});
  const cuisine = clean(restaurant?.cuisineType, 80);
  const description = clean(restaurant?.description, 600);
  const phone = clean(restaurant?.phone, 60);
  const email = clean(restaurant?.email, 120);
  const capabilities = restaurant?.capabilities || {};
  const reservationPolicy = restaurant?.reservationPolicy || {};

  if (sources.includes("restaurant_info")) {
    const parts = [
      `${name} là nhà hàng${cuisine ? ` phục vụ phong cách ${cuisine}` : ""}.`,
      description,
      address ? `Địa chỉ: ${address}.` : "",
      phone ? `Số điện thoại liên hệ: ${phone}.` : "",
      email ? `Email liên hệ: ${email}.` : "",
      restaurant?.seatingCapacity
        ? `Sức chứa tham khảo: ${restaurant.seatingCapacity} khách.`
        : "",
      restaurant?.priceRange ? `Khoảng giá: ${restaurant.priceRange}.` : "",
    ].filter(Boolean);
    pushCandidate(candidates, {
      question: `Thông tin chung của ${name} là gì?`,
      suggestedTitle: `Thông tin chung về ${name}`,
      suggestedContent: parts.join(" "),
      category: "restaurant_info",
      tags: ["nhà hàng", "thông tin chung", "liên hệ"],
      confidence: 0.95,
    });
  }

  if (sources.includes("opening_hours")) {
    const opening = clean(restaurant?.openingHours, 80);
    const closing = clean(restaurant?.closingHours, 80);
    const notes = clean(restaurant?.notesOnHours, 400);
    if (opening || closing || notes || restaurant?.operationalStatus) {
      const parts = [
        opening || closing
          ? `${name} mở cửa${opening ? ` từ ${opening}` : ""}${closing ? ` đến ${closing}` : ""}.`
          : "",
        notes,
        restaurant?.operationalStatus && restaurant.operationalStatus !== "normal"
          ? `Trạng thái vận hành hiện tại: ${restaurant.operationalStatus}.`
          : "",
        restaurant?.timezone ? `Múi giờ: ${restaurant.timezone}.` : "",
      ].filter(Boolean);
      pushCandidate(candidates, {
        question: `${name} mở cửa lúc nào?`,
        suggestedTitle: "Giờ mở cửa nhà hàng",
        suggestedContent: parts.join(" "),
        category: "opening_hours",
        tags: ["giờ mở cửa", "thời gian hoạt động", "nhà hàng"],
        confidence: 0.96,
      });
    }
  }

  if (sources.includes("booking")) {
    const acceptsReservations = capabilities.acceptsReservations !== false;
    const minAdvance = Number(reservationPolicy.minAdvanceMinutes || 0);
    const maxAdvance = Number(reservationPolicy.maxAdvanceDays || 0);
    const parts = [
      acceptsReservations
        ? `${name} có hỗ trợ đặt bàn trước qua hệ thống.`
        : `${name} hiện chưa bật đặt bàn trước qua hệ thống.`,
      minAdvance > 0
        ? `Khách nên đặt trước tối thiểu ${minAdvance} phút.`
        : "",
      maxAdvance > 0 ? `Khách có thể đặt trước tối đa ${maxAdvance} ngày.` : "",
      reservationPolicy.allowWhenClosed === false
        ? "Hệ thống không nhận đặt bàn ngoài giờ hoạt động."
        : "",
      restaurant?.reservationSettings?.baseDepositAmount
        ? `Tiền cọc cơ bản: ${formatMoney(restaurant.reservationSettings.baseDepositAmount)}.`
        : "",
    ].filter(Boolean);
    pushCandidate(candidates, {
      question: `Khách đặt bàn tại ${name} như thế nào?`,
      suggestedTitle: "Hướng dẫn đặt bàn",
      suggestedContent: parts.join(" "),
      category: "booking",
      tags: ["đặt bàn", "giữ bàn", "xác nhận bàn"],
      confidence: 0.92,
    });
  }

  if (sources.includes("menu") && menuItems.length) {
    const available = menuItems.filter((item) => item.status === "available");
    const top = (available.length ? available : menuItems).slice(0, 8);
    const topText = top
      .map((item) => {
        const price = formatMoney(item.basePrice);
        return `${item.name}${price ? ` (${price})` : ""}`;
      })
      .join(", ");
    pushCandidate(candidates, {
      question: `${name} có những món nổi bật nào?`,
      suggestedTitle: "Các món nổi bật trong thực đơn",
      suggestedContent: `${name} hiện có các món nổi bật như ${topText}. Khách có thể xem thực đơn để biết giá, mô tả món và tình trạng còn phục vụ tại thời điểm đặt món.`,
      category: "menu",
      tags: ["thực đơn", "món nổi bật", "món ăn"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách đang xem bóng đá nên gợi ý món nào?",
      suggestedTitle: "Playbook gợi ý món khi xem bóng đá",
      suggestedContent: "Khi khách nói đang xem bóng đá, coi đá banh hoặc cần món ăn lúc giải trí, chatbot phải lấy món từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems, ưu tiên món còn bán, đánh giá cao, nhiều lượt đặt và hợp khẩu vị For You nếu có. Nên ưu tiên món dễ chia sẻ, ăn gọn, đậm vị, snack/combo hoặc món chuẩn bị nhanh. Không bịa món, giá hay tồn kho. Với mỗi món được nhắc, trả về source type menuItem và action link tới /food/{id} để khách bấm xem chi tiết/order.",
      category: "recommendation_playbook",
      tags: ["gợi ý món", "bóng đá", "for you", "menu"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách không thích món vừa gợi ý thì xử lý thế nào?",
      suggestedTitle: "Playbook gợi ý món khác theo For You",
      suggestedContent: "Khi khách nói món vừa gợi ý không ngon, không hợp khẩu vị, không thích hoặc muốn đề xuất khác, chatbot không lặp lại cùng món trong lượt trước. Hãy đổi sang món khác category hoặc khác khẩu vị, vẫn lấy từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems, ưu tiên For You: loại món có allergen, ưu tiên dietTags/tasteProfile phù hợp, sau đó xét đánh giá và lượt đặt. Nếu không đủ dữ liệu, hỏi thêm khẩu vị/ngân sách hoặc gợi ý mở menu để khách tự chọn.",
      category: "recommendation_playbook",
      tags: ["món khác", "for you", "khẩu vị", "menu"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách cần món ăn kèm cho tiệc sinh nhật thì gợi ý thế nào?",
      suggestedTitle: "Playbook gợi ý món ăn kèm cho tiệc sinh nhật",
      suggestedContent: "Khi khách hỏi món ăn kèm, khai vị hoặc món phụ cho tiệc sinh nhật, chatbot phải lấy món từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems. Ưu tiên món dễ chia sẻ, dễ ăn khi đứng/ngồi tiệc, ít dây bẩn, hợp nhóm, có thể là khai vị, snack, món chiên/nướng, món phụ, tráng miệng, đồ uống hoặc combo nếu dữ liệu có. Nên đưa 3-5 lựa chọn, mỗi món có lý do ngắn và action link /food/{id}. Không tự tạo set/combo nếu không có trong context.",
      category: "recommendation_playbook",
      tags: ["sinh nhật", "món ăn kèm", "khai vị", "tiệc"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách tụ tập bạn bè hoặc ăn nhậu nên gợi ý món gì?",
      suggestedTitle: "Playbook gợi ý món cho buổi tụ tập bạn bè",
      suggestedContent: "Khi khách nói tụ tập bạn bè, liên hoan, ăn nhậu hoặc cần món lai rai, chatbot chỉ tư vấn món ăn trong menu, không khuyến khích rượu bia. Ưu tiên món dễ chia, đậm vị, ăn kèm tốt, snack, món chiên/nướng, món khai vị, món ít cần dụng cụ và phù hợp nhóm. Nếu khách hỏi đồ uống, chỉ gợi ý đồ uống không cồn hoặc đồ uống có trong context một cách trung lập theo menu. Mỗi món cụ thể phải có source menuItem và link /food/{id} nếu có id.",
      category: "recommendation_playbook",
      tags: ["tụ tập", "ăn nhậu", "món ăn kèm", "nhóm"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách tổ chức tiệc gia đình nên gọi món gì?",
      suggestedTitle: "Playbook gợi ý món cho tiệc gia đình",
      suggestedContent: "Khi khách hỏi món cho tiệc gia đình, chatbot nên gợi ý cấu trúc bữa ăn cân bằng từ món có trong context: món chính, món dễ chia, món nhẹ/khai vị, món cho trẻ em nếu có, món ít cay cho người lớn tuổi và đồ uống/tráng miệng nếu phù hợp. Ưu tiên món phổ biến, đánh giá tốt, không quá kén khẩu vị. Nếu khách nêu số người hoặc ngân sách, lọc theo partySize/budget trước rồi mới xét rating và For You.",
      category: "recommendation_playbook",
      tags: ["tiệc gia đình", "nhóm", "trẻ em", "người lớn tuổi"],
      confidence: 0.9,
    });
    pushCandidate(candidates, {
      question: "Khách liên hoan công ty hoặc họp nhóm nên gọi món gì?",
      suggestedTitle: "Playbook gợi ý món cho liên hoan công ty",
      suggestedContent: "Khi khách hỏi món cho liên hoan công ty, họp nhóm hoặc team building, chatbot ưu tiên món dễ chia khẩu phần, trình bày gọn, ít rủi ro dị ứng, nhiều người ăn được, có thể đặt số lượng lớn nếu menu hỗ trợ. Nên gợi ý theo nhóm: món chính, món ăn kèm/khai vị, đồ uống, tráng miệng. Không cam kết phục vụ số lượng lớn nếu context không có chính sách; hãy gợi ý liên hệ nhân viên để xác nhận trước.",
      category: "recommendation_playbook",
      tags: ["liên hoan", "công ty", "nhóm", "món ăn kèm"],
      confidence: 0.9,
    });

    const dietaryItems = menuItems.filter(
      (item) =>
        ["VEGETARIAN", "VEGAN"].includes(item.foodType) ||
        (Array.isArray(item.dietTags) && item.dietTags.length) ||
        (Array.isArray(item.allergenTags) && item.allergenTags.length),
    );
    if (dietaryItems.length) {
      const dietaryText = dietaryItems
        .slice(0, 8)
        .map((item) => {
          const notes = [
            item.foodType && item.foodType !== "UNKNOWN" ? item.foodType : "",
            ...(item.dietTags || []),
            ...(item.allergenTags || []).map((tag) => `dị ứng ${tag}`),
          ].filter(Boolean);
          return `${item.name}${notes.length ? ` (${notes.join(", ")})` : ""}`;
        })
        .join("; ");
      pushCandidate(candidates, {
        question: `${name} có món chay hoặc thông tin dị ứng không?`,
        suggestedTitle: "Thông tin món chay và dị ứng",
        suggestedContent: `Một số món có thông tin ăn chay hoặc dị ứng gồm: ${dietaryText}. Với khách có dị ứng nghiêm trọng, chatbot nên khuyến nghị khách liên hệ nhân viên để xác nhận lại trước khi gọi món.`,
        category: "menu_safety",
        tags: ["món chay", "dị ứng", "an toàn thực phẩm"],
        confidence: 0.88,
      });
    }
  }

  if (sources.includes("payment")) {
    const providers = (restaurant?.paymentSettings?.providers || [])
      .filter((provider) => provider?.active !== false)
      .map(providerLabel);
    const methods = ["tiền mặt", "chuyển khoản khi nhà hàng hỗ trợ", ...providers]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);
    if (methods.length) {
      pushCandidate(candidates, {
        question: `${name} hỗ trợ thanh toán bằng hình thức nào?`,
        suggestedTitle: "Phương thức thanh toán",
        suggestedContent: `${name} có thể hỗ trợ các hình thức thanh toán như ${methods.join(", ")}. Khách nên kiểm tra lại phương thức đang khả dụng ở bước thanh toán hoặc hỏi nhân viên nếu cần hỗ trợ thêm.`,
        category: "payment",
        tags: ["thanh toán", "momo", "vnpay", "chuyển khoản"],
        confidence: 0.86,
      });
    }
  }

  if (sources.includes("promotions") && coupons.length) {
    const couponText = coupons
      .slice(0, 8)
      .map((coupon) => {
        const discount =
          coupon.discountType === "AMOUNT"
            ? formatMoney(coupon.discountValue)
            : `${Number(coupon.discountValue || 0)}%`;
        const minOrder = coupon.minOrderValue
          ? `, đơn tối thiểu ${formatMoney(coupon.minOrderValue)}`
          : "";
        return `${coupon.name || coupon.code} (mã ${coupon.code}, giảm ${discount}${minOrder})`;
      })
      .join("; ");
    pushCandidate(candidates, {
      question: `${name} đang có ưu đãi hoặc mã giảm giá nào?`,
      suggestedTitle: "Ưu đãi và mã giảm giá đang áp dụng",
      suggestedContent: `Một số ưu đãi đang hoạt động gồm: ${couponText}. Điều kiện áp dụng có thể thay đổi theo thời gian, số lượng sử dụng và giá trị đơn hàng.`,
      category: "promotion",
      tags: ["khuyến mãi", "mã giảm giá", "coupon"],
      confidence: 0.84,
    });
  }

  if (sources.includes("delivery_pickup")) {
    const acceptsDelivery = Boolean(capabilities.acceptsDelivery);
    const acceptsPickup = Boolean(capabilities.acceptsPickup || capabilities.acceptsOrders);
    if (acceptsDelivery || acceptsPickup || restaurant?.orderPolicy) {
      const parts = [
        acceptsDelivery
          ? `${name} có hỗ trợ đơn giao hàng khi khu vực và thời gian phục vụ phù hợp.`
          : `${name} hiện chưa bật giao hàng mặc định trong hệ thống.`,
        acceptsPickup
          ? "Khách có thể đặt món mang đi khi nhà hàng đang nhận đơn."
          : "",
        restaurant?.orderPolicy?.allowWhenClosed === false
          ? "Hệ thống không nhận đơn ngoài giờ hoạt động."
          : "",
        restaurant?.orderPolicy?.minAdvanceMinutes
          ? `Thời gian đặt trước tối thiểu: ${restaurant.orderPolicy.minAdvanceMinutes} phút.`
          : "",
      ].filter(Boolean);
      pushCandidate(candidates, {
        question: `${name} có giao hàng hoặc bán mang đi không?`,
        suggestedTitle: "Giao hàng và mang đi",
        suggestedContent: parts.join(" "),
        category: "delivery_pickup",
        tags: ["giao hàng", "mang đi", "đặt món"],
        confidence: 0.86,
      });
    }
  }

  return candidates;
};

const upsertAutoSuggestion = async ({ restaurantId, candidate, overwriteExisting, userId }) => {
  if (!candidate.normalizedQuestion) return { status: "skipped", suggestion: null };
  const query = {
    restaurantId,
    normalizedQuestion: candidate.normalizedQuestion,
    status: "pending",
  };
  const existing = await AiChatbotKnowledgeSuggestion.findOne(query);
  if (existing) {
    if (!overwriteExisting) return { status: "skipped", suggestion: existing };
    existing.question = candidate.question;
    existing.suggestedTitle = candidate.suggestedTitle;
    existing.suggestedContent = candidate.suggestedContent;
    existing.category = candidate.category;
    existing.tags = candidate.tags;
    existing.triggerType = candidate.triggerType;
    existing.confidence = candidate.confidence;
    existing.lastAskedAt = new Date();
    existing.updatedBy = userId;
    await existing.save();
    return { status: "updated", suggestion: existing };
  }

  const created = await AiChatbotKnowledgeSuggestion.create({
    restaurantId,
    ...candidate,
    occurrenceCount: 1,
    lastAskedAt: new Date(),
    createdBy: userId,
    updatedBy: userId,
  });
  return { status: "created", suggestion: created };
};

export async function generateRestaurantAiChatbotKnowledgeSuggestions({ input, ctx }) {
  const restaurantId = input?.restaurantId;
  await ensurePermission(ctx, restaurantId, PERMISSIONS.AI_CHATBOT_MODERATE);

  const rid = toObjectId(restaurantId);
  const sources = normalizeAutoSources(input?.sources);
  if (!sources.length) {
    throw Object.assign(new Error("Chọn ít nhất một nguồn dữ liệu hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  }

  const restaurant = await Restaurant.findById(rid).lean();
  if (!restaurant) {
    throw Object.assign(new Error("Không tìm thấy nhà hàng"), {
      code: "NOT_FOUND",
    });
  }

  const [menuItems, coupons] = await Promise.all([
    sources.includes("menu")
      ? MenuItem.find({ restaurantId: rid })
          .select("name description basePrice status foodType dietTags allergenTags orderCounter rate labels")
          .sort({ orderCounter: -1, rate: -1, sortOrder: 1, name: 1 })
          .limit(40)
          .lean()
      : [],
    sources.includes("promotions")
      ? Coupon.find({ restaurantId: rid, isActive: true })
          .select("name code description discountType discountValue minOrderValue maxDiscount startAt endAt")
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean()
      : [],
  ]);

  const candidates = buildRestaurantCandidates({ restaurant, sources, menuItems, coupons });
  const userId = toObjectId(ctx?.user?.id || ctx?.user?._id);
  const suggestions = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const result = await upsertAutoSuggestion({
      restaurantId: rid,
      candidate,
      overwriteExisting: Boolean(input?.overwriteExisting),
      userId,
    });
    if (result.status === "created") created += 1;
    else if (result.status === "updated") updated += 1;
    else skipped += 1;
    if (result.suggestion) suggestions.push(toDto(result.suggestion.toObject?.() || result.suggestion));
  }

  return {
    created,
    updated,
    skipped,
    total: candidates.length,
    suggestions,
  };
}

export async function listRestaurantAiChatbotKnowledgeSuggestions({
  restaurantId,
  filter,
  ctx,
}) {
  await ensureAnyPermission(ctx, restaurantId, [
    PERMISSIONS.AI_CHATBOT_MODERATE,
    PERMISSIONS.AI_CHATBOT_READ,
  ]);
  const q = { restaurantId: toObjectId(restaurantId) };
  if (filter?.status && STATUSES.has(filter.status)) q.status = filter.status;
  if (filter?.triggerType && TRIGGER_TYPES.has(filter.triggerType))
    q.triggerType = filter.triggerType;
  if (filter?.search)
    q.question = new RegExp(
      clean(filter.search, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  const rows = await AiChatbotKnowledgeSuggestion.find(q)
    .sort({ status: 1, lastAskedAt: -1, occurrenceCount: -1 })
    .lean();
  return rows.map(toDto);
}

export async function approveRestaurantAiChatbotKnowledgeSuggestion({
  id,
  input,
  ctx,
}) {
  if (!mongoose.isValidObjectId(id))
    throw Object.assign(new Error("id không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  const found = await AiChatbotKnowledgeSuggestion.findById(id);
  if (!found)
    throw Object.assign(new Error("Không tìm thấy suggestion"), {
      code: "NOT_FOUND",
    });
  await ensurePermission(
    ctx,
    found.restaurantId,
    PERMISSIONS.AI_CHATBOT_MODERATE,
  );
  if (found.status !== "pending")
    throw Object.assign(
      new Error("Suggestion chỉ có thể duyệt khi đang pending"),
      { code: "BAD_USER_INPUT" },
    );

  const created = await createRestaurantAiChatbotKnowledgeItem({
    input: {
      restaurantId: String(found.restaurantId),
      title: clean(
        input?.title || found.suggestedTitle || found.question,
        MAX_TITLE,
      ),
      content: clean(input?.content || found.suggestedContent, MAX_CONTENT),
      category: clean(input?.category || found.category, MAX_CATEGORY),
      tags: toTags(input?.tags || found.tags),
      enabled: input?.enabled != null ? Boolean(input.enabled) : true,
      priority: input?.priority,
      sourceType: input?.sourceType || "suggestion",
    },
    ctx,
    skipPermissionCheck: true,
  });

  found.status = "approved";
  found.approvedKnowledgeItemId = toObjectId(created.id);
  found.updatedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  await found.save();
  return created;
}

export async function dismissRestaurantAiChatbotKnowledgeSuggestion({
  id,
  ctx,
}) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeSuggestion.findById(id);
  if (!found) return false;
  await ensurePermission(
    ctx,
    found.restaurantId,
    PERMISSIONS.AI_CHATBOT_MODERATE,
  );
  if (found.status !== "pending")
    throw Object.assign(
      new Error("Suggestion không thể dismiss ở trạng thái hiện tại"),
      { code: "BAD_USER_INPUT" },
    );
  found.status = "dismissed";
  found.updatedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  await found.save();
  return true;
}

export async function deleteRestaurantAiChatbotKnowledgeSuggestion({
  id,
  ctx,
}) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeSuggestion.findById(id).lean();
  if (!found) return false;
  await ensurePermission(
    ctx,
    found.restaurantId,
    PERMISSIONS.AI_CHATBOT_MODERATE,
  );
  await AiChatbotKnowledgeSuggestion.deleteOne({ _id: found._id });
  return true;
}

export async function bulkDismissRestaurantAiChatbotKnowledgeSuggestions({
  ids = [],
  ctx,
}) {
  for (const id of ids) {
    if (mongoose.isValidObjectId(id))
      await dismissRestaurantAiChatbotKnowledgeSuggestion({ id, ctx });
  }
  return true;
}

export async function bulkDeleteRestaurantAiChatbotKnowledgeSuggestions({
  ids = [],
  ctx,
}) {
  for (const id of ids) {
    if (mongoose.isValidObjectId(id))
      await deleteRestaurantAiChatbotKnowledgeSuggestion({ id, ctx });
  }
  return true;
}
