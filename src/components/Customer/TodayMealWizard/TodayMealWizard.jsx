import React, { useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ChevronLeft, ChevronRight, Sparkles, Utensils, X } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";
import "./TodayMealWizard.scss";

const STORAGE_KEY = "cohan.todayMealWizard.minimized";

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
    "Hãy đóng vai trợ lý chọn món cho khách hàng hôm nay.",
    `Người dùng${userName ? ` ${userName}` : ""} muốn bữa ăn: ${LABELS[answers.occasion] || "dễ ăn"}.`,
    `Ngân sách: ${LABELS[answers.budget] || "vừa phải"}.`,
    `Khẩu vị: ${LABELS[answers.taste] || "tự nhiên, dễ ăn"}.`,
    `Số người: ${LABELS[answers.people] || "1-2 người"}.`,
    restaurantId
      ? "Ưu tiên gợi ý món có trong nhà hàng hiện tại nếu dữ liệu menu cho phép."
      : "Nếu chưa có nhà hàng cụ thể, hãy gợi ý cách chọn nhà hàng và món phù hợp trong Cohan.",
    "Trả lời ngắn gọn theo 3 phần: món nên chọn, lý do, bước tiếp theo. Nếu có món trong menu thì đề xuất món cụ thể và nhắc tôi bấm Chọn món để thêm vào giỏ.",
  ];
  return lines.join("\n");
};

export default function TodayMealWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const [isMinimized, setIsMinimized] = useState(readInitialMinimized);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({
    occasion: "",
    budget: "",
    taste: "",
    people: "",
  });

  const visible = shouldRenderWizard(location.pathname);
  const restaurantId = useMemo(() => getRestaurantIdFromLocation(location), [location]);
  const activeStep = STEP_CONFIG[stepIndex];
  const activeValue = answers[activeStep.id];
  const isLastStep = stepIndex === STEP_CONFIG.length - 1;
  const completedCount = Object.values(answers).filter(Boolean).length;
  const canAskAi = completedCount === STEP_CONFIG.length;

  if (!visible) return null;

  const setMinimized = (value) => {
    setIsMinimized(value);
    writeMinimized(value);
  };

  const handleOption = (value) => {
    setAnswers((prev) => ({ ...prev, [activeStep.id]: value }));
    if (!isLastStep) window.setTimeout(() => setStepIndex((prev) => Math.min(prev + 1, STEP_CONFIG.length - 1)), 120);
  };

  const handleAskAi = () => {
    const prompt = buildPrompt({
      answers,
      userName: user?.fullName || user?.name || "",
      restaurantId,
    });
    openAiMenuAssistant({ message: prompt, autoSend: true, restaurantId });
    setMinimized(true);
  };

  const handleOpenForYou = () => {
    if (isAuthenticated) {
      navigate("/for-you");
      return;
    }
    navigate("/login", { state: { from: "/for-you" } });
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        className="today-meal-wizard-launcher"
        onClick={() => setMinimized(false)}
        aria-label="Mở wizard Hôm nay ăn gì"
      >
        <Sparkles size={18} />
        <span>Hôm nay ăn gì?</span>
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
          <span
            key={step.id}
            className={index <= stepIndex ? "is-active" : ""}
          />
        ))}
      </div>

      <div className="today-meal-wizard__body">
        <span className="today-meal-wizard__eyebrow">{activeStep.eyebrow}</span>
        <h4>{activeStep.title}</h4>
        <p>{activeStep.description}</p>

        <div className="today-meal-wizard__options">
          {activeStep.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={activeValue === option.value ? "is-selected" : ""}
              onClick={() => handleOption(option.value)}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <footer className="today-meal-wizard__footer">
        <button
          type="button"
          className="today-meal-wizard__nav"
          onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
          disabled={stepIndex === 0}
        >
          <ChevronLeft size={16} />
          Lùi
        </button>
        <button
          type="button"
          className="today-meal-wizard__for-you"
          onClick={handleOpenForYou}
        >
          <Bot size={16} />
          Gợi ý cá nhân
        </button>
        {isLastStep ? (
          <button
            type="button"
            className="today-meal-wizard__ask"
            onClick={handleAskAi}
            disabled={!canAskAi}
          >
            Hỏi AI
            <Sparkles size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="today-meal-wizard__nav today-meal-wizard__nav--next"
            onClick={() => setStepIndex((prev) => Math.min(prev + 1, STEP_CONFIG.length - 1))}
          >
            Tiếp
            <ChevronRight size={16} />
          </button>
        )}
      </footer>
    </section>
  );
}
