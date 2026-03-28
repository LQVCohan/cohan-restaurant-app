import React from "react";
import { Sparkles, Clock3, Users2, BadgePercent, ShieldCheck } from "lucide-react";
import "./SmartPromotionEngineWidget.scss";

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const SmartPromotionEngineWidget = ({ engine, loading }) => {
  const summary = engine?.summary || {};
  const campaigns = engine?.campaigns || [];
  const topCampaigns = campaigns.slice(0, 3);

  return (
    <div className="widget-card smart-promotion-engine-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>Smart Promotion Engine V1</h3>
            <p>Đề xuất campaign theo giờ vắng, tệp khách, và bối cảnh vận hành</p>
          </div>
        </div>
        <span className={`meta-pill ${engine?.meta?.fallbackUsed ? "fallback" : "data"}`}>
          {engine?.meta?.fallbackUsed ? "Heuristic/Fallback" : "AI Enhanced"}
        </span>
      </div>

      {loading ? <div className="state-message">Đang phân tích chiến dịch khuyến mãi phù hợp...</div> : null}

      {!loading && !campaigns.length ? (
        <div className="state-message warning">Chưa đủ dữ liệu để đề xuất campaign rõ ràng.</div>
      ) : null}

      {!loading && campaigns.length ? (
        <>
          <div className="summary-row">
            <span>
              <Clock3 size={14} /> Cửa sổ cơ hội: <strong>{summary.topOpportunityWindow}</strong>
            </span>
            <span>
              <Users2 size={14} /> Segment ưu tiên: <strong>{summary.highestPrioritySegment}</strong>
            </span>
            <span>
              <BadgePercent size={14} /> Số campaign: <strong>{summary.recommendedCampaignCount}</strong>
            </span>
          </div>

          <div className="campaign-list">
            {topCampaigns.map((campaign) => (
              <div className="campaign-item" key={campaign.campaignKey}>
                <div className="item-head">
                  <strong>{campaign.title}</strong>
                  <span className={`priority ${campaign.priority}`}>{campaign.priority}</span>
                </div>
                <div className="item-sub">
                  {campaign.targetSegment} • {campaign.targetOrderType} •{" "}
                  {`${campaign.targetWindow.startHour}:00-${campaign.targetWindow.endHour}:00`}
                </div>
                <div className="item-kpi">
                  Orders +{formatNumber(campaign.expectedKpi?.expectedOrdersLiftPct)}% • Revenue +
                  {formatNumber(campaign.expectedKpi?.expectedRevenueLiftPct)}% • Conv +
                  {formatNumber(campaign.expectedKpi?.expectedConversionLiftPct)}%
                </div>
                <div className="item-rec">
                  {campaign.recommendation?.discountType} {formatNumber(campaign.recommendation?.discountValue)} •
                  min {formatNumber(campaign.recommendation?.minOrderValue)}đ
                </div>
                <div className="item-reason">{campaign.reason}</div>
                {campaign.guardrails?.length ? (
                  <div className="guardrail">
                    <ShieldCheck size={14} /> {campaign.guardrails[0]}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SmartPromotionEngineWidget;
