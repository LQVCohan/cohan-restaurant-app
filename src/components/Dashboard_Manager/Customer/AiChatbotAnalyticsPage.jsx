import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./CustomerAnalyticsPage.scss";
import "./AiChatbotAdmin.scss";

const GET_AI_CHATBOT_ANALYTICS = gql`
  query AiChatbotAnalytics($input: AiChatbotAnalyticsInput!) {
    aiChatbotAnalytics(input: $input) {
      totalConversations
      totalMessages
      openConversations
      handoffRequested
      resolvedHandoffs
      fallbackResponses
      lowConfidenceResponses
      handoffConversionRate
      averageMessagesPerConversation
      averageHandoffResolutionMinutes
      topIntents {
        intent
        count
      }
      messagesByRole {
        role
        count
      }
      rateLimitStatus {
        action
        max
        windowMs
      }
      pendingSuggestions
      notHelpfulFeedback
      activeSafetyRules
      evaluationCaseCount
      riskySignals {
        code
        level
        count
      }
      recentQualityQueue {
        id
        type
        label
        detail
        createdAt
      }
    }
  }
`;

const daysAgoIso = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const formatPct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const formatNum = (v) => new Intl.NumberFormat("vi-VN").format(Number(v || 0));
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const formatWindowMs = (windowMs) => {
  const ms = Number(windowMs || 0);
  if (ms < 60000) return `${Math.round(ms / 1000)} giây`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} phút`;
  return `${Math.round(ms / 3600000)} giờ`;
};

const rateLimitLabels = {
  askAiChatbot: "Khách hỏi chatbot",
  requestAiChatbotHandoff: "Yêu cầu gặp nhân viên",
  requestRestaurantChatbotHandoff: "Yêu cầu gặp nhân viên",
  sendAiChatbotGuestMessage: "Tin nhắn của khách",
  sendRestaurantChatbotHandoffMessage: "Tin nhắn của khách",
  aiChatbotGuestReplies: "Chatbot trả lời",
  submitAiChatbotAnswerFeedback: "Đánh giá câu trả lời",
  joinAiChatbotConversation: "Bắt đầu trò chuyện",
  joinRestaurantChatbotConversation: "Bắt đầu trò chuyện",
};

const riskySignalLabels = {
  FALLBACK_SPIKE: "Nhiều câu trả lời chưa chắc chắn",
  NOT_HELPFUL_SPIKE: "Phản hồi chưa hài lòng tăng",
  PENDING_SUGGESTION_BACKLOG: "Gợi ý tri thức chờ duyệt",
  SAFETY_BLOCK_SPIKE: "Nội dung bị chặn tăng",
};

const qualityQueueLabels = {
  fallback_response: "Cần bổ sung câu trả lời",
  pending_suggestion: "Gợi ý tri thức mới",
};
const messageRoleLabels = {
  assistant: "Chatbot",
  customer: "Khách",
  staff: "Nhân viên",
  manager: "Quản lý",
  system: "Hệ thống",
};

const signalLevelLabels = {
  info: "Ổn",
  low: "Ổn",
  warning: "Cần xem",
  medium: "Cần xem",
  critical: "Ưu tiên cao",
  danger: "Ưu tiên cao",
  high: "Ưu tiên cao",
};

const knowledgeTabLabels = {
  knowledge: "Tri thức",
  suggestions: "Gợi ý",
  feedback: "Phản hồi",
  safety: "An toàn",
  evaluation: "Kiểm thử",
};

const signalLevelClass = (level) => {
  const normalized = String(level || "").toLowerCase();
  if (["critical", "danger", "high"].includes(normalized)) {
    return "ai-admin-chip--danger";
  }
  if (["warning", "medium"].includes(normalized)) return "ai-admin-chip--warning";
  return "ai-admin-chip--success";
};

const intentLabel = (intent) => {
  const normalized = String(intent || "").toLowerCase();
  const labels = {
    menu: "Thực đơn",
    booking: "Đặt bàn",
    reservation: "Đặt bàn",
    order: "Đơn hàng",
    coupon: "Ưu đãi",
    promotion: "Ưu đãi",
    payment: "Thanh toán",
    delivery: "Giao hàng",
    opening_hours: "Giờ mở cửa",
    location: "Địa chỉ",
  };
  return labels[normalized] || intent || "Khác";
};

const qualityItemTitle = (item) =>
  qualityQueueLabels[item?.type] || "Nội dung cần xem lại";

const qualityItemDescription = (item) => {
  if (item?.type === "fallback_response") {
    return "Chatbot thiếu thông tin để trả lời rõ ràng.";
  }
  if (item?.type === "pending_suggestion") {
    return "Khách hỏi nội dung chưa có trong kho tri thức.";
  }
  return "Nội dung này cần được kiểm tra để cải thiện chất lượng tư vấn.";
};

const qualityItemMeta = (item) => {
  const raw = `${item?.label || ""} ${item?.detail || ""}`.toLowerCase();
  if (raw.includes("menu")) return "Thực đơn";
  if (raw.includes("booking") || raw.includes("reservation")) {
    return "Đặt bàn";
  }
  if (raw.includes("order")) return "Đơn hàng";
  if (raw.includes("coupon") || raw.includes("promotion")) {
    return "Ưu đãi";
  }
  if (raw.includes("knowledge")) return "Thiếu tri thức phù hợp";
  return "Cần rà soát";
};

const reviewActionFor = (item) => {
  const raw = `${item?.type || ""} ${item?.label || ""} ${item?.detail || ""}`.toLowerCase();

  if (item?.type === "pending_suggestion" || raw.includes("suggestion") || raw.includes("knowledge")) {
    return {
      tab: "suggestions",
      label: "Mở Gợi ý",
      description: "Duyệt thành tri thức mới hoặc bỏ qua nếu nội dung không phù hợp.",
    };
  }

  if (raw.includes("safety") || raw.includes("block")) {
    return {
      tab: "safety",
      label: "Mở An toàn",
      description: "Kiểm tra quy tắc chặn và phạm vi chatbot được phép trả lời.",
    };
  }

  if (item?.type === "fallback_response" || raw.includes("feedback") || raw.includes("fallback")) {
    return {
      tab: "feedback",
      label: "Mở Phản hồi",
      description: "Xem câu trả lời chưa ổn và bổ sung tri thức nếu cần.",
    };
  }

  return {
    tab: "knowledge",
    label: "Mở Tri thức",
    description: "Thêm hoặc chỉnh nội dung để chatbot có nguồn trả lời tốt hơn.",
  };
};

function EmptyReport() {
  return (
    <div className="ai-admin-empty ai-admin-empty--soft">
      <div className="ai-admin-empty__icon">•</div>
      <h4>Chưa có dữ liệu</h4>
      <p>Khi có hội thoại mới, báo cáo sẽ tự cập nhật.</p>
    </div>
  );
}

export default function AiChatbotAnalyticsPage() {
  const [range, setRange] = useState("7");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const effectiveRestaurantId = selectedRestaurantId;

  const variables = useMemo(
    () => ({
      input: {
        restaurantId: effectiveRestaurantId || null,
        from: daysAgoIso(Number(range || 7)),
        to: new Date().toISOString(),
        groupBy: "none",
      },
    }),
    [effectiveRestaurantId, range],
  );

  const { data, loading, error, refetch } = useQuery(GET_AI_CHATBOT_ANALYTICS, {
    skip: !effectiveRestaurantId,
    variables,
    fetchPolicy: "network-only",
  });

  const m = data?.aiChatbotAnalytics;
  const reviewItems = m?.recentQualityQueue || [];
  const reviewPreviewItems = reviewItems.slice(0, 2);
  const reviewCount = Number(m?.fallbackResponses || 0) + Number(m?.pendingSuggestions || 0) + Number(m?.notHelpfulFeedback || 0);
  const averageMessageLabel =
    Number(m?.totalConversations || 0) > 0 && m?.averageMessagesPerConversation != null
      ? `${Number(m.averageMessagesPerConversation).toFixed(1)} tin / cuộc`
      : "tổng tin nhắn trong kỳ";
  const handoffLabel = Number(m?.handoffRequested || 0)
    ? `${formatPct(m.handoffConversionRate)} trong số hội thoại`
    : "chưa phát sinh";

  useEffect(() => {
    const lockClassName = "ai-admin-modal-open";

    if (!reviewModalOpen) {
      return undefined;
    }

    document.body.classList.add(lockClassName);
    document.documentElement.classList.add(lockClassName);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setReviewModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove(lockClassName);
      document.documentElement.classList.remove(lockClassName);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [reviewModalOpen]);

  const openKnowledgeTarget = (item) => {
    const action = reviewActionFor(item);
    const query = {
      tab: action.tab,
      focusId: item?.id || "",
      source: item?.type || "quality-review",
    };

    setReviewModalOpen(false);
    sessionStorage.setItem("aiChatbotKnowledgeTarget", JSON.stringify(query));
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: {
          page: "ai-chatbot-knowledge",
          query,
          source: "ai-analytics-review",
        },
      }),
    );

    let attempts = 0;
    const clickTargetTab = () => {
      const buttons = Array.from(document.querySelectorAll(".ai-admin-tabs button"));
      const target = buttons.find(
        (button) => button.textContent?.trim() === knowledgeTabLabels[action.tab],
      );

      if (target) {
        target.click();
        document
          .querySelector(".ai-admin-tab-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      attempts += 1;
      if (attempts <= 12) window.setTimeout(clickTargetTab, 120);
    };

    window.setTimeout(clickTargetTab, 120);
  };

  return (
    <section className="customer-analytics-page ai-admin-page ai-admin-page--analytics">
      <section className="customer-analytics-hero ai-admin-hero ai-admin-report-summary">
        <div className="ai-admin-hero__copy">
          <p className="customer-analytics-hero__eyebrow ai-admin-eyebrow">
            Hiệu quả tư vấn
          </p>
          <h2>Báo cáo Chatbot AI</h2>
          <p>
            Xem hiệu quả tư vấn, nhu cầu gặp nhân viên và các nội dung cần xử lý.
          </p>
        </div>

        <div className="customer-analytics-toolbar ai-admin-toolbar">
          <label className="customer-analytics-field ai-admin-field">
            <span>Nhà hàng</span>
            <select
              value={effectiveRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              disabled={restaurantsLoading || !hasRestaurants}
            >
              <option value="">
                {restaurantsLoading ? "Đang tải nhà hàng..." : "Chọn nhà hàng"}
              </option>
              {restaurantOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-analytics-field ai-admin-field">
            <span>Thời gian</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">7 ngày</option>
              <option value="30">30 ngày</option>
            </select>
          </label>
          <button
            type="button"
            className="customer-analytics-refresh"
            onClick={() => refetch?.()}
            disabled={loading || !effectiveRestaurantId}
          >
            Làm mới
          </button>
        </div>
      </section>

      {!effectiveRestaurantId && !restaurantsLoading ? (
        <section className="customer-empty-state customer-empty-state--page ai-admin-empty">
          <h3>Chọn nhà hàng để xem báo cáo chatbot</h3>
        </section>
      ) : null}
      {restaurantsLoading || loading ? (
        <section className="customer-empty-state customer-empty-state--page ai-admin-skeleton" role="status">
          <h3>Đang tải dữ liệu chatbot...</h3>
        </section>
      ) : null}
      {error ? (
        <section className="customer-analytics-error ai-admin-error">
          <span>{error.message || "Không thể tải báo cáo chatbot"}</span>
          <button type="button" onClick={() => refetch?.()}>
            Thử lại
          </button>
        </section>
      ) : null}

      {!loading && !error && m ? (
        <>
          <div className="customer-analytics-overview-grid ai-admin-metrics ai-admin-metrics--primary">
            <article>
              <span>Cuộc trò chuyện</span>
              <strong>{formatNum(m.totalConversations)}</strong>
              <small>{formatNum(m.openConversations)} cuộc đang mở</small>
            </article>
            <article>
              <span>Tin nhắn</span>
              <strong>{formatNum(m.totalMessages)}</strong>
              <small>{averageMessageLabel}</small>
            </article>
            <article>
              <span>Gặp nhân viên</span>
              <strong>{formatNum(m.handoffRequested)}</strong>
              <small>{handoffLabel}</small>
            </article>
            <article>
              <span>Cần rà soát</span>
              <strong>{formatNum(reviewCount)}</strong>
              <small>mục cần xử lý trong kỳ</small>
            </article>
          </div>

          {reviewItems.length ? (
            <article className="ai-admin-review-strip" aria-label="Việc cần rà soát">
              <div className="ai-admin-review-strip__summary">
                <span className="ai-admin-chip ai-admin-chip--warning">
                  {formatNum(reviewItems.length)} mục
                </span>
                <div>
                  <h3>Việc cần rà soát</h3>
                  <p>Nội dung cần kiểm tra để chatbot trả lời tốt hơn.</p>
                </div>
              </div>
              <div className="ai-admin-review-strip__items">
                {reviewPreviewItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ai-admin-review-strip__item"
                    onClick={() => openKnowledgeTarget(item)}
                  >
                    <strong>{qualityItemTitle(item)}</strong>
                    <small>{reviewActionFor(item).label} · {qualityItemMeta(item)}</small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ai-admin-link-button"
                onClick={() => setReviewModalOpen(true)}
              >
                Xem tất cả
              </button>
            </article>
          ) : null}

          <section className="ai-admin-insight-grid">
            <article className="customer-analytics-panel ai-admin-control-card">
              <header className="ai-analytics-card__header">
                <h3>Khách hỏi về gì?</h3>
                <p>Các nhóm câu hỏi xuất hiện nhiều trong kỳ.</p>
              </header>
              {m.topIntents?.length ? (
                <ul className="ai-analytics-list ai-analytics-list--bars">
                  {m.topIntents.slice(0, 6).map((it) => (
                    <li key={it.intent} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        {intentLabel(it.intent)}
                      </span>
                      <span className="ai-analytics-list__value">{formatNum(it.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyReport />
              )}
            </article>

            <article className="customer-analytics-panel ai-admin-control-card">
              <header className="ai-analytics-card__header">
                <h3>Ai đang nhắn?</h3>
                <p>Tin nhắn đến từ khách, chatbot hay nhân viên.</p>
              </header>
              {m.messagesByRole?.length ? (
                <ul className="ai-analytics-list">
                  {m.messagesByRole.map((it) => (
                    <li key={it.role} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        {messageRoleLabels[it.role] || it.role}
                      </span>
                      <span className="ai-analytics-list__value">{formatNum(it.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyReport />
              )}
            </article>
          </section>

          <section className="ai-admin-operational-grid">
            <article className="customer-analytics-panel ai-admin-control-card">
              <header className="ai-analytics-card__header">
                <h3>Giới hạn hệ thống</h3>
                <p>Mức giới hạn giúp chatbot vận hành ổn định.</p>
              </header>
              {m.rateLimitStatus?.length ? (
                <ul className="ai-analytics-list">
                  {m.rateLimitStatus.map((it) => (
                    <li key={it.action} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        {rateLimitLabels[it.action] || "Hoạt động chatbot"}
                      </span>
                      <span className="ai-analytics-list__value">
                        {it.max} lượt / {formatWindowMs(it.windowMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyReport />
              )}
            </article>

            <article className="customer-analytics-panel ai-admin-control-card">
              <header className="ai-analytics-card__header">
                <h3>Cần ưu tiên xử lý</h3>
                <p>Các điểm có thể ảnh hưởng trải nghiệm khách.</p>
              </header>
              {m.riskySignals?.length ? (
                <ul className="ai-analytics-list">
                  {m.riskySignals.map((it) => (
                    <li key={it.code} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        {riskySignalLabels[it.code] || "Tín hiệu cần xem"}
                      </span>
                      <span className={`ai-admin-chip ${signalLevelClass(it.level)}`}>
                        {signalLevelLabels[String(it.level || "").toLowerCase()] || "Cần xem"} · {formatNum(it.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ai-admin-empty ai-admin-empty--soft">
                  <div className="ai-admin-empty__icon">✓</div>
                  <h4>Ổn định</h4>
                  <p>Chưa có vấn đề cần ưu tiên trong kỳ này.</p>
                </div>
              )}
            </article>
          </section>

          <details className="ai-admin-collapsible ai-admin-technical-details">
            <summary>Thông tin hệ thống</summary>
            <div className="ai-admin-technical-grid">
              <span>Chuyển nhân viên đã xử lý: {formatNum(m.resolvedHandoffs)}</span>
              <span>Câu trả lời cần bổ sung: {formatNum(m.fallbackResponses)}</span>
              <span>Câu trả lời chưa chắc chắn: {formatNum(m.lowConfidenceResponses)}</span>
              <span>Quy tắc an toàn đang bật: {formatNum(m.activeSafetyRules)}</span>
              <span>Kịch bản kiểm thử: {formatNum(m.evaluationCaseCount)}</span>
              <span>
                Thời gian xử lý trung bình: {m.averageHandoffResolutionMinutes == null ? "—" : `${Number(m.averageHandoffResolutionMinutes).toFixed(1)} phút`}
              </span>
            </div>
          </details>

          {reviewModalOpen ? (
            <div
              className="ai-admin-modal-backdrop"
              role="presentation"
              onMouseDown={() => setReviewModalOpen(false)}
            >
              <section
                className="ai-admin-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-review-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="ai-admin-modal__header">
                  <div>
                    <p className="ai-admin-eyebrow">Rà soát chất lượng</p>
                    <h3 id="ai-review-modal-title">Việc cần rà soát</h3>
                    <p>Mở từng mục để chuyển đến nơi xử lý phù hợp.</p>
                  </div>
                  <button
                    type="button"
                    className="ai-admin-modal__close"
                    aria-label="Đóng danh sách rà soát"
                    onClick={() => setReviewModalOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <ul className="ai-admin-review-list__items ai-admin-review-list__items--modal">
                  {reviewItems.map((it) => {
                    const action = reviewActionFor(it);
                    return (
                      <li key={it.id} className="ai-admin-review-item ai-admin-review-item--actionable">
                        <div>
                          <span className="ai-admin-chip ai-admin-chip--warning">
                            {qualityQueueLabels[it.type] || "Cần rà soát"}
                          </span>
                          <h4>{qualityItemTitle(it)}</h4>
                          <p>{qualityItemDescription(it)}</p>
                          <small className="ai-admin-review-item__meta">
                            {qualityItemMeta(it)}
                          </small>
                          <div className="ai-admin-review-item__next-step">
                            <strong>Gợi ý xử lý:</strong> {action.description}
                          </div>
                        </div>
                        <div className="ai-admin-review-item__side">
                          <time dateTime={it.createdAt}>{formatDate(it.createdAt)}</time>
                          <button
                            type="button"
                            className="ai-admin-review-item__action"
                            onClick={() => openKnowledgeTarget(it)}
                          >
                            {action.label}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
