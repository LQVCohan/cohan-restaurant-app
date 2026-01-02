import React from "react";
import { Sparkles, TrendingUp, AlertOctagon, CheckCircle2 } from "lucide-react";
import "./StrategyAIRecommendation.scss";

const StrategyAIRecommendation = () => {
  return (
    <div className="widget-card strategy-ai-widget">
      {/* Header với Gradient Background */}
      <div className="ai-header">
        <div className="ai-title">
          <div className="icon-pulse">
            <Sparkles size={20} color="#fff" />
          </div>
          <h3>Trợ Lý Phân Tích AI</h3>
        </div>
        <span className="badge-ai">Beta</span>
      </div>

      <div className="ai-content">
        {/* Insight Tích cực */}
        <div className="insight-card positive">
          <div className="icon-col">
            <TrendingUp size={20} />
          </div>
          <div className="text-col">
            <h4>Cơ Hội Tăng Trưởng</h4>
            <p>
              Món <strong>"Bò Wagyu"</strong> đang có biên lợi nhuận cao nhất
              (Ngôi sao). Khách gọi món này thường gọi thêm{" "}
              <strong>"Rượu Vang Đỏ"</strong>.
            </p>
          </div>
        </div>

        {/* Insight Cảnh báo */}
        <div className="insight-card negative">
          <div className="icon-col">
            <AlertOctagon size={20} />
          </div>
          <div className="text-col">
            <h4>Cảnh Báo Vận Hành</h4>
            <p>
              Tỷ lệ hủy món hôm qua tăng <strong>15%</strong> vào khung 20h.
              Nguyên nhân chính: <strong>Hết nguyên liệu</strong>.
            </p>
          </div>
        </div>

        {/* Action Plan */}
        <div className="action-plan">
          <h4>Hành động đề xuất (24h tới):</h4>
          <ul>
            <li>
              <CheckCircle2 size={16} className="check-icon" />
              <span>Tạo Combo "Bò + Rượu" giảm 5% để đẩy doanh số.</span>
            </li>
            <li>
              <CheckCircle2 size={16} className="check-icon" />
              <span>Nhập thêm nguyên liệu Súp Cua trước 16h chiều nay.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StrategyAIRecommendation;
