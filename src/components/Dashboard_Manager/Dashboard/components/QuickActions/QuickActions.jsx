import React, { useState, useRef, useEffect } from "react";
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
  Trash2,
  RotateCcw,
  Pencil,
  MinusCircle,
} from "lucide-react";
import "./QuickActions.scss";

// Danh sách mặc định ban đầu
const DEFAULT_ACTIONS = [
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
];

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
  const [actions, setActions] = useState(DEFAULT_ACTIONS);

  // States cho UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // Chế độ xóa

  // States cho Form
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [customLabel, setCustomLabel] = useState("");

  const menuRef = useRef(null);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter items cho modal (loại bỏ những cái đã có)
  const filteredPages = AVAILABLE_PAGES.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !actions.some((a) => a.id === p.id) // Ẩn những cái đã thêm
  );

  // --- HANDLERS ---

  const handleAddAction = () => {
    if (!selectedPageId) return;
    const pageConfig = AVAILABLE_PAGES.find((p) => p.id === selectedPageId);

    if (pageConfig) {
      const newAction = {
        ...pageConfig,
        name: customLabel || pageConfig.name,
      };
      setActions([...actions, newAction]);
      closeModal();
    }
  };

  const handleRemoveAction = (e, idToRemove) => {
    e.stopPropagation(); // Ngăn click vào card
    setActions(actions.filter((a) => a.id !== idToRemove));
  };

  const handleResetDefaults = () => {
    setActions(DEFAULT_ACTIONS);
    setIsEditMode(false);
    setIsMenuOpen(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPageId(null);
    setCustomLabel("");
    setSearchTerm("");
  };

  return (
    <div className="dashboard-widget quick-actions">
      {/* --- HEADER --- */}
      <div className="widget-header">
        <h3 className="widget-title">Truy Cập Nhanh</h3>

        {/* Dropdown Menu Container */}
        <div className="header-menu-container" ref={menuRef}>
          <button
            className={`btn-icon-more ${isMenuOpen ? "active" : ""}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MoreHorizontal size={20} />
          </button>

          {/* Menu Dropdown */}
          {isMenuOpen && (
            <div className="dropdown-menu fade-in">
              <button
                className={`menu-item ${isEditMode ? "active" : ""}`}
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setIsMenuOpen(false);
                }}
              >
                <Pencil size={14} />
                {isEditMode ? "Tắt sửa" : "Chỉnh sửa"}
              </button>
              <button
                className="menu-item text-danger"
                onClick={handleResetDefaults}
              >
                <RotateCcw size={14} /> Khôi phục mặc định
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- GRID LIST --- */}
      <div className="actions-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className={`action-card ${action.color} ${
                isEditMode ? "shaking" : ""
              }`}
              disabled={isEditMode} // Không cho click chuyển trang khi đang sửa
            >
              {/* Nút xóa (chỉ hiện khi Edit Mode) */}
              {isEditMode && (
                <div
                  className="delete-badge fade-in"
                  onClick={(e) => handleRemoveAction(e, action.id)}
                >
                  <MinusCircle size={20} fill="#ef4444" stroke="white" />
                </div>
              )}

              <div className="icon-wrapper">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <span className="action-label">{action.name}</span>

              {!isEditMode && (
                <div className="hover-arrow">
                  <ArrowUpRight size={16} />
                </div>
              )}
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
          <span className="action-label">Thêm</span>
        </button>
      </div>

      {/* --- MODAL --- */}
      {/* Sử dụng Portal hoặc CSS Fixed để đảm bảo modal luôn nằm trên cùng */}
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
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm chức năng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="selection-grid custom-scrollbar">
                {filteredPages.length > 0 ? (
                  filteredPages.map((page) => (
                    <div
                      key={page.id}
                      className={`selection-item ${
                        selectedPageId === page.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedPageId(page.id);
                        setCustomLabel(page.name);
                      }}
                    >
                      <div className={`mini-icon ${page.color}`}>
                        <page.icon size={18} />
                      </div>
                      <span className="item-name">{page.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    Không tìm thấy hoặc đã thêm hết
                  </div>
                )}
              </div>

              {selectedPageId && (
                <div className="custom-name-input fade-in">
                  <label>Tên hiển thị</label>
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
                Hủy
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
