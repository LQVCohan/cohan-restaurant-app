import React from "react";
import { Sparkles, Clock3, Users2, BadgePercent, ShieldCheck, TicketPercent } from "lucide-react";
import "./SmartPromotionEngineWidget.scss";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value || 0));
const tokenMap = {
  active_now: "Đang còn hiệu lực",
  segment_fit: "Phù hợp nhóm khách mục tiêu",
  scope_fit: "Phù hợp phạm vi áp dụng",
  aov_missing: "Thiếu dữ liệu giá trị đơn trung bình",
  usage_capacity_ok: "Còn lượt sử dụng",
  stacking_guardrail_fit: "Phù hợp giới hạn cộng dồn",
  discount_type_match: "Loại ưu đãi phù hợp",
  existing_promotion: "Khuyến mãi đang có",
  existing_coupon: "Voucher đang có",
};
const priorityMap = { HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp" };
const discountTypeMap = { PERCENT: "Giảm theo %", FIXED: "Giảm số tiền", BOGO: "Mua tặng", COMBO: "Combo" };
const orderTypeMap = { OFFLINE: "Tại quán", DELIVERY: "Giao hàng", TAKEAWAY: "Mang đi", ORDER: "Đơn hàng" };
const normalizeToken = (token = "") => {
  const cleaned = token.trim().toLowerCase();
  if (!cleaned) return "";
  if (tokenMap[cleaned]) return tokenMap[cleaned];
  if (cleaned.includes("existing_promotion") || cleaned.includes("existing_coupon")) return "";
  return cleaned.replaceAll("_", " ");
};
const normalizeText = (value = "") =>
  String(value)
    .split(/[+,•]/)
    .flatMap((item) => item.split(","))
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .join(", ");
const roleTarget = (segment) => normalizeText(segment) || "Khách có khả năng quay lại";

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
                <div className="item-head"><strong>{campaign.title}</strong><span className={`priority ${(campaign.priority || "").toLowerCase()}`}>{priorityMap[campaign.priority] || campaign.priority}</span></div>
                <div className="item-sub">{orderTypeMap[campaign.targetOrderType] || campaign.targetOrderType} • {`${campaign.targetWindow.startHour}:00-${campaign.targetWindow.endHour}:00`}</div>
                <div className="group-line"><strong>Mục tiêu:</strong> Tăng đơn +{formatNumber(campaign.expectedKpi?.expectedOrdersLiftPct)}%, doanh thu +{formatNumber(campaign.expectedKpi?.expectedRevenueLiftPct)}%.</div>
                <div className="group-line"><strong>Nhóm khách:</strong> {roleTarget(campaign.targetSegment)}.</div>
                <div className="group-line"><strong>Ưu đãi đề xuất:</strong> {discountTypeMap[campaign.recommendation?.discountType] || campaign.recommendation?.discountType} {formatNumber(campaign.recommendation?.discountValue)} • Đơn tối thiểu {formatNumber(campaign.recommendation?.minOrderValue)}đ • Giảm tối đa {formatNumber(campaign.recommendation?.maxDiscount)}đ.</div>
                {!!campaign.recommendation?.conditions?.length ? <div className="group-line"><strong>Điều kiện áp dụng:</strong> {campaign.recommendation.conditions.slice(0, 2).map(normalizeText).join(" • ")}.</div> : null}
                <div className="group-line"><strong>Lưu ý an toàn:</strong> {normalizeText(campaign.reason || "Theo dõi KPI sau 24h để tinh chỉnh chiến dịch")}.</div>
                {campaign.guardrails?.length ? <div className="guardrail"><ShieldCheck size={14} /> {normalizeText(campaign.guardrails[0])}</div> : null}
              </div>
            ))}
          </div>

          <div className="promo-block">
            <h4><TicketPercent size={15} /> Khuyến mãi/voucher có thể tận dụng</h4>
            {selectedPromotions.length ? selectedPromotions.map((promo, idx) => (
              <div className="promo-item" key={`${promo.promotionId || promo.promotionName}-${idx}`}>
                <strong>{promo.promotionName}</strong>
                <span>{normalizeText(promo.source) || "Đề xuất từ dữ liệu hiện có"}</span>
                <p>Mức phù hợp: {formatNumber(promo.fitScore)} • {normalizeText(promo.fitReason)}</p>
              </div>
            )) : <div className="state-message">Chưa có khuyến mãi/voucher phù hợp để tận dụng.</div>}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SmartPromotionEngineWidget;
