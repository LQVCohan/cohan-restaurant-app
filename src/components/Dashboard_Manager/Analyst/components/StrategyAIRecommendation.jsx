import React from "react";
import { Sparkles, TrendingUp, AlertOctagon, CheckCircle2 } from "lucide-react";
import "./StrategyAIRecommendation.scss";

const StrategyAIRecommendation = ({ topDish, feedbackSummary }) => {
  return (
    <div className="widget-card strategy-ai-widget">
      <div className="ai-header">
        <div className="ai-title">
          <div className="icon-pulse">
            <Sparkles size={20} color="#fff" />
          </div>
          <h3>Trợ Lý Phân Tích AI</h3>
        </div>
        <span className="badge-ai">Data</span>
      </div>

      <div className="ai-content">
        <div className="insight-card positive">
          <div className="icon-col">
            <TrendingUp size={20} />
          </div>
          <div className="text-col">
            <h4>Cơ Hội Tăng Trưởng</h4>
            <p>
              Món bán nổi bật hiện tại là <strong>{topDish?.dishName || "N/A"}</strong> với{" "}
              <strong>{topDish?.quantity || 0}</strong> suất.
            </p>
          </div>
        </div>

        <div className="insight-card negative">
          <div className="icon-col">
            <AlertOctagon size={20} />
          </div>
          <div className="text-col">
            <h4>Cảnh Báo Trải Nghiệm</h4>
            <p>
              Review tiêu cực gần đây: <strong>{feedbackSummary?.negative || 0}</strong> /{" "}
              <strong>{feedbackSummary?.total || 0}</strong>.
            </p>
          </div>
        </div>

        <div className="action-plan">
          <h4>Hành động đề xuất:</h4>
          <ul>
            <li>
              <CheckCircle2 size={16} className="check-icon" />
              <span>Đẩy upsell cho top dish trong khung giờ cao điểm.</span>
            </li>
            <li>
              <CheckCircle2 size={16} className="check-icon" />
              <span>Ưu tiên xử lý phản hồi rating thấp trong 24h.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StrategyAIRecommendation;
