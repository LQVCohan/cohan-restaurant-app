import React, { useMemo, useState } from "react";
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
  askAiChatbot: "Hỏi AI",
  requestAiChatbotHandoff: "Chuyển nhân viên",
  requestRestaurantChatbotHandoff: "Chuyển nhân viên",
  sendAiChatbotGuestMessage: "Tin nhắn khách",
  sendRestaurantChatbotHandoffMessage: "Tin nhắn khách",
  aiChatbotGuestReplies: "Phản hồi của chatbot",
  submitAiChatbotAnswerFeedback: "Phản hồi khách hàng",
  joinAiChatbotConversation: "Khách bắt đầu trò chuyện",
  joinRestaurantChatbotConversation: "Khách bắt đầu trò chuyện",
};

const riskySignalLabels = {
  FALLBACK_SPIKE: "Nhiều câu trả lời cần rà soát",
  NOT_HELPFUL_SPIKE: "Tăng phản hồi chưa hài lòng",
  PENDING_SUGGESTION_BACKLOG: "Gợi ý tri thức còn chờ duyệt",
  SAFETY_BLOCK_SPIKE: "Nhiều nội dung bị chặn an toàn",
};

const qualityQueueLabels = {
  fallback_response: "Câu trả lời cần rà soát",
  pending_suggestion: "Gợi ý bổ sung tri thức",
};
const messageRoleLabels = {
  assistant: "Phản hồi của chatbot",
  customer: "Tin nhắn từ khách",
  staff: "Nhân viên",
  manager: "Quản lý",
  system: "Hệ thống",
};

const signalLevelLabels = {
  info: "Ổn định",
  low: "Mức thấp",
  warning: "Cần chú ý",
  medium: "Cần chú ý",
  critical: "Ưu tiên cao",
  danger: "Ưu tiên cao",
  high: "Ưu tiên cao",
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
  return labels[normalized] || intent || "Chủ đề khác";
};

const qualityItemTitle = (item) =>
  qualityQueueLabels[item?.type] || "Nội dung cần xem lại";

const qualityItemDescription = (item) => {
  if (item?.type === "fallback_response") {
    return "Chatbot chưa có đủ tri thức để trả lời chắc chắn.";
  }
  if (item?.type === "pending_suggestion") {
    return "Khách hỏi nội dung chưa có trong kho tri thức.";
  }
  return "Nội dung này cần được kiểm tra để cải thiện chất lượng tư vấn.";
};

const qualityItemMeta = (item) => {
  const raw = `${item?.label || ""} ${item?.detail || ""}`.toLowerCase();
  if (raw.includes("menu")) return "Chủ đề: Thực đơn";
  if (raw.includes("booking") || raw.includes("reservation")) {
    return "Chủ đề: Đặt bàn";
  }
  if (raw.includes("order")) return "Chủ đề: Đơn hàng";
  if (raw.includes("coupon") || raw.includes("promotion")) {
    return "Chủ đề: Ưu đãi";
  }
  if (raw.includes("knowledge")) return "Nguồn: Thiếu nội dung phù hợp";
  return "Cần quản lý rà soát";
};

function EmptyReport() {
  return (
    <div className="ai-admin-empty ai-admin-empty--soft">
      <div className="ai-admin-empty__icon">•</div>
      <h4>Chưa đủ dữ liệu để tạo báo cáo</h4>
      <p>Khi khách bắt đầu trò chuyện, biểu đồ sẽ được cập nhật tự động.</p>
    </div>
  );
}

