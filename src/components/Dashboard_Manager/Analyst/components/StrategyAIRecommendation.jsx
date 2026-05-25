import React, { useMemo } from "react";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import "./StrategyAIRecommendation.scss";

const shiftLabelMap = { morning: "ca sáng", afternoon: "ca chiều", evening: "ca tối" };
const formatShiftKey = (shiftKey = "") => {
  const [dateRaw, shiftRaw] = String(shiftKey).split("|");
  if (!dateRaw && shiftLabelMap[shiftRaw]) return shiftLabelMap[shiftRaw];
  if (!shiftRaw && shiftLabelMap[dateRaw]) return shiftLabelMap[dateRaw];
  const shiftLabel = shiftLabelMap[shiftRaw] || shiftLabelMap[dateRaw] || "ca làm việc";
  if (!dateRaw || !dateRaw.includes("-")) return shiftLabel;
  const [y, m, d] = dateRaw.split("-");
  const dateLabel = y && m && d ? `${d}/${m}` : dateRaw;
  return `${shiftLabel} ngày ${dateLabel}`;
};

const StrategyAIRecommendation = ({
  topDish,
  feedbackSummary,
  demandForecast,
  staffSchedulingAssistant,
  menuEngineeringAssistant,
  smartPromotionEngine,
}) => {
  const actions = useMemo(() => {
    const items = [];
    const underStaffedShifts = Number(staffSchedulingAssistant?.summary?.underStaffedShifts || 0);
    if (underStaffedShifts > 0) {
      items.push({
        priority: "high",
        title: "Có ca thiếu người",
        description: `${underStaffedShifts} ca thiếu người, ca rủi ro cao nhất: ${formatShiftKey(staffSchedulingAssistant?.summary?.highestRiskShift || "") || "N/A"}.`,
        action: "Kiểm tra gợi ý phân ca",
      });
    }

    const topCampaign = smartPromotionEngine?.campaigns?.[0];
    const confidence = Number(topCampaign?.expectedKpi?.confidence || 0);
    if (topCampaign && confidence >= 0.5) {
      items.push({
        priority: topCampaign.priority === "high" ? "high" : "medium",
        title: "Có campaign nên review",
        description: `${topCampaign.title} • Khung cơ hội ${smartPromotionEngine?.summary?.topOpportunityWindow || "N/A"}.`,
        action: "Xem Smart Promotion",
      });
    }

    const busiest = demandForecast?.summary?.busiestPeriods?.[0];
    if (busiest) {
      items.push({
        priority: "medium",
        title: "Chuẩn bị cho khung giờ cao điểm",
        description: `${busiest}. Chuẩn bị thêm ${demandForecast?.summary?.totalRecommendedPrep || 0} phần nguyên liệu theo gợi ý.`,
        action: "Xem dự báo nhu cầu",
      });
    }

    if (menuEngineeringAssistant?.recommendations?.[0]) {
      items.push({
        priority: "medium",
        title: "Có khuyến nghị menu",
        description: menuEngineeringAssistant.recommendations[0],
        action: "Xem Menu Engineering",
      });
    }

    const negative = Number(feedbackSummary?.negative || 0);
    const total = Number(feedbackSummary?.total || 0);
    if (negative > 0) {
      items.push({
        priority: total && negative / total >= 0.3 ? "high" : "medium",
        title: "Có phản hồi tiêu cực",
        description: `${negative}/${total} phản hồi là tiêu cực. Món nổi bật hiện tại: ${topDish?.dishName || "N/A"}.`,
        action: "Xem phản hồi",
      });
    }

    return items;
  }, [demandForecast, feedbackSummary, menuEngineeringAssistant, smartPromotionEngine, staffSchedulingAssistant, topDish]);

  return (
    <div className="widget-card strategy-ai-widget">
      <div className="ai-header">
        <div className="ai-title">
          <div className="icon-pulse">
            <Sparkles size={20} color="#fff" />
          </div>
          <h3>Trung tâm hành động</h3>
        </div>
      </div>
      <div className="ai-content">
        <p className="subtitle">Tổng hợp việc cần ưu tiên từ doanh thu, nhu cầu, nhân sự, menu và khuyến mãi.</p>
        {!actions.length ? (
          <div className="stable-state">Chưa có rủi ro vận hành nổi bật trong dữ liệu hiện tại.</div>
        ) : (
          <div className="action-plan">
            {actions.map((item, index) => (
              <div className={`action-item ${item.priority}`} key={`${item.title}-${index}`}>
                <div className="line-title">
                  {item.priority === "high" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <h4>{item.title}</h4>
                </div>
                <p>{item.description}</p>
                <span className="action-link">{item.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyAIRecommendation;
