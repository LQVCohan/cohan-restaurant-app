import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Download,
  FilterX,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Trash2,
  Inbox,
} from "lucide-react";

// --- Components ---
// Giả định bạn đã lưu các file này từ các bước trước
import StatsCard from "./components/StatsCard/StatsCard";
import PromotionsGrid from "./components/PromotionsGrid/PromotionsGrid";
import PromotionModal from "./components/PromotionModal/PromotionModal";

// --- Hooks ---
import { usePromotions } from "../../../hooks/usePromotions";

// --- Styles ---
import "./PromotionManagement.scss";

const PromotionManagement = () => {
  const {
    promotions,
    allPromotions,
    filters,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
  } = usePromotions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // 'list' | 'grid'
  const [activeTab, setActiveTab] = useState("all");

  // --- Derived Data (Tính toán số liệu) ---
  const statsData = useMemo(
    () => ({
      totalSavings: 12500000, // Có thể lấy từ API thực tế
      usageRate: 45,
      totalUsage: allPromotions.reduce(
        (sum, p) => sum + (p.usageCount || 0),
        0
      ),
      hotPromotions: allPromotions.filter((p) => p.usageCount > 100).length, // Ví dụ logic
    }),
    [allPromotions]
  );

  // --- Handlers ---
  const handleOpenModal = (promotion = null) => {
    setEditingPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
  };

  const handleSavePromotion = (promotionData) => {
    if (editingPromotion) {
      updatePromotion(editingPromotion.id, promotionData);
    } else {
      addPromotion(promotionData);
    }
    handleCloseModal();
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa khuyến mãi này?")) {
      deletePromotion(id);
    }
  };

  // --- Helpers UI ---
  const renderStatusBadge = (status) => {
    const map = {
      active: { label: "Đang chạy", class: "bg-green-100 text-green-700" },
      scheduled: { label: "Sắp tới", class: "bg-blue-50 text-blue-700" },
      expired: { label: "Kết thúc", class: "bg-red-50 text-red-700" },
      draft: { label: "Nháp", class: "bg-gray-100 text-gray-600" },
    };
    const conf = map[status] || map.draft;

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${conf.class}`}
      >
        {conf.label}
      </span>
    );
  };

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="promotion-manager-page">
      {/* 1. HEADER */}
      <header className="page-header">
        <div className="header-title">
          <h1>Quản Lý Khuyến Mãi</h1>
          <p>Hệ thống tối ưu doanh thu FoodHub</p>
        </div>
        <button className="restaurant-selector">
          <span>🏠 Tất cả nhà hàng</span>
          <ChevronDown size={16} />
        </button>
      </header>

      {/* 2. STATS */}
      <section className="stats-section">
        <StatsCard stats={statsData} />
      </section>

      {/* 3. MAIN CONTENT CARD */}
      <div className="main-content-card">
        {/* A. Tabs */}
        <div className="tabs-header">
          {[
            { id: "all", label: "Tất cả" },
            { id: "active", label: "Đang chạy" },
            { id: "scheduled", label: "Sắp tới" },
            { id: "expired", label: "Đã xong" },
            { id: "draft", label: "Nháp" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                // Logic filter theo tab có thể thêm ở đây hoặc useEffect
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* B. Filter Toolbar */}
        <div className="filter-toolbar">
          <div className="filter-left">
            <div className="search-box">
              <Search size={18} />
              <input type="text" placeholder="Tìm kiếm chương trình, mã..." />
            </div>

            <div className="dropdown-filter">
              <span>Tất cả loại</span>
              <ChevronDown size={14} />
            </div>

            <button className="btn-clear-filter">
              <FilterX size={14} />
              <span>Xóa lọc</span>
            </button>
          </div>

          <div className="filter-right">
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Xem danh sách"
              >
                <List size={18} />
              </button>
              <button
                className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Xem lưới"
              >
                <LayoutGrid size={18} />
              </button>
            </div>

            <button
              className="btn-secondary"
              onClick={() => alert("Đang xuất file...")}
            >
              <Download size={18} />
              <span>Xuất</span>
            </button>

            <button className="btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} />
              <span>Tạo Mới</span>
            </button>
          </div>
        </div>

        {/* C. Content Body */}
        <div className="content-body">
          {promotions.length === 0 ? (
            <div className="empty-state">
              <Inbox size={48} />
              <h3>Không tìm thấy dữ liệu</h3>
              <p>Thử thay đổi bộ lọc hoặc tạo chương trình mới.</p>
            </div>
          ) : (
            <>
              {viewMode === "grid" ? (
                // --- GRID VIEW ---
                <PromotionsGrid
                  promotions={promotions}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                  onDuplicate={duplicatePromotion}
                />
              ) : (
                // --- LIST VIEW (Table Upgrade) ---
                <div className="table-responsive">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th width="25%">Chương trình / Mã</th>
                        <th width="20%">Thời gian</th>
                        <th width="15%">Giảm giá</th>
                        <th width="15%">Hiệu quả</th>
                        <th width="10%">Trạng thái</th>
                        <th width="15%" className="text-right">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotions.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="fw-bold text-dark mb-1">
                              {item.name}
                            </div>
                            <div className="code-badge">
                              <Copy size={12} /> {item.code}
                            </div>
                          </td>
                          <td className="text-secondary text-sm">
                            <div>{formatDate(item.startDate)}</div>
                            <div className="text-xs">
                              đến {formatDate(item.endDate)}
                            </div>
                          </td>
                          <td className="text-primary font-bold">
                            {item.type === "percent"
                              ? `${item.discountValue}%`
                              : `${item.discountValue.toLocaleString()}đ`}
                          </td>
                          <td>
                            <div className="usage-bar">
                              <div className="bar-bg">
                                <div
                                  className="bar-fill"
                                  style={{
                                    width: `${Math.min(
                                      ((item.usageCount || 0) /
                                        (item.usageLimit || 100)) *
                                        100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs text-secondary mt-1 block">
                                {item.usageCount || 0} lượt dùng
                              </span>
                            </div>
                          </td>
                          <td>{renderStatusBadge(item.status)}</td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                onClick={() => duplicatePromotion(item.id)}
                                title="Nhân bản"
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                onClick={() => handleOpenModal(item)}
                                title="Sửa"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                title="Xóa"
                                className="text-danger"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* D. Pagination */}
        <div className="pagination-footer">
          <span className="showing-text">
            Hiển thị <b>{promotions.length}</b> trên{" "}
            <b>{allPromotions.length}</b> kết quả
          </span>
          <div className="pagination-controls">
            <button disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="active">1</button>
            <button>2</button>
            <button>...</button>
            <button>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. MODAL */}
      {isModalOpen && (
        <PromotionModal
          promotion={editingPromotion}
          onSave={handleSavePromotion}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
