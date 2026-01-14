// src/pages/CustomerManagement/CustomerFilters.jsx
import React, { useMemo, useState } from "react";
import {
  X,
  Filter,
  Users,
  Star,
  Zap,
  Sparkles,
  Check,
  Wifi,
  Coffee,
  LogOut,
  CircleSlash,
} from "lucide-react";
import "./CustomerFilters.scss";

// Định nghĩa Metadata với Icon component
const CATEGORY_META = {
  all: { label: "Tất cả", icon: <Users size={20} /> },
  vip: { label: "VIP", icon: <Star size={20} /> },
  frequent: { label: "Thường xuyên", icon: <Zap size={20} /> },
  new: { label: "Mới", icon: <Sparkles size={20} /> },
};

const STATUS_META = {
  online: { label: "Online", color: "#22c55e", icon: <Wifi size={14} /> }, // Green
  ordering: {
    label: "Đang gọi món",
    color: "#3b82f6",
    icon: <Coffee size={14} />,
  }, // Blue
  away: { label: "Tạm vắng", color: "#eab308", icon: <LogOut size={14} /> }, // Yellow
  offline: {
    label: "Offline",
    color: "#94a3b8",
    icon: <CircleSlash size={14} />,
  }, // Slate
};

const CATEGORY_KEYS = Object.keys(CATEGORY_META);
const STATUS_KEYS = Object.keys(STATUS_META);

const CustomerFilters = ({ onClose, onApplyFilters }) => {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState({
    online: true,
    ordering: true,
    away: true,
    offline: true,
  });

  // Helpers logic
  const toggleStatus = (key) =>
    setStatus((prev) => ({ ...prev, [key]: !prev[key] }));

  const setAllStatus = (isActive) => {
    const newStatus = {};
    STATUS_KEYS.forEach((k) => (newStatus[k] = isActive));
    setStatus(newStatus);
  };

  const handleApply = () => {
    onApplyFilters && onApplyFilters({ category, status });
    onClose && onClose();
  };

  const handleReset = () => {
    setCategory("all");
    setAllStatus(true);
    onApplyFilters &&
      onApplyFilters({
        category: "all",
        status: { online: true, ordering: true, away: true, offline: true },
      });
  };

  return (
    <aside className="customer-filters">
      {/* Header */}
      <div className="cf-header">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-blue-600" />
          <h3>Bộ lọc nâng cao</h3>
        </div>
        <button onClick={onClose} className="cf-close-btn" title="Đóng">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="cf-body">
        {/* Section: Loại khách hàng */}
        <section>
          <div className="cf-section-title">Loại khách hàng</div>
          <div className="cf-section-desc">
            Phân loại theo mức độ thân thiết
          </div>
          <div className="cf-cat-grid">
            {CATEGORY_KEYS.map((key) => {
              const meta = CATEGORY_META[key];
              const isActive = category === key;
              return (
                <div
                  key={key}
                  className={`cf-cat-item ${isActive ? "active" : ""}`}
                  onClick={() => setCategory(key)}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="h-px bg-slate-100" />

        {/* Section: Trạng thái */}
        <section>
          <div className="cf-section-title">Trạng thái hoạt động</div>
          <div className="cf-status-actions">
            <button className="cf-link-btn" onClick={() => setAllStatus(true)}>
              Chọn tất cả
            </button>
            <button
              className="cf-link-btn sub"
              onClick={() => setAllStatus(false)}
            >
              Bỏ chọn
            </button>
          </div>

          <div className="cf-status-list">
            {STATUS_KEYS.map((key) => {
              const meta = STATUS_META[key];
              const isChecked = status[key];
              return (
                <div
                  key={key}
                  className="cf-status-row"
                  onClick={() => toggleStatus(key)}
                >
                  <div className="cf-status-info">
                    <div
                      className="cf-dot"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span>{meta.label}</span>
                  </div>

                  {/* Custom Checkbox UI */}
                  <div className={`cf-checkbox ${isChecked ? "checked" : ""}`}>
                    {isChecked && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="cf-footer">
        <div className="cf-btn-group">
          <button className="btn-reset" onClick={handleReset}>
            Đặt lại
          </button>
          <button className="btn-apply" onClick={handleApply}>
            Áp dụng
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CustomerFilters;
