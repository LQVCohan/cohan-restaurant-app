import React, { useContext, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ChevronLeft, ChevronRight, Loader2, Sparkles, Utensils, X } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";
import { buildFoodDetailPath, buildFoodDetailState } from "@/utils/customerFoodNavigation";
import "./TodayMealWizard.scss";
import "./TodayMealWizardAiPanel.scss";

const STORAGE_KEY = "cohan.todayMealWizard.minimized";

const ASK_AI_CHATBOT = gql`
  mutation TodayMealWizardAskAi($input: AskAiChatbotInput!) {
    askAiChatbot(input: $input) {
      answer
      intent
      confidence
      quickReplies
      isFallback
      conversationId
      answerMessageId
      actions {
        type
        label
        href
        description
        icon
        priority
      }
      sources {
        type
        id
        label
        formattedPrice
        status
        isAvailable
        hasOptions
        hasVariants
        restaurantId
        basePrice
        currentPrice
        price
        servingVariants
      }
      contextSummary {
        restaurantCount
        menuItemCount
        couponCount
        orderCount
        reservationCount
      }
      handoffSuggested
      handoffReason
      handoffMessage
    }
  }
`;

const WIZARD_VISIBLE_PREFIXES = [
  "/",
  "/restaurants",
  "/restaurant/",
  "/cus-menu",
  "/food/",
  "/for-you",
  "/search",
  "/coupons/",
];

const WIZARD_HIDDEN_PREFIXES = [
  "/checkout",
  "/orders",
  "/track-delivery",
  "/track-order",
  "/profile",
  "/address-book",
  "/favorites",
  "/notifications",
  "/help-center",
  "/contact",
  "/login",
  "/manager",
  "/admin",
  "/staff",
  "/preview",
];

const STEP_CONFIG = [
  {
    id: "occasion",
    eyebrow: "Bước 1/4",
    title: "Hôm nay bạn muốn ăn kiểu gì?",
    description: "Chọn mood bữa ăn để AI hiểu đúng ngữ cảnh.",
    options: [
      { value: "nhanh_gon", label: "Nhanh gọn", hint: "No lâu, ít phải chọn" },
      { value: "healthy", label: "Nhẹ bụng", hint: "Ít dầu, cân bằng" },
      { value: "thuong_ban_than", label: "Tự thưởng", hint: "Ngon, đáng tiền" },
      { value: "di_cung_ban_be", label: "Đi cùng bạn bè", hint: "Dễ share, nhiều món" },
    ],
  },
  {
    id: "budget",
    eyebrow: "Bước 2/4",
    title: "Ngân sách khoảng bao nhiêu?",
    description: "AI sẽ ưu tiên món đúng mức giá thay vì gợi ý quá rộng.",
    options: [
      { value: "duoi_100k", label: "Dưới 100k", hint: "Tiết kiệm" },
      { value: "100_200k", label: "100k - 200k", hint: "Dễ chọn nhất" },
      { value: "200_400k", label: "200k - 400k", hint: "Ăn đã hơn" },
      { value: "khong_gioi_han", label: "Không giới hạn", hint: "Ưu tiên trải nghiệm" },
    ],
  },
  {
    id: "taste",
    eyebrow: "Bước 3/4",
    title: "Khẩu vị hôm nay?",
    description: "Chọn hướng vị chính, có thể kết hợp với hồ sơ khẩu vị của bạn.",
    options: [
      { value: "dam_da", label: "Đậm đà", hint: "Mặn mà, bắt vị" },
      { value: "it_cay", label: "Ít cay", hint: "Dễ ăn" },
      { value: "cay_nong", label: "Cay nóng", hint: "Kích thích vị giác" },
      { value: "chay", label: "Món chay", hint: "Không thịt" },
    ],
  },
  {
    id: "people",
    eyebrow: "Bước 4/4",
    title: "Ăn cho mấy người?",
    description: "AI có thể đề xuất combo hoặc nhóm món phù hợp số người.",
    options: [
      { value: "mot_nguoi", label: "1 người", hint: "Một phần gọn" },
      { value: "hai_nguoi", label: "2 người", hint: "Có thể gọi combo" },
      { value: "nhom_3_4", label: "3-4 người", hint: "Nhiều món để share" },
      { value: "nhom_lon", label: "Nhóm lớn", hint: "Ưu tiên món chung" },
    ],
  },
];

const LABELS = {
  nhanh_gon: "nhanh gọn",
  healthy: "nhẹ bụng, cân bằng",
  thuong_ban_than: "tự thưởng bằng món ngon đáng tiền",
  di_cung_ban_be: "đi cùng bạn bè, dễ chia sẻ",
  duoi_100k: "dưới 100k",
  "100_200k": "100k đến 200k",
  "200_400k": "200k đến 400k",
  khong_gioi_han: "không giới hạn ngân sách",
  dam_da: "đậm đà",
  it_cay: "ít cay",
  cay_nong: "cay nóng",
  chay: "món chay",
  mot_nguoi: "1 người",
  hai_nguoi: "2 người",
  nhom_3_4: "3 đến 4 người",
  nhom_lon: "nhóm lớn",
};

