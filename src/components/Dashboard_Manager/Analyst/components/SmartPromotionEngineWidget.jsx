import React from "react";
import { Sparkles, Clock3, Users2, BadgePercent, ShieldCheck, TicketPercent } from "lucide-react";
import "./SmartPromotionEngineWidget.scss";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value || 0));

const SmartPromotionEngineWidget = ({ engine, loading }) => {
  const summary = engine?.summary || {};
  const campaigns = engine?.campaigns || [];
  const topCampaigns = campaigns.slice(0, 3);
  const selectedPromotions = (engine?.autoSelectedPromotions || []).slice(0, 3);

  return (
    <div className="widget-card smart-promotion-engine-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap"><Sparkles size={18} /></div>
          <div><h3>Smart Promotion Engine</h3><p>Đề xuất campaign theo giờ vắng, tệp khách và bối cảnh vận hành</p></div>
        </div>
        <span className={`meta-pill ${engine?.meta?.fallbackUsed ? "fallback" : "data"}`}>{engine?.meta?.fallbackUsed ? "Heuristic/Fallback" : "AI Enhanced"}</span>
      </div>

      {loading ? <div className="state-message">Đang phân tích chiến dịch khuyến mãi phù hợp...</div> : null}
      {!loading && !campaigns.length ? <div className="state-message warning">Chưa đủ dữ liệu để đề xuất campaign rõ ràng.</div> : null}
      {!loading && Number(engine?.meta?.sampleOrders || 0) < 20 ? <div className="state-message warning">Dữ liệu còn ít, nên review thủ công trước khi chạy campaign.</div> : null}

      {!loading && campaigns.length ? (
        <>
          <div className="summary-row">
            <span><Clock3 size={14} /> Cửa sổ cơ hội: <strong>{summary.topOpportunityWindow}</strong></span>
            <span><Users2 size={14} /> Segment ưu tiên: <strong>{summary.highestPrioritySegment}</strong></span>
            <span><BadgePercent size={14} /> Số campaign: <strong>{summary.recommendedCampaignCount}</strong></span>
          </div>

          <div className="coupon-context">
            <span>Coupon hoạt động: <strong>{engine?.couponContext?.activeCouponCount || 0}</strong></span>
            <span>Coupon gần giới hạn: <strong>{engine?.couponContext?.nearUsageLimitCount || 0}</strong></span>
          </div>

          <div className="campaign-list">
            {topCampaigns.map((campaign) => (
              <div className="campaign-item" key={campaign.campaignKey}>
                <div className="item-head"><strong>{campaign.title}</strong><span className={`priority ${campaign.priority}`}>{campaign.priority}</span></div>
                <div className="item-sub">{campaign.targetSegment} • {campaign.targetOrderType} • {`${campaign.targetWindow.startHour}:00-${campaign.targetWindow.endHour}:00`}</div>
                <div className="item-rec">
                  {campaign.recommendation?.promotionType || "N/A"} • {campaign.recommendation?.scope || "N/A"} • {campaign.recommendation?.targetAudience || "N/A"}
                </div>
                <div className="item-kpi">Orders +{formatNumber(campaign.expectedKpi?.expectedOrdersLiftPct)}% • Revenue +{formatNumber(campaign.expectedKpi?.expectedRevenueLiftPct)}% • Conv +{formatNumber(campaign.expectedKpi?.expectedConversionLiftPct)}%</div>
                <div className="item-rec">{campaign.recommendation?.discountType} {formatNumber(campaign.recommendation?.discountValue)} • Min {formatNumber(campaign.recommendation?.minOrderValue)}đ • Max {formatNumber(campaign.recommendation?.maxDiscount)}đ • Stacking: {String(campaign.recommendation?.stacking)}</div>
                {!!campaign.recommendation?.conditions?.length ? <div className="conditions">Điều kiện: {campaign.recommendation.conditions.slice(0, 2).join(" • ")}</div> : null}
                <div className="item-reason">{campaign.reason}</div>
                {campaign.guardrails?.length ? <div className="guardrail"><ShieldCheck size={14} /> {campaign.guardrails[0]}</div> : null}
              </div>
            ))}
          </div>

          <div className="promo-block">
            <h4><TicketPercent size={15} /> Khuyến mãi/voucher có thể tận dụng</h4>
            {selectedPromotions.length ? selectedPromotions.map((promo, idx) => (
              <div className="promo-item" key={`${promo.promotionId || promo.promotionName}-${idx}`}>
                <strong>{promo.promotionName}</strong>
                <span>{promo.source}</span>
                <p>Fit score: {formatNumber(promo.fitScore)} • {promo.fitReason}</p>
              </div>
            )) : <div className="state-message">Chưa có khuyến mãi/voucher phù hợp để tận dụng.</div>}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SmartPromotionEngineWidget;
