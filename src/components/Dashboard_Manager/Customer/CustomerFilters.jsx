// src/pages/CustomerManagement/CustomerFilters.jsx
import React, { useState } from "react";
import {
  X,
  Filter,
  Users,
  Star,
  Zap,
  Sparkles,
  Check,
  Wifi,
  CircleSlash,
} from "lucide-react";
import "./CustomerFilters.scss";

const CATEGORY_META = {
  all: { label: "Tất cả", icon: <Users size={20} /> },
  vip: { label: "VIP", icon: <Star size={20} /> },
  frequent: { label: "Thân thiết", icon: <Zap size={20} /> },
  new: { label: "Mới", icon: <Sparkles size={20} /> },
};

const STATUS_META = {
  online: {
    label: "Đang trực tuyến",
    color: "#22c55e",
    icon: <Wifi size={14} />,
  },
  offline: {
    label: "Không trực tuyến",
    color: "#94a3b8",
    icon: <CircleSlash size={14} />,
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_META);
const STATUS_KEYS = Object.keys(STATUS_META);

const CustomerFilters = ({ onClose, onApplyFilters }) => {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState({
    online: true,
    offline: true,
  });

  const toggleStatus = (key) =>
    setStatus((prev) => ({ ...prev, [key]: !prev[key] }));

  const setAllStatus = (isActive) => {
    const newStatus = {};
    STATUS_KEYS.forEach((key) => {
      newStatus[key] = isActive;
    });
    setStatus(newStatus);
  };

  const handleApply = () => {
    onApplyFilters?.({ category, status });
    onClose?.();
  };

  const handleReset = () => {
    setCategory("all");
    setAllStatus(true);
    onApplyFilters?.({
      category: "all",
      status: { online: true, offline: true },
    });
  };

  return (
    <aside className="customer-filters">
      <div className="cf-header">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-blue-600" />
          <h3>Bộ lọc khách hàng</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cf-close-btn"
          title="Đóng bộ lọc"
          aria-label="Đóng bộ lọc khách hàng"
        >
          <X size={20} />
        </button>
      </div>

      <div className="cf-body">
        <section>
          <div className="cf-section-title">Hạng khách hàng</div>
          <div className="cf-section-desc">Lọc theo mức độ gắn bó</div>
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

        <section>
          <div className="cf-section-title">Trạng thái hoạt động</div>
          <div className="cf-status-actions">
            <button
              type="button"
              className="cf-link-btn"
              onClick={() => setAllStatus(true)}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              className="cf-link-btn sub"
              onClick={() => setAllStatus(false)}
            >
              Bỏ chọn tất cả
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

                  <div className={`cf-checkbox ${isChecked ? "checked" : ""}`}>
                    {isChecked && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="cf-footer">
        <div className="cf-btn-group">
          <button type="button" className="btn-reset" onClick={handleReset}>
            Đặt lại bộ lọc
          </button>
          <button type="button" className="btn-apply" onClick={handleApply}>
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CustomerFilters;
