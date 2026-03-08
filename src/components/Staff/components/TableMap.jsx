import React, { useState } from "react";
import {
  Users,
  Star,
  ArrowRightLeft,
  Combine,
  Receipt,
  Info,
} from "lucide-react";
import { MOCK_FLOORS } from "../data/mockData";
import "./TableMap.scss";

export default function TableMap({
  tables,
  onSelect,
  selectedTable,
  onTableAction,
}) {
  const [floor, setFloor] = useState(MOCK_FLOORS[0]);

  // Lọc bàn theo tầng
  const currentFloorTables = tables.filter((t) => t.floor === floor);

  // Thống kê nhanh
  const servingCount = currentFloorTables.filter(
    (t) => t.status !== "empty",
  ).length;

  return (
    <div className="staff-pos-tables">
      {/* Tiêu đề & Thống kê */}
      <div className="floor-header">
        <div className="floor-stats">
          <h3>Sơ đồ bàn</h3>
          <p>
            Đang phục vụ:{" "}
            <strong>
              {servingCount}/{currentFloorTables.length}
            </strong>{" "}
            bàn
          </p>
        </div>
      </div>

      {/* Chọn Tầng (Cuộn ngang) */}
      <div className="floor-selector-scroll">
        {MOCK_FLOORS.map((f) => (
          <button
            key={f}
            className={`floor-chip ${floor === f ? "active" : ""}`}
            onClick={() => setFloor(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lưới Bàn */}
      <div className="table-grid">
        {currentFloorTables.map((table) => {
          const isSelected = selectedTable?.id === table.id;

          return (
            <div
              key={table.id}
              className={`table-card-wrapper ${isSelected ? "selected" : ""} status-${table.status}`}
              onClick={() => onSelect(table)}
            >
              <div className="table-card-main">
                <div className="table-header">
                  <span className="table-name">{table.name}</span>
                  <div className="status-indicator"></div>
                </div>

                <div className="table-body">
                  <div className="guest-count">
                    <Users size={14} />
                    <span>
                      {table.guests > 0 ? `${table.guests} khách` : "Bàn trống"}
                    </span>
                  </div>

                  {table.customer && (
                    <div className="customer-tag">
                      <Star size={12} className="star-icon" />
                      <span className="truncate">{table.customer.name}</span>
                    </div>
                  )}
                </div>

                <div className="table-status-text">
                  {table.status === "empty" && "Sẵn sàng"}
                  {table.status === "serving" && "Đang phục vụ"}
                  {table.status === "checkout" && "Chờ thanh toán"}
                </div>
              </div>

              {/* Bảng Hành Động Nhanh (Chỉ hiện khi đang được chọn và bàn có khách) */}
              <div
                className={`table-quick-actions ${isSelected && table.status !== "empty" ? "expanded" : ""}`}
              >
                <div className="actions-container">
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTableAction("move");
                    }}
                  >
                    <div className="icon-wrap">
                      <ArrowRightLeft size={16} />
                    </div>
                    <span>Chuyển</span>
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTableAction("merge");
                    }}
                  >
                    <div className="icon-wrap">
                      <Combine size={16} />
                    </div>
                    <span>Gộp</span>
                  </button>
                  <button
                    className="action-btn btn-checkout"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTableAction("checkout");
                    }}
                  >
                    <div className="icon-wrap">
                      <Receipt size={16} />
                    </div>
                    <span>Tính tiền</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