const readInitialMinimized = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeMinimized = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore storage errors
  }
};

const getRestaurantIdFromLocation = (location) => {
  const params = new URLSearchParams(location.search || "");
  const fromQuery = params.get("restaurantId");
  if (fromQuery) return fromQuery;

  const parts = String(location.pathname || "").split("/").filter(Boolean);
  if (parts[0] === "restaurant" && parts[1]) return parts[1];
  if (parts[0] === "table" && parts[1]) return parts[1];
  if (parts[0] === "coupons" && parts[1]) return parts[1];
  return null;
};

const shouldRenderWizard = (pathname = "") => {
  const path = pathname || "/";
  if (WIZARD_HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (path === "/") return true;
  return WIZARD_VISIBLE_PREFIXES.some((prefix) => prefix !== "/" && path.startsWith(prefix));
};

const buildPrompt = ({ answers, userName, restaurantId }) => {
  const lines = [
    "Hãy đóng vai trợ lý chọn món cho khách hàng hôm nay trong Cohan Restaurant App.",
    `Người dùng${userName ? ` ${userName}` : ""} muốn bữa ăn: ${LABELS[answers.occasion] || "dễ ăn"}.`,
    `Ngân sách: ${LABELS[answers.budget] || "vừa phải"}.`,
    `Khẩu vị: ${LABELS[answers.taste] || "tự nhiên, dễ ăn"}.`,
    `Số người: ${LABELS[answers.people] || "1-2 người"}.`,
    restaurantId
      ? "Ưu tiên gợi ý món có trong nhà hàng hiện tại nếu dữ liệu menu cho phép."
      : "Nếu chưa có nhà hàng cụ thể, hãy gợi ý cách chọn nhà hàng và món phù hợp trong Cohan.",
    "Trả lời ngắn gọn theo 3 phần: món nên chọn, lý do, bước tiếp theo. Nếu có món trong menu thì đề xuất món cụ thể và nhắc tôi bấm xem món để thêm vào giỏ.",
  ];
  return lines.join("\n");
};

const getAiErrorMessage = (error) => {
  const code = error?.graphQLErrors?.[0]?.extensions?.code;
  const msg = error?.graphQLErrors?.[0]?.message || error?.message || "";
  if (code === "RATE_LIMITED" || String(msg).includes("gửi quá nhanh")) {
    return "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.";
  }
  return msg || "AI chưa phản hồi được lúc này. Vui lòng thử lại.";
};

const buildMenuSourceCards = (response) => {
  const seen = new Set();
  const cards = [];
  for (const source of response?.sources || []) {
    if (source?.type !== "menuItem" || !source?.id) continue;
    const key = String(source.id);
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(source);
    if (cards.length >= 3) break;
  }
  return cards;
};

export default function TodayMealWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const [askAiChatbot, { loading: aiLoading }] = useMutation(ASK_AI_CHATBOT);
  const [isMinimized, setIsMinimized] = useState(readInitialMinimized);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({
    occasion: "",
    budget: "",
    taste: "",
    people: "",
  });
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");

  const visible = shouldRenderWizard(location.pathname);
  const restaurantId = useMemo(() => getRestaurantIdFromLocation(location), [location]);
  const activeStep = STEP_CONFIG[stepIndex];
  const activeValue = answers[activeStep.id];
  const isLastStep = stepIndex === STEP_CONFIG.length - 1;
  const completedCount = Object.values(answers).filter(Boolean).length;
  const canAskAi = completedCount === STEP_CONFIG.length && !aiLoading;
  const menuSourceCards = useMemo(() => buildMenuSourceCards(aiResult), [aiResult]);

  if (!visible) return null;

  const setMinimized = (value) => {
    setIsMinimized(value);
    writeMinimized(value);
  };

  const requestAiSuggestion = async (nextAnswers = answers) => {
    const prompt = buildPrompt({
      answers: nextAnswers,
      userName: user?.fullName || user?.name || "",
      restaurantId,
    });
    setLastPrompt(prompt);
    setAiError("");
    setAiResult(null);

    try {
      const { data } = await askAiChatbot({
        variables: {
          input: {
            message: prompt,
            restaurantId: restaurantId || undefined,
            history: [],
            pageContext: {
              source: "todayMealWizard",
              trigger: "wizard_complete_or_click",
              route: location.pathname,
              answers: nextAnswers,
              userName: user?.fullName || user?.name || "",
            },
          },
        },
      });
      const response = data?.askAiChatbot;
      setAiResult(response || { answer: "AI chưa có gợi ý phù hợp. Bạn có thể thử đổi khẩu vị hoặc ngân sách." });
    } catch (error) {
      setAiError(getAiErrorMessage(error));
    }
  };

  const handleOption = (value) => {
    const nextAnswers = { ...answers, [activeStep.id]: value };
    setAnswers(nextAnswers);
    setAiError("");
    setAiResult(null);

    if (!isLastStep) {
      window.setTimeout(() => setStepIndex((prev) => Math.min(prev + 1, STEP_CONFIG.length - 1)), 120);
      return;
    }

    window.setTimeout(() => requestAiSuggestion(nextAnswers), 120);
  };

  const handleAskAi = () => requestAiSuggestion(answers);

  const handleOpenForYou = () => {
    if (isAuthenticated) {
      navigate("/for-you");
      return;
    }
    navigate("/login", { state: { from: "/for-you" } });
  };

  const handleOpenChatbot = () => {
    openAiMenuAssistant({
      message: lastPrompt || buildPrompt({ answers, userName: user?.fullName || user?.name || "", restaurantId }),
      autoSend: true,
      restaurantId,
    });
  };

  const handleOpenFood = (source) => {
    if (!source?.id) return;
    const targetRestaurantId = source.restaurantId || restaurantId;
    navigate(
      buildFoodDetailPath(source.id, { restaurantId: targetRestaurantId }),
      {
        state: buildFoodDetailState(
          {
            id: source.id,
            name: source.label,
            restaurantId: targetRestaurantId,
            basePrice: source.basePrice || source.currentPrice || source.price,
            status: source.status,
            servingVariants: source.servingVariants || [],
          },
          { restaurantId: targetRestaurantId },
        ),
      },
    );
  };

  if (isMinimized) {
    return (
      <button type="button" className="today-meal-wizard-launcher" onClick={() => setMinimized(false)} aria-label="Mở wizard chọn món nhanh">
        <Sparkles size={18} />
        <span>Chọn món nhanh</span>
      </button>
    );
  }

  return (
    <section className="today-meal-wizard" aria-label="Wizard hỗ trợ chọn món hôm nay">
      <div className="today-meal-wizard__header">
        <div className="today-meal-wizard__icon" aria-hidden="true">
          <Utensils size={18} />
        </div>
        <div>
          <p>Trợ lý chọn món</p>
          <h3>Hôm nay ăn gì?</h3>
        </div>
        <button type="button" className="today-meal-wizard__close" onClick={() => setMinimized(true)} aria-label="Thu nhỏ wizard">
          <X size={16} />
        </button>
      </div>

      <div className="today-meal-wizard__progress" aria-hidden="true">
        {STEP_CONFIG.map((step, index) => (
          <span key={step.id} className={index <= stepIndex ? "is-active" : ""} />
        ))}
      </div>

      <div className="today-meal-wizard__body" key={activeStep.id}>
        <span className="today-meal-wizard__eyebrow">{activeStep.eyebrow}</span>
        <h4>{activeStep.title}</h4>
        <p>{activeStep.description}</p>

        <div className="today-meal-wizard__options">
          {activeStep.options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={activeValue === option.value ? "is-selected" : ""}
              style={{ "--option-index": index }}
              onClick={() => handleOption(option.value)}
              disabled={aiLoading}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>

        {(aiLoading || aiError || aiResult) && (
          <div className="today-meal-wizard__ai-panel" aria-live="polite">
            {aiLoading ? (
              <div className="today-meal-wizard__ai-loading">
                <Loader2 size={16} />
                AI đang tìm món phù hợp từ dữ liệu hệ thống...
              </div>
            ) : null}

            {aiError ? (
              <div className="today-meal-wizard__ai-error">{aiError}</div>
            ) : null}

            {aiResult ? (
              <div className="today-meal-wizard__ai-result">
                <span className="today-meal-wizard__ai-kicker">Gợi ý từ AI</span>
                <p>{aiResult.answer}</p>

                {menuSourceCards.length > 0 ? (
                  <div className="today-meal-wizard__source-list">
                    {menuSourceCards.map((source) => (
                      <button key={source.id} type="button" className="today-meal-wizard__source-card" onClick={() => handleOpenFood(source)}>
                        <strong>{source.label}</strong>
                        <span>{source.formattedPrice || (source.currentPrice ? `${Number(source.currentPrice).toLocaleString("vi-VN")}đ` : "Xem chi tiết")}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <button type="button" className="today-meal-wizard__chat-follow" onClick={handleOpenChatbot}>
                  <Bot size={15} />
                  Hỏi tiếp trong chat AI
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <footer className="today-meal-wizard__footer">
        <button type="button" className="today-meal-wizard__nav" onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))} disabled={stepIndex === 0 || aiLoading}>
          <ChevronLeft size={16} />
          Lùi
        </button>
        <button type="button" className="today-meal-wizard__for-you" onClick={handleOpenForYou} disabled={aiLoading}>
          <Bot size={16} />
          Gợi ý cá nhân
        </button>
        {isLastStep ? (
          <button type="button" className="today-meal-wizard__ask" onClick={handleAskAi} disabled={!canAskAi}>
            {aiLoading ? "Đang hỏi..." : aiResult ? "Hỏi lại" : "Hỏi AI"}
            {aiLoading ? <Loader2 size={16} className="today-meal-wizard__spin" /> : <Sparkles size={16} />}
          </button>
        ) : (
          <button type="button" className="today-meal-wizard__nav today-meal-wizard__nav--next" onClick={() => setStepIndex((prev) => Math.min(prev + 1, STEP_CONFIG.length - 1))}>
            Tiếp
            <ChevronRight size={16} />
          </button>
        )}
      </footer>
    </section>
  );
}
