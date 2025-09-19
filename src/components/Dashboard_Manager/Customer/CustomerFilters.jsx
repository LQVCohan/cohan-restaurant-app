import React, { useState } from "react";

const CustomerFilters = ({ onClose, onApplyFilters }) => {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState({
    online: true,
    away: true,
    offline: true,
    ordering: true,
  });

  const applyFilters = () => {
    const filters = {
      category,
      status,
    };
    onApplyFilters(filters);
    onClose();
  };

  const resetFilters = () => {
    setCategory("all");
    setStatus({
      online: true,
      away: true,
      offline: true,
      ordering: true,
    });
    onApplyFilters({ category: "all", status });
    onClose();
  };

  const toggleStatus = (statusKey) => {
    setStatus((prevStatus) => ({
      ...prevStatus,
      [statusKey]: !prevStatus[statusKey],
    }));
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Bộ Lọc Nâng Cao</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="font-medium text-gray-900">Loại Khách Hàng</h4>
        <div className="space-y-3">
          {["all", "vip", "frequent", "new"].map((cat) => (
            <label
              key={cat}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="radio"
                name="category"
                value={cat}
                checked={category === cat}
                onChange={(e) => setCategory(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">
                {cat === "all"
                  ? "Tất cả"
                  : cat === "vip"
                  ? "VIP"
                  : cat === "frequent"
                  ? "Thường xuyên"
                  : "Mới"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <h4 className="font-medium text-gray-900">Trạng Thái</h4>
        <div className="space-y-2">
          {["online", "away", "offline", "ordering"].map((statusKey) => (
            <label
              key={statusKey}
              className="flex items-center space-x-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={status[statusKey]}
                onChange={() => toggleStatus(statusKey)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    statusKey === "online"
                      ? "bg-green-500"
                      : statusKey === "away"
                      ? "bg-yellow-500"
                      : statusKey === "offline"
                      ? "bg-gray-400"
                      : "bg-blue-500"
                  }`}
                ></div>
                <span className="text-sm">
                  {statusKey === "online"
                    ? "Đang online"
                    : statusKey === "away"
                    ? "Đang away"
                    : statusKey === "offline"
                    ? "Offline"
                    : "Đang order"}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium"
          onClick={resetFilters}
        >
          Đặt lại
        </button>
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
          onClick={applyFilters}
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
};

export default CustomerFilters;
