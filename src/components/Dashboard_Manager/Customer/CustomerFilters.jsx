// src/pages/CustomerManagement/CustomerFilters.jsx
import React, { useMemo, useState } from "react";

const CATEGORY_META = {
  all: { label: "Tất cả", icon: "👥", cls: "bg-slate-100 text-slate-700" },
  vip: { label: "VIP", icon: "⭐", cls: "bg-amber-100 text-amber-800" },
  frequent: {
    label: "Thường xuyên",
    icon: "🔥",
    cls: "bg-indigo-100 text-indigo-800",
  },
  new: { label: "Mới", icon: "🆕", cls: "bg-emerald-100 text-emerald-800" },
};

const STATUS_META = {
  online: { label: "Đang online", dot: "bg-green-500" },
  ordering: { label: "Đang order", dot: "bg-blue-500" },
  away: { label: "Đang away", dot: "bg-yellow-500" },
  offline: { label: "Offline", dot: "bg-gray-400" },
};

const CATEGORY_KEYS = ["all", "vip", "frequent", "new"];
const STATUS_KEYS = ["online", "ordering", "away", "offline"];

const ToggleChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-slate-50",
    ].join(" ")}
  >
    {children}
  </button>
);

const CategoryPill = ({ id, active, onClick }) => {
  const meta = CATEGORY_META[id] || CATEGORY_META.all;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition",
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : `border-slate-200 ${meta.cls} hover:brightness-95`,
      ].join(" ")}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </button>
  );
};

const CustomerFilters = ({ onClose, onApplyFilters }) => {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState({
    online: true,
    away: true,
    offline: true,
    ordering: true,
  });

  const allOn = useMemo(() => Object.values(status).every(Boolean), [status]);
  const noneOn = useMemo(
    () => Object.values(status).every((v) => !v),
    [status]
  );

  const toggleStatus = (key) => setStatus((s) => ({ ...s, [key]: !s[key] }));

  const selectAllStatus = () =>
    setStatus({ online: true, away: true, offline: true, ordering: true });

  const clearAllStatus = () =>
    setStatus({ online: false, away: false, offline: false, ordering: false });

  const applyFilters = () => {
    onApplyFilters && onApplyFilters({ category, status });
    onClose && onClose();
  };

  const resetFilters = () => {
    setCategory("all");
    selectAllStatus();
    onApplyFilters &&
      onApplyFilters({
        category: "all",
        status: { online: true, away: true, offline: true, ordering: true },
      });
    onClose && onClose();
  };

  return (
    <aside className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header (sticky) */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
          Bộ lọc nâng cao
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition text-xl leading-none"
          aria-label="Đóng bộ lọc"
          title="Đóng"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 py-5 space-y-6">
        {/* Category */}
        <section>
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Loại khách hàng
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Lọc nhanh theo nhóm hành vi/giá trị.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_KEYS.map((k) => (
              <CategoryPill
                key={k}
                id={k}
                active={category === k}
                onClick={() => setCategory(k)}
              />
            ))}
          </div>
        </section>

        <div className="h-px bg-slate-200/80" />

        {/* Status */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Trạng thái
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn nhiều trạng thái cùng lúc.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ToggleChip active={allOn} onClick={selectAllStatus}>
                Chọn hết
              </ToggleChip>
              <ToggleChip active={noneOn} onClick={clearAllStatus}>
                Bỏ chọn
              </ToggleChip>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {STATUS_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleStatus(k)}
                className={[
                  "w-full flex items-center justify-between rounded-xl border px-3 py-2 transition",
                  status[k]
                    ? "bg-slate-50 border-blue-300"
                    : "bg-white border-slate-200 hover:border-blue-300",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={"w-2.5 h-2.5 rounded-full " + STATUS_META[k].dot}
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {STATUS_META[k].label}
                  </span>
                </div>
                <span
                  className={[
                    "text-xs font-bold px-2 py-0.5 rounded",
                    status[k]
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  {status[k] ? "Bật" : "Tắt"}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Footer (sticky) */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4">
        <div className="flex gap-3">
          <button
            onClick={resetFilters}
            className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition"
          >
            Đặt lại
          </button>
          <button
            onClick={applyFilters}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CustomerFilters;
