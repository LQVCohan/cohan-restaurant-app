import React from "react";
import { Sparkles, Clock3, Users2, BadgePercent, ShieldCheck, TicketPercent } from "lucide-react";
import "./SmartPromotionEngineWidget.scss";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value || 0));
const tokenMap = {
  new: "Khách mới",
  often: "Khách quay lại thường xuyên",
  vip: "Khách VIP",
  dine_in: "Tại quán",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
  medium: "Trung bình",
  high: "Cao",
  low: "Thấp",
  active_now: "Đang còn hiệu lực",
  segment_fit: "Phù hợp nhóm khách mục tiêu",
  scope_fit: "Phù hợp với phạm vi áp dụng",
  aov_missing: "Thiếu dữ liệu giá trị đơn trung bình",
  usage_capacity_ok: "Còn lượt sử dụng",
  stacking_guardrail_fit: "Không vượt giới hạn cộng dồn",
  discount_type_match: "Loại ưu đãi phù hợp",
  existing_promotion: "Khuyến mãi đang có",
  existing_coupon: "Voucher đang có",
};
const priorityMap = { HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp" };
const discountTypeMap = { PERCENT: "Giảm theo %", FIXED: "Giảm số tiền", BOGO: "Mua tặng", COMBO: "Combo" };
const orderTypeMap = { OFFLINE: "Tại quán", DELIVERY: "Giao hàng", TAKEAWAY: "Mang đi", ORDER: "Đơn hàng" };
const getTokenLabel = (value, fallback = "") => {
  const cleaned = String(value || "").trim().toLowerCase();
  return tokenMap[cleaned] || fallback;
};

const normalizeOrderType = (value) =>
  orderTypeMap[String(value || "").toUpperCase()] ||
  getTokenLabel(value) ||
  "Loại đơn cần kiểm tra";

const normalizePriority = (value) =>
  priorityMap[String(value || "").toUpperCase()] ||
  getTokenLabel(value) ||
  "Trung bình";

const normalizeSegment = (value) =>
  getTokenLabel(value) ||
  "Nhóm khách cần kiểm tra";

const normalizeToken = (token = "") => {
  const cleaned = token.trim().toLowerCase();
  if (!cleaned) return "";
  if (tokenMap[cleaned]) return tokenMap[cleaned];
  if (cleaned.includes("existing_promotion") || cleaned.includes("existing_coupon")) return "";
  if (/^[a-z]+(_[a-z]+)+$/.test(cleaned) || /^[a-z_]+$/.test(cleaned)) return "Có thể áp dụng với điều kiện hiện tại";
  return token.trim();
};
const normalizeText = (value = "") =>
  String(value)
    .split(/[+,•]/)
    .flatMap((item) => item.split(","))
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
    .join(", ");
const roleTarget = (segment) => normalizeText(segment) || "Khách có khả năng quay lại";
const methodLabel = (method = "") => ({
  smart_promo_v1: "Dựa trên đơn hàng và voucher hiện có",
}[method] || "Dựa trên dữ liệu khuyến mãi");

const MetaStrip = ({ meta }) => meta ? (
  <div className="ai-meta-strip">
    {(meta.lowDataFallbackUsed || meta.fallbackUsed) ? <span className="verify-badge">Cần kiểm tra lại</span> : null}
    <span>{methodLabel(meta.method)}</span>
    <span>{meta.sampleOrders ?? "-"} đơn trong {meta.sampleDays ?? "-"} ngày</span>
    {meta.generatedAt ? <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span> : null}
  </div>
) : null;

const SmartPromotionEngineWidget = ({ engine, loading, onNavigate }) => {
  const summary = engine?.summary || {};
  const campaigns = engine?.campaigns || [];
  const topCampaigns = campaigns.slice(0, 3);
  const selectedPromotions = (engine?.autoSelectedPromotions || []).slice(0, 3);

  return (
    <div className="widget-card smart-promotion-engine-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap"><Sparkles size={18} /></div>
          <div><h3>Gợi ý khuyến mãi thông minh</h3><p>Đề xuất chiến dịch theo giờ vắng, tệp khách và bối cảnh vận hành</p></div>
        </div>
        <button type="button" className="meta-pill data" onClick={() => onNavigate?.("promotions")}>
          Mở khuyến mãi
        </button>
      </div>
      <MetaStrip meta={engine?.meta} />

      {loading ? <div className="state-message">Đang phân tích chiến dịch khuyến mãi phù hợp...</div> : null}
      {!loading && !campaigns.length ? <div className="state-message warning">Chưa đủ dữ liệu để đề xuất chiến dịch rõ ràng.</div> : null}
      {!loading && Number(engine?.meta?.sampleOrders || 0) < 20 ? <div className="state-message warning">Dữ liệu đơn hàng còn ít, nên kiểm tra thủ công trước khi áp dụng.</div> : null}

      {!loading && campaigns.length ? (
        <>
          <div className="summary-row">
            <span><Clock3 size={14} /> Cửa sổ cơ hội: <strong>{summary.topOpportunityWindow}</strong></span>
            <span><Users2 size={14} /> Nhóm khách ưu tiên: <strong>{normalizeSegment(summary.highestPrioritySegment)}</strong></span>
            <span><BadgePercent size={14} /> Số chiến dịch: <strong>{summary.recommendedCampaignCount}</strong></span>
          </div>

          <div className="coupon-context">
            <span>Voucher hoạt động: <strong>{engine?.couponContext?.activeCouponCount || 0}</strong></span>
            <span>Voucher gần giới hạn: <strong>{engine?.couponContext?.nearUsageLimitCount || 0}</strong></span>
          </div>

          <div className="campaign-list">
            {topCampaigns.map((campaign) => {
              const windowLabel = campaign?.targetWindow
                ? `${campaign.targetWindow.startHour}:00-${campaign.targetWindow.endHour}:00`
                : "Khung giờ cần kiểm tra";
              return (
              <div className="campaign-item" key={campaign.campaignKey}>
                <div className="item-head"><strong>{campaign.title}</strong><span className={`priority ${(campaign.priority || "").toLowerCase()}`}>{normalizePriority(campaign.priority)}</span></div>
                <div className="item-sub">{normalizeOrderType(campaign.targetOrderType)} • {windowLabel}</div>
                <div className="group-line"><strong>Mục tiêu:</strong> Tăng đơn +{formatNumber(campaign.expectedKpi?.expectedOrdersLiftPct)}%, doanh thu +{formatNumber(campaign.expectedKpi?.expectedRevenueLiftPct)}%.</div>
                <div className="group-line"><strong>Nhóm khách:</strong> {roleTarget(campaign.targetSegment)}.</div>
                <div className="group-line"><strong>Ưu đãi đề xuất:</strong> {discountTypeMap[campaign.recommendation?.discountType] || campaign.recommendation?.discountType} {formatNumber(campaign.recommendation?.discountValue)} • Đơn tối thiểu {formatNumber(campaign.recommendation?.minOrderValue)}đ • Giảm tối đa {formatNumber(campaign.recommendation?.maxDiscount)}đ.</div>
                {!!campaign.recommendation?.conditions?.length ? <div className="group-line"><strong>Điều kiện áp dụng:</strong> {campaign.recommendation.conditions.slice(0, 2).map(normalizeText).join(" • ")}.</div> : null}
                <div className="group-line"><strong>Lưu ý:</strong> {normalizeText(campaign.reason || "Theo dõi KPI sau 24h để tinh chỉnh chiến dịch")}.</div>
                {campaign.expectedKpi?.confidence != null ? <div className="group-line"><strong>Độ tin cậy:</strong> {formatNumber(campaign.expectedKpi.confidence)}</div> : null}
                {campaign.guardrails?.length ? <div className="guardrail"><ShieldCheck size={14} /> {normalizeText(campaign.guardrails[0])}</div> : null}
              </div>
            );})}
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
