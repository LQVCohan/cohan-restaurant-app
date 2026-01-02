import React, { useState } from "react";
import {
  PlusCircle,
  Package,
  BarChart3,
  Users,
  MessageSquare,
  Gift,
  ArrowRight,
  Plus,
  X,
  // Import thêm các icon dùng cho danh sách có sẵn
  ClipboardList,
  Settings,
  ChefHat,
  LayoutDashboard,
  Truck,
} from "lucide-react";
import "./QuickActions.scss";

// 1. CẤU HÌNH DANH SÁCH TRANG CÓ SẴN (System Config)
// Người dùng chỉ thấy "name", hệ thống dùng "path" và "icon"
const AVAILABLE_PAGES = [
  {
    id: "dashboard",
    name: "Trang Chủ (Dashboard)",
    path: "/manager#dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "orders",
    name: "Quản Lý Đơn Hàng",
    path: "/manager#orders",
    icon: ClipboardList,
  },
  {
    id: "kitchen",
    name: "Màn Hình Bếp",
    path: "/manager#kitchen",
    icon: ChefHat,
  },
  {
    id: "inventory",
    name: "Kho & Nguyên Vật Liệu",
    path: "/manager#inventory",
    icon: Package,
  },
  {
    id: "staff",
    name: "Quản Lý Nhân Viên",
    path: "/manager#staff",
    icon: Users,
  },
  {
    id: "shipping",
    name: "Giao Hàng & Ship",
    path: "/manager#shipping",
    icon: Truck,
  },
  {
    id: "settings",
    name: "Cài Đặt Hệ Thống",
    path: "/manager#settings",
    icon: Settings,
  },
];

const ActionTile = ({
  icon: Icon,
  label,
  onClick,
  variant = "secondary",
  isAddBtn = false,
}) => (
  <button
    className={`action-tile ${variant} ${isAddBtn ? "add-new-tile" : ""}`}
    onClick={onClick}
  >
    <div className="tile-content">
      <div className="icon-wrapper">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <span className="tile-label">{label}</span>
    </div>

    {variant === "secondary" && !isAddBtn && (
      <div className="hover-indicator">
        <ArrowRight size={16} />
      </div>
    )}
  </button>
);

const QuickActions = () => {
  // Danh sách actions ban đầu
  const [actions, setActions] = useState([
    {
      icon: PlusCircle,
      label: "Thêm Món Mới",
      variant: "primary",
      onClick: () => alert("Mở form thêm món..."),
    },
    {
      icon: BarChart3,
      label: "Báo Cáo Ngày",
      variant: "secondary",
      onClick: () => (window.location.href = "/manager#reports"),
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // State form: Chỉ cần lưu Page ID và Custom Label
  const [selectedPageId, setSelectedPageId] = useState(AVAILABLE_PAGES[0].id);
  const [customLabel, setCustomLabel] = useState("");

  const openModal = () => setIsModalOpen(true);

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPageId(AVAILABLE_PAGES[0].id);
    setCustomLabel("");
  };

  const handleAddAction = (e) => {
    e.preventDefault();

    // 1. Tìm thông tin trang gốc dựa trên ID người dùng chọn
    const selectedPageConfig = AVAILABLE_PAGES.find(
      (p) => p.id === selectedPageId
    );
    if (!selectedPageConfig) return;

    // 2. Tạo action mới
    const newItem = {
      icon: selectedPageConfig.icon, // Lấy icon chuẩn của trang đó
      // Nếu người dùng nhập tên khác thì lấy, không thì lấy tên mặc định
      label: customLabel || selectedPageConfig.name,
      variant: "secondary",
      onClick: () => {
        console.log("Navigating to hidden URL:", selectedPageConfig.path);
        // window.location.href = selectedPageConfig.path; // Uncomment để chạy thật
      },
    };

    setActions((prev) => [...prev, newItem]);
    closeModal();
  };

  return (
    <div className="quick-actions-wrapper fade-in">
      <div className="actions-header">
        <h3 className="actions-title">Thao Tác Nhanh</h3>
        <span className="subtitle">Lối tắt quản lý</span>
      </div>

      <div className="actions-grid">
        {actions.map((action, index) => (
          <ActionTile
            key={index}
            icon={action.icon}
            label={action.label}
            variant={action.variant}
            onClick={action.onClick}
          />
        ))}

        <ActionTile
          icon={Plus}
          label="Thêm lối tắt"
          variant="secondary"
          isAddBtn={true}
          onClick={openModal}
        />
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="qa-modal-overlay">
          <div className="qa-modal-content fade-in-up">
            <div className="modal-header">
              <h4>Thêm Thao Tác Mới</h4>
              <button className="close-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddAction}>
              {/* 1. Chọn Trang (Dropdown) */}
              <div className="form-group">
                <label>Chọn chức năng muốn thêm</label>
                <div className="select-wrapper">
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    required
                  >
                    {AVAILABLE_PAGES.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                </div>
                <small className="hint-text">
                  Hệ thống sẽ tự động liên kết đường dẫn.
                </small>
              </div>

              {/* 2. Đặt tên hiển thị (Optional) */}
              <div className="form-group">
                <label>Tên hiển thị (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder={
                    AVAILABLE_PAGES.find((p) => p.id === selectedPageId)?.name
                  }
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
                <small className="hint-text">
                  Để trống sẽ dùng tên mặc định.
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  Thêm Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;
