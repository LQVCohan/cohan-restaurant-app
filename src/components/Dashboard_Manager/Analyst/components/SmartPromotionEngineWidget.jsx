import React from "react";
import {
  BadgePercent,
  ChevronDown,
  Clock3,
  Database,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Users2,
} from "lucide-react";
import "./SmartPromotionEngineWidget.scss";

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    Number(value || 0),
  );
const formatMoney = (value) => `${formatNumber(value)}đ`;
const formatScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return "Chưa có";
  return `${formatNumber(score <= 1 ? score * 100 : score)}%`;
};

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
  constraints_segment_fit: "Điều kiện phù hợp nhóm khách",
  scope_fit: "Phù hợp phạm vi áp dụng",
  min_order_fit: "Ngưỡng đơn phù hợp",
  aov_missing: "Thiếu dữ liệu giá trị đơn trung bình",
  usage_capacity_ok: "Còn lượt sử dụng",
  stacking_guardrail_fit: "Không cộng dồn ưu đãi",
  discount_type_match: "Loại ưu đãi phù hợp",
  general_fit: "Phù hợp dữ liệu hiện tại",
  existing_promotion: "Khuyến mãi đang có",
  existing_coupon: "Voucher đang có",
  off_peak_window: "Chỉ áp dụng trong giờ thấp điểm",
  threshold_aov: "Áp dụng khi đơn đạt ngưỡng",
  bundle_focus: "Ưu tiên theo combo",
  "off-peak": "Khung giờ thấp điểm",
};
const priorityMap = { HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp" };
const orderTypeMap = {
  OFFLINE: "Tại quán",
  DINE_IN: "Tại quán",
  DELIVERY: "Giao hàng",
  TAKEAWAY: "Mang đi",
  ORDER: "Đơn hàng",
};

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
  getTokenLabel(value) || "Nhóm khách cần kiểm tra";

const normalizeToken = (token = "") => {
  const cleaned = token.trim().toLowerCase();
  if (!cleaned) return "";
  if (tokenMap[cleaned]) return tokenMap[cleaned];
  if (cleaned.includes("existing_promotion") || cleaned.includes("existing_coupon")) {
    return "";
  }
  if (/^[a-z]+(_[a-z]+)+$/.test(cleaned) || /^[a-z_]+$/.test(cleaned)) {
    return "Có thể áp dụng với điều kiện hiện tại";
  }
  return token
    .trim()
    .replace(/conversion/gi, "tỷ lệ đặt món")
    .replace(/\bAOV\b/gi, "giá trị đơn trung bình")
    .replace(/stock risk/gi, "rủi ro tồn kho")
    .replace(/campaign/gi, "chiến dịch")
    .replace(/draft\/review/gi, "bản nháp và duyệt");
};

const normalizeText = (value = "") =>
  String(value)
    .split(/[+,•]/)
    .flatMap((item) => item.split(","))
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index)
    .join(", ");

const roleTarget = (segment) =>
  normalizeText(segment) || "Khách có khả năng quay lại";

const methodLabel = (method = "") =>
  ({
    smart_promo_v1: "Xếp hạng theo quy tắc dữ liệu",
  })[method] || "Phân tích dữ liệu khuyến mãi";

const formatWindow = (campaign) => {
  if (!campaign?.targetWindow) return "Khung giờ cần kiểm tra";
  const start = String(campaign.targetWindow.startHour ?? 0).padStart(2, "0");
  const end = String(campaign.targetWindow.endHour ?? 0).padStart(2, "0");
  return `${start}:00–${end}:00`;
};

const formatDiscount = (recommendation = {}) => {
  const type = String(recommendation.discountType || "").toUpperCase();
  const value = Number(recommendation.discountValue || 0);
  if (type === "PERCENT") return `Giảm ${formatNumber(value)}%`;
  if (["AMOUNT", "FIXED"].includes(type)) return `Giảm ${formatMoney(value)}`;
  if (type === "BOGO") return "Mua tặng";
  if (type === "COMBO") return "Ưu đãi combo";
  return "Mức giảm cần xác nhận";
};