export default function AiChatbotAnalyticsPage() {
  const [range, setRange] = useState("7");
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

  return (
    <section className="customer-analytics-page ai-admin-page ai-admin-page--analytics">
      <section className="customer-analytics-hero ai-admin-hero ai-admin-report-summary">
        <div className="ai-admin-hero__copy">
          <p className="customer-analytics-hero__eyebrow ai-admin-eyebrow">
            Hiệu quả tư vấn
          </p>
          <h2>Báo cáo Chatbot AI</h2>
          <p>
            Theo dõi chất lượng tư vấn, nhu cầu chuyển nhân viên và các nội dung cần cải thiện.
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
              <span>Tin nhắn AI</span>
              <strong>{formatNum(m.totalMessages)}</strong>
              <small>
                {m.averageMessagesPerConversation == null
                  ? "Tin nhắn trong kỳ"
                  : `${Number(m.averageMessagesPerConversation).toFixed(1)} tin / cuộc`}
              </small>
            </article>
            <article>
              <span>Yêu cầu chuyển nhân viên</span>
              <strong>{formatNum(m.handoffRequested)}</strong>
              <small>{formatPct(m.handoffConversionRate)} tỷ lệ chuyển</small>
            </article>
            <article>
              <span>Cần rà soát</span>
              <strong>{formatNum(reviewCount)}</strong>
              <small>{formatNum(m.notHelpfulFeedback)} phản hồi chưa hài lòng</small>
            </article>
          </div>

          {reviewItems.length ? (
            <details className="ai-admin-review-popover">
              <summary>
                <span className="ai-admin-chip ai-admin-chip--warning">
                  {formatNum(reviewItems.length)} mục cần rà soát
                </span>
                <span className="ai-admin-review-popover__title">Việc cần rà soát</span>
                <span className="ai-admin-review-popover__hint">
                  {reviewPreviewItems.map((item) => qualityItemTitle(item)).join(" · ")}
                </span>
                <span className="ai-admin-review-popover__action">Mở danh sách</span>
              </summary>
              <div className="ai-admin-review-popover__panel">
                <div className="ai-admin-review-popover__header">
                  <div>
                    <p className="ai-admin-eyebrow">Quality review</p>
                    <h3>Việc cần rà soát</h3>
                    <p>Danh sách nội dung cần kiểm tra để cải thiện chất lượng tư vấn.</p>
                  </div>
                  <span>Nhấn lại thanh tiêu đề để thu gọn</span>
                </div>
                <ul className="ai-admin-review-list__items ai-admin-review-list__items--popover">
                  {reviewItems.map((it) => (
                    <li key={it.id} className="ai-admin-review-item">
                      <div>
                        <span className="ai-admin-chip ai-admin-chip--warning">
                          {qualityQueueLabels[it.type] || "Cần rà soát"}
                        </span>
                        <h4>{qualityItemTitle(it)}</h4>
                        <p>{qualityItemDescription(it)}</p>
                        <small className="ai-admin-review-item__meta">
                          {qualityItemMeta(it)}
                        </small>
                      </div>
                      <time dateTime={it.createdAt}>{formatDate(it.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          <section className="ai-admin-insight-grid">
            <article className="customer-analytics-panel ai-admin-control-card">
              <header className="ai-analytics-card__header">
                <h3>Chủ đề khách hỏi nhiều</h3>
                <p>Những nhóm câu hỏi nổi bật trong kỳ báo cáo.</p>
              </header>
              {m.topIntents?.length ? (
                <ul className="ai-analytics-list ai-analytics-list--bars">
                  {m.topIntents.slice(0, 6).map((it) => (
                    <li key={it.intent} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        Chủ đề: {intentLabel(it.intent)}
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
                <h3>Nguồn tin nhắn</h3>
                <p>Khách, chatbot và nhân viên đóng góp vào hội thoại như thế nào.</p>
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
                <h3>Giới hạn sử dụng</h3>
                <p>Các mức kiểm soát để hệ thống vận hành ổn định.</p>
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
                <h3>Tín hiệu cần chú ý</h3>
                <p>Ưu tiên xử lý những điểm có thể ảnh hưởng trải nghiệm khách.</p>
              </header>
              {m.riskySignals?.length ? (
                <ul className="ai-analytics-list">
                  {m.riskySignals.map((it) => (
                    <li key={it.code} className="ai-analytics-list__item">
                      <span className="ai-analytics-list__label">
                        {riskySignalLabels[it.code] || "Tín hiệu vận hành"}
                      </span>
                      <span className={`ai-admin-chip ${signalLevelClass(it.level)}`}>
                        {signalLevelLabels[String(it.level || "").toLowerCase()] || "Cần chú ý"} · {formatNum(it.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ai-admin-empty ai-admin-empty--soft">
                  <div className="ai-admin-empty__icon">✓</div>
                  <h4>Ổn định</h4>
                  <p>Chưa ghi nhận tín hiệu cần ưu tiên trong kỳ này.</p>
                </div>
              )}
            </article>
          </section>

          <details className="ai-admin-collapsible">
            <summary>Chi tiết kỹ thuật</summary>
            <div className="ai-admin-technical-grid">
              <span>Đã xử lý chuyển nhân viên: {formatNum(m.resolvedHandoffs)}</span>
              <span>Câu trả lời cần rà soát: {formatNum(m.fallbackResponses)}</span>
              <span>Độ chắc chắn thấp: {formatNum(m.lowConfidenceResponses)}</span>
              <span>Quy tắc an toàn đang bật: {formatNum(m.activeSafetyRules)}</span>
              <span>Bộ câu hỏi kiểm thử: {formatNum(m.evaluationCaseCount)}</span>
              <span>
                Thời gian xử lý TB: {m.averageHandoffResolutionMinutes == null ? "—" : `${Number(m.averageHandoffResolutionMinutes).toFixed(1)} phút`}
              </span>
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
