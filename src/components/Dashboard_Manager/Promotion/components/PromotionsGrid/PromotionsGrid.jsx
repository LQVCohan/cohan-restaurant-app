import React from "react";
import { Plus, Ticket, Sparkles } from "lucide-react";
import PromotionCard from "../PromotionCard/PromotionCard"; // Đảm bảo đường dẫn đúng
import "./PromotionsGrid.scss";

const PromotionsGrid = ({ promotions, onEdit, onDelete, onDuplicate }) => {
  // --- 1. EMPTY STATE: Khi chưa có dữ liệu ---
  if (!promotions || promotions.length === 0) {
    return (
      <div className="promotions-empty-state">
        <div className="empty-content">
          <div className="icon-wrapper">
            <Ticket size={32} />
            <div className="sparkle-icon">
              <Sparkles size={16} />
            </div>
          </div>

          <h3 className="empty-title">Chưa có chương trình ưu đãi</h3>
          <p className="empty-desc">
            Tạo ngay chương trình khuyến mãi đầu tiên để thu hút khách hàng và
            gia tăng doanh số.
          </p>

          <button className="btn-create-first" onClick={() => onEdit()}>
            <Plus size={18} />
            <span>Tạo Khuyến Mãi Ngay</span>
          </button>
        </div>
      </div>
    );
  }

  // --- 2. GRID STATE: Hiển thị danh sách ---
  return (
    <div className="promotions-grid-container">
      {promotions.map((promotion) => (
        <PromotionCard
          key={promotion.id}
          promotion={promotion}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
};

export default PromotionsGrid;