const MetaStrip = ({ meta }) =>
  meta ? (
    <div className="ai-meta-strip">
      {meta.lowDataFallbackUsed || meta.fallbackUsed ? (
        <span className="verify-badge">Dữ liệu cần kiểm chứng</span>
      ) : null}
      <span>{methodLabel(meta.method)}</span>
      <span>
        {meta.sampleOrders ?? "-"} đơn / {meta.sampleDays ?? "-"} ngày
      </span>
      {meta.generatedAt ? (
        <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span>
      ) : null}
    </div>
  ) : null;

const CampaignCard = ({ campaign, featured = false }) => {
  const recommendation = campaign?.recommendation || {};
  const conditions = (recommendation.conditions || [])
    .slice(0, 2)
    .map(normalizeText)
    .filter(Boolean);

  return (
    <article className={`promotion-campaign${featured ? " is-featured" : ""}`}>
      {featured ? <span className="campaign-kicker">Đề xuất ưu tiên</span> : null}
      <div className="campaign-title-row">
        <div>
          <strong>{campaign.title}</strong>
          <span className="campaign-context">
            {normalizeOrderType(campaign.targetOrderType)} · {formatWindow(campaign)}
          </span>
        </div>
        <span className={`priority ${(campaign.priority || "").toLowerCase()}`}>
          {normalizePriority(campaign.priority)}
        </span>
      </div>

      <div className="campaign-kpis" aria-label="KPI dự kiến">
        <span>
          <small>Đơn dự kiến</small>
          <strong>+{formatNumber(campaign.expectedKpi?.expectedOrdersLiftPct)}%</strong>
        </span>
        <span>
          <small>Doanh thu</small>
          <strong>+{formatNumber(campaign.expectedKpi?.expectedRevenueLiftPct)}%</strong>
        </span>
        <span>
          <small>Độ tin cậy</small>
          <strong>{formatScore(campaign.expectedKpi?.confidence)}</strong>
        </span>
      </div>

      <div className="campaign-copy">
        <p>
          <strong>Nhóm khách:</strong> {roleTarget(campaign.targetSegment)}
        </p>
        <p>
          <strong>Ưu đãi:</strong> {formatDiscount(recommendation)} · Đơn từ{" "}
          {formatMoney(recommendation.minOrderValue)}
          {Number(recommendation.maxDiscount || 0) > 0
            ? ` · Tối đa ${formatMoney(recommendation.maxDiscount)}`
            : ""}
        </p>
        {conditions.length ? (
          <p>
            <strong>Điều kiện:</strong> {conditions.join(" · ")}
          </p>
        ) : null}
        <p>
          <strong>Cơ sở:</strong>{" "}
          {normalizeText(
            campaign.reason || "Theo dõi KPI sau 24 giờ để tinh chỉnh chiến dịch",
          )}
        </p>
      </div>

      {campaign.guardrails?.length ? (
        <div className="guardrail">
          <ShieldCheck size={15} />
          <span>{normalizeText(campaign.guardrails[0])}</span>
        </div>
      ) : null}
    </article>
  );
};

