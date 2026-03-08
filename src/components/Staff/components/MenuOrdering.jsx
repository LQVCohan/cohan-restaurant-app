import React, { useState } from "react";
import {
  MapPin,
  UserCircle,
  AlertTriangle,
  X,
  Search,
  Plus,
  Crown,
  ChevronRight,
} from "lucide-react";
import { MOCK_MENU, MENU_CATEGORIES } from "../data/mockData";
import "./MenuOrdering.scss";

export default function MenuOrdering({
  onAdd,
  searchQuery,
  selectedTable,
  selectedCategory,
  setSelectedCategory,
  onRemoveCustomer,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [prepChoice, setPrepChoice] = useState("");
  const [serveOrder, setServeOrder] = useState("Mang ra cùng lúc");

  // Trạng thái khi chưa chọn bàn
  if (!selectedTable) {
    return (
      <div className="staff-pos-empty-state">
        <div className="empty-icon-wrapper">
          <MapPin size={40} />
        </div>
        <h3>Chưa chọn bàn</h3>
        <p>Vui lòng chọn một bàn từ Sơ đồ để bắt đầu gọi món</p>
      </div>
    );
  }

  const filteredMenu = MOCK_MENU.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === "Tất cả" || m.category === selectedCategory),
  );

  const handleConfirmAdd = () => {
    onAdd(selectedItem, prepChoice, serveOrder);
    setSelectedItem(null);
    setPrepChoice("");
    setServeOrder("Mang ra cùng lúc");
  };

  return (
    <div className="staff-pos-menu">
      {/* Banner Trạng thái Bàn */}
      <div className="table-status-banner">
        <div className="table-info">
          <span className="label">Đang Order</span>
          <span className="table-name">{selectedTable.name}</span>
        </div>
        <ChevronRight size={18} className="icon-right" />
      </div>

      {/* Thông tin Khách hàng (Thành viên) */}
      {selectedTable.customer ? (
        <div className="customer-vip-card">
          <div className="cus-header">
            <div className="cus-avatar-wrap">
              <UserCircle size={36} className="text-primary" />
            </div>
            <div className="cus-details">
              <h4>
                {selectedTable.customer.name}
                <span className="rank-badge">
                  <Crown size={12} /> {selectedTable.customer.rank}
                </span>
              </h4>
              <p>
                {selectedTable.customer.phone} • Tích lũy:{" "}
                <strong>{selectedTable.customer.points}đ</strong>
              </p>
            </div>
            <button className="btn-remove-cus" onClick={onRemoveCustomer}>
              <X size={20} />
            </button>
          </div>
          {selectedTable.customer.note && (
            <div className="cus-warning">
              <AlertTriangle size={14} />
              <span>
                <strong>Lưu ý:</strong> {selectedTable.customer.note}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="customer-empty-hint">
          <Search size={16} />
          <span>Tìm kiếm SĐT để liên kết thành viên</span>
        </div>
      )}

      {/* Thanh Lọc Danh Mục (Scroll ngang) */}
      <div className="category-scroll">
        {MENU_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filter-chip ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lưới Món Ăn (Grid 2 cột) */}
      <div className="menu-grid">
        {filteredMenu.map((item) => {
          const isOutOfStock = item.stock <= 0;
          return (
            <div
              key={item.id}
              className={`menu-item-card ${isOutOfStock ? "out-of-stock" : ""}`}
              onClick={() => !isOutOfStock && setSelectedItem(item)}
            >
              <div className="item-content">
                <h4 className="item-name">{item.name}</h4>
                <p className="item-price">{item.price.toLocaleString()}đ</p>
              </div>
              <div className="item-footer">
                <span className={`stock-badge ${isOutOfStock ? "out" : "in"}`}>
                  {isOutOfStock ? "Hết món" : `Còn ${item.stock}`}
                </span>
                {!isOutOfStock && (
                  <button className="btn-add-quick">
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sheet Modal: Chọn Option Món */}
      {selectedItem && (
        <div
          className="item-options-overlay"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="item-options-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drag-indicator">
              <div className="drag-handle"></div>
            </div>

            <div className="sheet-header">
              <div className="header-info">
                <h3>{selectedItem.name}</h3>
                <p className="price-text">
                  {selectedItem.price.toLocaleString()}đ
                </p>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedItem(null)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="sheet-body">
              {/* Nhóm Ghi chú / Cách làm */}
              <div className="option-group">
                <label className="group-label">
                  1. Cách chế biến / Ghi chú
                </label>
                <div className="chips-container">
                  {selectedItem.prep.map((p) => (
                    <button
                      key={p}
                      className={`option-chip ${prepChoice === p ? "selected" : ""}`}
                      onClick={() => setPrepChoice(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nhóm Thứ tự phục vụ */}
              <div className="option-group">
                <label className="group-label">2. Thứ tự lên món</label>
                <div className="chips-container">
                  {[
                    "Khai vị (Mang ra trước)",
                    "Mang ra cùng lúc",
                    "Tráng miệng (Mang ra sau)",
                  ].map((s) => (
                    <button
                      key={s}
                      className={`option-chip ${serveOrder === s ? "selected" : ""}`}
                      onClick={() => setServeOrder(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sheet-footer">
              <button className="btn-confirm-add" onClick={handleConfirmAdd}>
                Thêm vào Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
