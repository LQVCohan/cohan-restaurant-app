import React, { useState } from "react";
import Card from "../../common/Card/Card";
import Button from "../../common/Button/Button";
import AllocationModal from "./AllocationModal";
import { useAllocation } from "../../../hooks/useAllocation";
import { formatPrice, formatDateTime } from "../../../utils/formatters";
import "./allocation.scss";

const AllocationList = () => {
  const {
    allocations,
    releaseAllocation,
    completeAllocation,
    getAllocationStats,
  } = useAllocation();

  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const stats = getAllocationStats();

  const filteredAllocations = allocations.filter((allocation) => {
    if (filter === "all") return true;
    return allocation.status === filter;
  });

  const handleRelease = (allocationId) => {
    if (window.confirm("Bạn có chắc chắn muốn hoàn trả nguyên liệu về kho?")) {
      const result = releaseAllocation(allocationId);
      if (result.success) {
        alert("Đã hoàn trả nguyên liệu về kho");
      }
    }
  };

  const handleComplete = (allocationId) => {
    if (window.confirm("Xác nhận đã hoàn thành chế biến món ăn này?")) {
      completeAllocation(allocationId);
      alert("Đã đánh dấu hoàn thành");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      allocated: { class: "status-allocated", text: "📋 Đã phân bổ" },
      completed: { class: "status-completed", text: "✅ Hoàn thành" },
      released: { class: "status-released", text: "↩️ Đã hoàn trả" },
    };
    return badges[status] || badges.allocated;
  };

  return (
    <div className="allocation-list">
      {/* Statistics */}
      <div className="stats-grid">
        <Card className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Tổng phân bổ</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{stats.today}</div>
          <div className="stat-label">Hôm nay</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{stats.allocated}</div>
          <div className="stat-label">Đang chờ</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{formatPrice(stats.totalCost)}</div>
          <div className="stat-label">Tổng chi phí</div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="allocated">Đã phân bổ</option>
            <option value="completed">Hoàn thành</option>
            <option value="released">Đã hoàn trả</option>
          </select>
        </div>
        <div className="toolbar-right">
          <Button onClick={() => setShowModal(true)}>➕ Phân bổ mới</Button>
        </div>
      </div>

      {/* Allocations List */}
      <div className="allocations-grid">
        {filteredAllocations.map((allocation) => {
          const statusBadge = getStatusBadge(allocation.status);

          return (
            <Card key={allocation.id} className="allocation-card">
              <div className="allocation-header">
                <div className="allocation-info">
                  <h3 className="allocation-title">
                    {allocation.recipeName} × {allocation.quantity}
                  </h3>
                  <div className="allocation-method">
                    {allocation.methodName}
                  </div>
                </div>
                <span className={`status-badge ${statusBadge.class}`}>
                  {statusBadge.text}
                </span>
              </div>

              <div className="allocation-content">
                <div className="allocation-details">
                  <div className="detail-item">
                    <span className="detail-label">Thời gian:</span>
                    <span>{formatDateTime(allocation.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Chi phí:</span>
                    <span className="cost-value">
                      {formatPrice(allocation.totalCost)}
                    </span>
                  </div>
                  {allocation.notes && (
                    <div className="detail-item">
                      <span className="detail-label">Ghi chú:</span>
                      <span>{allocation.notes}</span>
                    </div>
                  )}
                </div>

                <div className="ingredients-summary">
                  <h4>Nguyên liệu đã phân bổ:</h4>
                  <div className="ingredients-list">
                    {allocation.ingredients.map((ing, index) => (
                      <div key={index} className="ingredient-item">
                        <span>{ing.ingredientName}</span>
                        <span>
                          {ing.allocatedAmount} {ing.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {allocation.status === "allocated" && (
                  <div className="allocation-actions">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleComplete(allocation.id)}
                    >
                      ✅ Hoàn thành
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => handleRelease(allocation.id)}
                    >
                      ↩️ Hoàn trả
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredAllocations.length === 0 && (
        <Card className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>Chưa có phân bổ nào</h3>
          <p>Bắt đầu phân bổ nguyên liệu cho các món ăn của bạn</p>
          <Button onClick={() => setShowModal(true)}>
            ➕ Tạo phân bổ đầu tiên
          </Button>
        </Card>
      )}

      <AllocationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          alert("Phân bổ nguyên liệu thành công!");
        }}
      />
    </div>
  );
};

export default AllocationList;
