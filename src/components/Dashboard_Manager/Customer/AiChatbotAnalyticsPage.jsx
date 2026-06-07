import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./CustomerAnalyticsPage.scss";

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
      topIntents { intent count }
      messagesByRole { role count }
      rateLimitStatus { action max windowMs }
      pendingSuggestions
      notHelpfulFeedback
      activeSafetyRules
      evaluationCaseCount
      riskySignals { code level count }
      recentQualityQueue { id type label detail createdAt }
    }
  }
`;

const daysAgoIso = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const formatPct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const formatNum = (v) => new Intl.NumberFormat("vi-VN").format(Number(v || 0));

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

  const variables = useMemo(() => ({
    input: {
      restaurantId: effectiveRestaurantId || null,
      from: daysAgoIso(Number(range || 7)),
      to: new Date().toISOString(),
      groupBy: "none",
    },
  }), [effectiveRestaurantId, range]);

  const { data, loading, error, refetch } = useQuery(GET_AI_CHATBOT_ANALYTICS, {
    skip: !effectiveRestaurantId,
    variables,
    fetchPolicy: "network-only",
  });

  const m = data?.aiChatbotAnalytics;

  return (
    <section className="customer-analytics-page">
      <section className="customer-analytics-hero">
        <div>
          <p className="customer-analytics-hero__eyebrow">AI Chatbot Analytics</p>
          <h2>AI Chatbot Analytics</h2>
          <p>Theo dõi mức sử dụng chatbot, handoff và chất lượng phản hồi theo dạng tổng hợp.</p>
        </div>

        <div className="customer-analytics-toolbar">
          <label className="customer-analytics-field">
            <span>Nhà hàng</span>
            <select value={effectiveRestaurantId} onChange={(e) => setSelectedRestaurantId(e.target.value)} disabled={restaurantsLoading || !hasRestaurants}>
              <option value="">{restaurantsLoading ? "Đang tải nhà hàng..." : "Chọn nhà hàng"}</option>
              {restaurantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="customer-analytics-field">
            <span>Khoảng thời gian</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">7 ngày</option>
              <option value="30">30 ngày</option>
            </select>
          </label>
          <button type="button" className="customer-analytics-refresh" onClick={() => refetch?.()} disabled={loading || !effectiveRestaurantId}>Làm mới</button>
        </div>
      </section>

      {!effectiveRestaurantId && !restaurantsLoading ? <section className="customer-empty-state customer-empty-state--page"><h3>Chọn nhà hàng để xem thống kê AI chatbot</h3></section> : null}
      {(restaurantsLoading || loading) ? <section className="customer-empty-state customer-empty-state--page"><h3>Đang tải dữ liệu AI chatbot...</h3></section> : null}
      {error ? <section className="customer-analytics-error"><span>{error.message || "Không thể tải thống kê AI chatbot"}</span><button type="button" onClick={() => refetch?.()}>Thử lại</button></section> : null}

      {!loading && !error && m ? (
        <>
          <div className="customer-analytics-overview-grid">
            <article className="customer-overview-card"><h4>Cuộc trò chuyện AI</h4><p>{formatNum(m.totalConversations)}</p></article>
            <article className="customer-overview-card"><h4>Tin nhắn AI</h4><p>{formatNum(m.totalMessages)}</p></article>
            <article className="customer-overview-card"><h4>Đang chat AI</h4><p>{formatNum(m.openConversations)}</p></article>
            <article className="customer-overview-card"><h4>Handoff đang xử lý</h4><p>{formatNum(m.handoffRequested)}</p></article>
            <article className="customer-overview-card"><h4>Handoff đã xử lý</h4><p>{formatNum(m.resolvedHandoffs)}</p></article>
            <article className="customer-overview-card"><h4>Fallback / low confidence</h4><p>{formatNum(m.fallbackResponses)} / {formatNum(m.lowConfidenceResponses)}</p></article>
            <article className="customer-overview-card"><h4>Tỷ lệ chuyển handoff</h4><p>{formatPct(m.handoffConversionRate)}</p></article>
            <article className="customer-overview-card"><h4>Pending suggestions</h4><p>{formatNum(m.pendingSuggestions)}</p></article>
            <article className="customer-overview-card"><h4>Not helpful feedback</h4><p>{formatNum(m.notHelpfulFeedback)}</p></article>
            <article className="customer-overview-card"><h4>Active safety rules</h4><p>{formatNum(m.activeSafetyRules)}</p></article>
            <article className="customer-overview-card"><h4>Evaluation cases</h4><p>{formatNum(m.evaluationCaseCount)}</p></article>
            <article className="customer-overview-card"><h4>Thời gian xử lý handoff TB</h4><p>{m.averageHandoffResolutionMinutes == null ? "—" : `${Number(m.averageHandoffResolutionMinutes).toFixed(1)} phút`}</p></article>
          </div>

          <section className="customer-analytics-layout-grid">
            <article className="customer-analytics-panel">
              <h3>Top intents</h3>
              {m.topIntents?.length ? m.topIntents.map((it) => <div key={it.intent}>{it.intent}: {formatNum(it.count)}</div>) : <p>Không có dữ liệu</p>}
            </article>
            <article className="customer-analytics-panel">
              <h3>Messages by role</h3>
              {m.messagesByRole?.length ? m.messagesByRole.map((it) => <div key={it.role}>{it.role}: {formatNum(it.count)}</div>) : <p>Không có dữ liệu</p>}
            </article>
            <article className="customer-analytics-panel">
              <h3>Rate-limit policy/config</h3>
              {m.rateLimitStatus?.length ? m.rateLimitStatus.map((it) => <div key={it.action}>{it.action}: {it.max}/{it.windowMs}ms</div>) : <p>Không có dữ liệu</p>}
            </article>
            <article className="customer-analytics-panel">
              <h3>Risky signals</h3>
              {m.riskySignals?.length ? m.riskySignals.map((it) => <div key={it.code}>{it.code}: {it.level} ({formatNum(it.count)})</div>) : <p>Không có dữ liệu</p>}
            </article>
            <article className="customer-analytics-panel">
              <h3>Recent quality queue</h3>
              {m.recentQualityQueue?.length ? m.recentQualityQueue.map((it) => <div key={it.id}>{it.type}: {it.label}</div>) : <p>Không có dữ liệu</p>}
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}