const SmartPromotionEngineWidget = ({ engine, loading, onNavigate }) => {
  const summary = engine?.summary || {};
  const campaigns = engine?.campaigns || [];
  const primaryCampaign = campaigns[0] || null;
  const secondaryCampaigns = campaigns.slice(1, 3);
  const selectedPromotions = (engine?.autoSelectedPromotions || []).slice(0, 3);
  const meta = engine?.meta || {};

  return (
    <div className="widget-card smart-promotion-engine-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>Gợi ý khuyến mãi</h3>
            <p>Ưu tiên chiến dịch theo giờ vắng, tệp khách và bối cảnh vận hành</p>
          </div>
        </div>
        <button
          type="button"
          className="meta-pill data"
          onClick={() => onNavigate?.("promotions")}
        >
          Mở khuyến mãi
        </button>
      </div>

      <MetaStrip meta={meta} />

      <div className="recommendation-source">
        <div className="source-icon" aria-hidden="true">
          <Database size={17} />
        </div>
        <div>
          <div className="source-title-row">
            <strong>Nguồn dữ liệu</strong>
            <span className="calculation-mode">
              {meta.aiEnhanced ? "AI chỉ diễn giải" : "Tính theo quy tắc"}
            </span>
          </div>
          <p>
            Đơn hàng {meta.sampleDays ?? 30} ngày, dự báo nhu cầu, phân khúc khách,
            khuyến mãi/voucher và tồn kho.
          </p>
          <small>
            {meta.aiEnhanced
              ? "AI chỉ chỉnh tiêu đề, lý do và cảnh báo; KPI, mức ưu tiên và mức giảm vẫn do công thức tính."
              : "Lần tính này không dùng AI; KPI, mức ưu tiên và mức giảm do công thức dữ liệu."}
          </small>
        </div>
      </div>

      {loading ? (
        <div className="state-message">Đang phân tích chiến dịch phù hợp...</div>
      ) : null}
      {!loading && !campaigns.length ? (
        <div className="state-message warning">
          Chưa đủ dữ liệu để đề xuất chiến dịch rõ ràng.
        </div>
      ) : null}
      {!loading && Number(meta.sampleOrders || 0) < 20 ? (
        <div className="state-message warning">
          Mẫu đơn còn ít. Hãy duyệt thủ công trước khi áp dụng mức giảm.
        </div>
      ) : null}

      {!loading && campaigns.length ? (
        <>
          <div className="promotion-summary" aria-label="Tóm tắt cơ hội">
            <span>
              <Clock3 size={15} />
              <small>Khung giờ</small>
              <strong>{summary.topOpportunityWindow || "Chưa xác định"}</strong>
            </span>
            <span>
              <Users2 size={15} />
              <small>Nhóm khách</small>
              <strong>{normalizeSegment(summary.highestPrioritySegment)}</strong>
            </span>
            <span>
              <BadgePercent size={15} />
              <small>Đề xuất</small>
              <strong>{summary.recommendedCampaignCount || campaigns.length}</strong>
            </span>
          </div>

          {primaryCampaign ? <CampaignCard campaign={primaryCampaign} featured /> : null}

          {secondaryCampaigns.length ? (
            <details className="recommendation-disclosure">
              <summary>
                <span>Xem {secondaryCampaigns.length} đề xuất còn lại</span>
                <ChevronDown size={17} />
              </summary>
              <div className="secondary-campaigns">
                {secondaryCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.campaignKey} campaign={campaign} />
                ))}
              </div>
            </details>
          ) : null}

          <details className="recommendation-disclosure voucher-disclosure">
            <summary>
              <span>
                <TicketPercent size={16} /> Voucher có thể tận dụng ({selectedPromotions.length})
              </span>
              <ChevronDown size={17} />
            </summary>
            <div className="reusable-promotions">
              {selectedPromotions.length ? (
                selectedPromotions.map((promotion, index) => (
                  <div
                    className="reusable-promotion"
                    key={`${promotion.promotionId || promotion.promotionName}-${index}`}
                  >
                    <div>
                      <strong>{promotion.promotionName}</strong>
                      <span>
                        {normalizeText(promotion.source) || "Ưu đãi hiện có"}
                      </span>
                    </div>
                    <p>
                      Phù hợp {formatScore(promotion.fitScore)} ·{" "}
                      {normalizeText(promotion.fitReason)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="state-message compact">
                  Chưa có khuyến mãi hoặc voucher phù hợp để tận dụng.
                </div>
              )}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
};

export default SmartPromotionEngineWidget;
