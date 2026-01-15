import React, { useState } from "react";
import {
  Plus,
  X,
  Search,
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  Package,
  Users,
  Truck,
  Settings,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";
import "./QuickActions.scss";

// Cấu hình danh sách trang có sẵn với màu sắc đặc trưng
const AVAILABLE_PAGES = [
  { id: "dashboard", name: "Tổng Quan", icon: LayoutDashboard, color: "blue" },
  { id: "orders", name: "Đơn Hàng", icon: ClipboardList, color: "orange" },
  { id: "kitchen", name: "Bếp & Bar", icon: ChefHat, color: "red" },
  { id: "inventory", name: "Kho Hàng", icon: Package, color: "green" },
  { id: "staff", name: "Nhân Sự", icon: Users, color: "purple" },
  { id: "shipping", name: "Vận Chuyển", icon: Truck, color: "cyan" },
  { id: "settings", name: "Cài Đặt", icon: Settings, color: "gray" },
];

const QuickActions = () => {
  // State danh sách actions hiện tại
  const [actions, setActions] = useState([
    {
      id: "orders",
      name: "Đơn Hàng",
      icon: ClipboardList,
      color: "orange",
      path: "/manager#orders",
    },
    {
      id: "kitchen",
      name: "Bếp & Bar",
      icon: ChefHat,
      color: "red",
      path: "/manager#kitchen",
    },
    {
      id: "inventory",
      name: "Kho Hàng",
      icon: Package,
      color: "green",
      path: "/manager#inventory",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [customLabel, setCustomLabel] = useState("");

  // Filter danh sách trong modal
  const filteredPages = AVAILABLE_PAGES.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddAction = () => {
    if (!selectedPageId) return;

    const pageConfig = AVAILABLE_PAGES.find((p) => p.id === selectedPageId);
    if (pageConfig) {
      const newAction = {
        ...pageConfig,
        name: customLabel || pageConfig.name, // Dùng tên tùy chỉnh nếu có
      };
      setActions([...actions, newAction]);
      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPageId(null);
    setCustomLabel("");
    setSearchTerm("");
  };

  return (
    <div className="dashboard-widget quick-actions">
      {/* Header */}
      <div className="widget-header">
        <h3 className="widget-title">Truy Cập Nhanh</h3>
        <button className="btn-icon-more">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Grid Actions */}
      <div className="actions-grid">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button key={index} className={`action-card ${action.color}`}>
              <div className="icon-wrapper">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <span className="action-label">{action.name}</span>
              <div className="hover-arrow">
                <ArrowUpRight size={16} />
              </div>
            </button>
          );
        })}

        {/* Nút Thêm Mới */}
        <button
          className="action-card add-new"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="icon-wrapper">
            <Plus size={24} />
          </div>
          <span className="action-label">Thêm Lối Tắt</span>
        </button>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fade-in">
          <div className="modal-content scale-up">
            <div className="modal-header">
              <h4>Thêm Lối Tắt Mới</h4>
              <button className="btn-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Search */}
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm chức năng hệ thống..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Grid Selection */}
              <div className="selection-grid custom-scrollbar">
                {filteredPages.map((page) => {
                  const PageIcon = page.icon;
                  const isSelected = selectedPageId === page.id;
                  return (
                    <div
                      key={page.id}
                      className={`selection-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedPageId(page.id);
                        setCustomLabel(page.name); // Auto fill tên
                      }}
                    >
                      <div className={`mini-icon ${page.color}`}>
                        <PageIcon size={18} />
                      </div>
                      <span className="item-name">{page.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Input tên tùy chỉnh (chỉ hiện khi đã chọn) */}
              {selectedPageId && (
                <div className="custom-name-input fade-in">
                  <label>Tên hiển thị trên Dashboard</label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal}>
                Hủy bỏ
              </button>
              <button
                className="btn-submit"
                disabled={!selectedPageId}
                onClick={handleAddAction}
              >
                Thêm ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;
