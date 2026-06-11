import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./CustomerAnalyticsPage.scss";
import "./AiChatbotAdmin.scss";

const GET_AI_CHATBOT_ANALYTICS = gql`
  query AiChatbotAnalytics($input: AiChatbotAnalyticsInput!) {
    aiChatbotAnalytics(input: $input) {
      totalConversations totalMessages openConversations handoffRequested resolvedHandoffs fallbackResponses lowConfidenceResponses handoffConversionRate averageMessagesPerConversation averageHandoffResolutionMinutes pendingSuggestions notHelpfulFeedback activeSafetyRules evaluationCaseCount
      topIntents { intent count }
      messagesByRole { role count }
      rateLimitStatus { action max windowMs }
      riskySignals { code level count }
      recentQualityQueue { id type label detail createdAt }
    }
  }
`;

const RANGE_OPTIONS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
];
const daysAgoIso = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const formatPct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const formatNum = (v) => new Intl.NumberFormat("vi-VN").format(Number(v || 0));
const formatWindowMs = (windowMs) => {
  const ms = Number(windowMs || 0);
  if (ms < 60000) return `${Math.round(ms / 1000)} giây`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} phút`;
  return `${Math.round(ms / 3600000)} giờ`;
};
const normalizePermission = (value) => String(value || "").trim().toLowerCase();
const collectPermissionCodes = (user = {}) => {
  const set = new Set();
  const add = (permission) => {
    if (!permission) return;
    if (typeof permission === "string") set.add(normalizePermission(permission));
    else set.add(normalizePermission(permission.code || permission.permissionCode || permission.slug || permission.name));
  };
  [user.permissions, user.permissionCodes, user.effectivePermissions, user.effectivePermissionCodes, user.role?.permissions, user.role?.directPermissions, user.role?.parentRole?.permissions]
    .forEach((list) => Array.isArray(list) && list.forEach(add));
  return set;
};
const hasPermission = (user, permission) => {
  const codes = collectPermissionCodes(user);
  return codes.has("*") || codes.has(normalizePermission(permission));
};
const rateLimitLabels = { askAiChatbot: "Hỏi AI", requestRestaurantChatbotHandoff: "Yêu cầu nhân viên hỗ trợ", sendRestaurantChatbotHandoffMessage: "Gửi tin nhắn khách", submitAiChatbotAnswerFeedback: "Phản hồi AI cho khách", joinRestaurantChatbotConversation: "Tham gia hội thoại" };
const riskySignalLabels = { FALLBACK_SPIKE: "Tăng câu trả lời chưa chắc chắn", NOT_HELPFUL_SPIKE: "Tăng phản hồi chưa hài lòng", PENDING_SUGGESTION_BACKLOG: "Gợi ý tri thức còn tồn đọng", SAFETY_BLOCK_SPIKE: "Tăng lượt chặn an toàn" };
const qualityQueueLabels = { fallback_response: "Câu trả lời cần rà soát", pending_suggestion: "Gợi ý tri thức mới", not_helpful_feedback: "Feedback không hữu ích" };

const navigateQualityQueue = (item) => {
  const tab = item?.type === "not_helpful_feedback" ? "feedback" : item?.type === "pending_suggestion" ? "suggestions" : "knowledge";
  window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: "ai-chatbot-knowledge", query: { tab, focus: item?.id, type: item?.type }, source: "ai-chatbot-analytics" } }));
};

export default function AiChatbotAnalyticsPage() {
  const { user } = useContext(AuthContext) || {};
  const canReadAnalytics = hasPermission(user, "ai.chatbot.analytics.read") || hasPermission(user, "ai.chatbot.read");
  const [range, setRange] = useState("7");
  const { restaurantOptions, selectedRestaurantId, setSelectedRestaurantId, restaurantsLoading, hasRestaurants } = useManagerRestaurantSelection();
  const effectiveRestaurantId = selectedRestaurantId;
  const variables = useMemo(() => ({ input: { restaurantId: effectiveRestaurantId || null, from: daysAgoIso(Math.min(Number(range || 7), 90)), to: new Date().toISOString(), groupBy: "none" } }), [effectiveRestaurantId, range]);
  const { data, loading, error, refetch } = useQuery(GET_AI_CHATBOT_ANALYTICS, { skip: !effectiveRestaurantId || !canReadAnalytics, variables, fetchPolicy: "network-only" });
  const m = data?.aiChatbotAnalytics;

  if (!canReadAnalytics) {
    return <section className="customer-analytics-page ai-admin-page ai-admin-page--analytics"><section className="customer-empty-state customer-empty-state--page"><h3>Không có quyền xem AI chatbot analytics</h3><p>Bạn cần quyền ai.chatbot.analytics.read hoặc ai.chatbot.read.</p></section></section>;
  }

  return (
    <section className="customer-analytics-page ai-admin-page ai-admin-page--analytics">
      <section className="customer-analytics-hero ai-admin-hero"><div><p className="customer-analytics-hero__eyebrow ai-admin-eyebrow">Thống kê AI</p><h2>Phân tích Chatbot AI</h2><p>Theo dõi mức sử dụng chatbot, handoff và chất lượng phản hồi theo dạng tổng hợp.</p></div><div className="customer-analytics-toolbar ai-admin-field--restaurant"><label className="customer-analytics-field"><span>Nhà hàng</span><select value={effectiveRestaurantId} onChange={(e) => setSelectedRestaurantId(e.target.value)} disabled={restaurantsLoading || !hasRestaurants}><option value="">{restaurantsLoading ? "Đang tải nhà hàng..." : "Chọn nhà hàng"}</option>{restaurantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="customer-analytics-field"><span>Khoảng thời gian</span><select value={range} onChange={(e) => setRange(e.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" className="customer-analytics-refresh" onClick={() => refetch?.()} disabled={loading || !effectiveRestaurantId}>Làm mới</button></div></section>
      {!effectiveRestaurantId && !restaurantsLoading ? <section className="customer-empty-state customer-empty-state--page"><h3>Chọn nhà hàng để xem thống kê AI chatbot</h3></section> : null}
      {restaurantsLoading || loading ? <section className="customer-empty-state customer-empty-state--page"><h3>Đang tải dữ liệu AI chatbot...</h3></section> : null}
      {error ? <section className="customer-analytics-error"><span>{error.message || "Không thể tải thống kê AI chatbot"}</span><button type="button" onClick={() => refetch?.()}>Thử lại</button></section> : null}
      {!loading && !error && m ? <><div className="customer-analytics-overview-grid ai-admin-metrics">{[
        ["Cuộc trò chuyện AI", m.totalConversations], ["Tin nhắn AI", m.totalMessages], ["Đang chat AI", m.openConversations], ["Handoff đang xử lý", m.handoffRequested], ["Handoff đã xử lý", m.resolvedHandoffs], ["Gợi ý chờ duyệt", m.pendingSuggestions], ["Phản hồi chưa hài lòng", m.notHelpfulFeedback], ["Quy tắc an toàn đang bật", m.activeSafetyRules], ["Bộ câu hỏi kiểm thử", m.evaluationCaseCount]
      ].map(([label, value]) => <article key={label} className="customer-overview-card ai-admin-analytics-card"><h4>{label}</h4><p>{formatNum(value)}</p></article>)}<article className="customer-overview-card ai-admin-analytics-card"><h4>Tỷ lệ chuyển handoff</h4><p>{formatPct(m.handoffConversionRate)}</p></article><article className="customer-overview-card ai-admin-analytics-card"><h4>Thời gian xử lý handoff TB</h4><p>{m.averageHandoffResolutionMinutes == null ? "—" : `${Number(m.averageHandoffResolutionMinutes).toFixed(1)} phút`}</p></article></div>
      <section className="customer-analytics-layout-grid"><article className="customer-analytics-panel ai-analytics-card"><header className="ai-analytics-card__header"><h3>Chủ đề được hỏi nhiều</h3><p>Các intent hàng đầu từ người dùng</p></header>{m.topIntents?.length ? <ul className="ai-analytics-list">{m.topIntents.map((it) => <li key={it.intent} className="ai-analytics-list__item"><span className="ai-analytics-list__label">{it.intent}</span><span className="ai-analytics-list__value">{formatNum(it.count)}</span></li>)}</ul> : <p className="ai-analytics-empty">Không có dữ liệu</p>}</article><article className="customer-analytics-panel ai-analytics-card"><header className="ai-analytics-card__header"><h3>Lượt nhắn theo nguồn</h3><p>Phân bố tin nhắn theo vai trò</p></header>{m.messagesByRole?.length ? <ul className="ai-analytics-list">{m.messagesByRole.map((it) => <li key={it.role} className="ai-analytics-list__item"><span className="ai-analytics-list__label">{it.role}</span><span className="ai-analytics-list__value">{formatNum(it.count)}</span></li>)}</ul> : <p className="ai-analytics-empty">Không có dữ liệu</p>}</article><article className="customer-analytics-panel ai-analytics-card"><header className="ai-analytics-card__header"><h3>Giới hạn sử dụng AI</h3><p>Rate limit policy</p></header>{m.rateLimitStatus?.length ? <ul className="ai-analytics-list">{m.rateLimitStatus.map((it) => <li key={it.action} className="ai-analytics-list__item"><span className="ai-analytics-list__label">{rateLimitLabels[it.action] || it.action}</span><span className="ai-analytics-list__value">{it.max} lượt / {formatWindowMs(it.windowMs)}</span></li>)}</ul> : <p className="ai-analytics-empty">Không có dữ liệu</p>}</article><article className="customer-analytics-panel ai-analytics-card"><header className="ai-analytics-card__header"><h3>Tín hiệu cần chú ý</h3><p>Các vấn đề cần xem xét</p></header>{m.riskySignals?.length ? <ul className="ai-analytics-list">{m.riskySignals.map((it) => <li key={it.code} className="ai-analytics-list__item"><span className="ai-analytics-list__label">{riskySignalLabels[it.code] || it.code}</span><span className="ai-analytics-list__value ai-analytics-list__value--warn">{it.level} ({formatNum(it.count)})</span></li>)}</ul> : <p className="ai-analytics-empty">Không có tín hiệu cảnh báo</p>}</article><article className="customer-analytics-panel ai-analytics-card ai-analytics-card--full"><header className="ai-analytics-card__header"><h3>Việc cần rà soát</h3><p>Danh sách chất lượng gần đây cần kiểm tra</p></header>{m.recentQualityQueue?.length ? <ul className="ai-analytics-list">{m.recentQualityQueue.map((it) => <li key={it.id} className="ai-analytics-list__item ai-analytics-list__item--detail"><div className="ai-analytics-list__detail"><span className="ai-analytics-list__label">{qualityQueueLabels[it.type] || it.type}</span><span className="ai-analytics-list__subtitle">{it.label}</span>{it.detail ? <p className="ai-analytics-list__preview">{it.detail}</p> : null}</div><button type="button" className="ai-admin-button--secondary" onClick={() => navigateQualityQueue(it)}>Xem xử lý</button><span className="ai-analytics-list__meta">{it.createdAt ? new Date(it.createdAt).toLocaleDateString("vi-VN") : "—"}</span></li>)}</ul> : <p className="ai-analytics-empty">Không có mục cần rà soát</p>}</article></section></> : null}
    </section>
  );
}
