import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Store,
  DollarSign,
  Upload,
  Download,
  FileText,
} from "lucide-react";

// Components
import Button from "../../../components/common/Button";
import MenuItemCard from "../../Dashboard_Manager/Menu/Components/MenuItemCard";
import StatsGrid from "../../Dashboard_Manager/Menu/Components/StatsGrid";
import CategoryStats from "../../Dashboard_Manager/Menu/Components/CategoryStats";
import ItemModal from "../../Dashboard_Manager/Menu/modals/ItemModal";
import PriceModal from "../../Dashboard_Manager/Menu/modals/PriceModal";
import DeleteModal from "../../Dashboard_Manager/Menu/modals/DeleteModal";
import Notification from "../../../components/common/Notification";

// Hooks
import { useMenuItems } from "../../../hooks/useMenuItems";
import { useNotification } from "../../../hooks/useNotification";

// Utils
import { CATEGORIES, STATUSES, VIEW_MODES } from "../../../utils/constants";

import {
  exportToExcel,
  importFromExcel,
  downloadSampleTemplate,
  validateImportData,
} from "../../../utils/excel";

// Styles
import "./MenuManagement.scss";

const MenuManagement = () => {
  const {
    menuItems,
    addItem,
    updateItem,
    deleteItem,
    toggleStatus,
    bulkUpdatePrices,
  } = useMenuItems();
  const { notification, showNotification, hideNotification } =
    useNotification();

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID);

  // Restaurant info
  const [restaurantName, setRestaurantName] = useState("Nhà Hàng Phố Cổ");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempRestaurantName, setTempRestaurantName] = useState(restaurantName);

  // Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });

  // Loading states
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filtered items with search and filters
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ingredients.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        !categoryFilter || item.category === categoryFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [menuItems, searchTerm, categoryFilter, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = menuItems.length;
    const available = menuItems.filter(
      (item) => item.status === "available"
    ).length;
    const limited = menuItems.filter(
      (item) => item.status === "limited"
    ).length;
    const unavailable = menuItems.filter(
      (item) => item.status === "unavailable"
    ).length;
    const stock = menuItems.filter((item) => item.status === "stock").length;

    return { total, available, limited, unavailable, stock };
  }, [menuItems]);

  // Category statistics
  const categoryStats = useMemo(() => {
    return Object.values(CATEGORIES)
      .map((category) => ({
        ...category,
        count: menuItems.filter((item) => item.category === category.key)
          .length,
      }))
      .filter((category) => category.count > 0); // Only show categories with items
  }, [menuItems]);

  // Restaurant name handlers
  const handleEditRestaurantName = () => {
    setTempRestaurantName(restaurantName);
    setIsEditingName(true);
  };

  const handleSaveRestaurantName = () => {
    if (tempRestaurantName.trim()) {
      setRestaurantName(tempRestaurantName.trim());
      setIsEditingName(false);
      showNotification("Đã cập nhật tên nhà hàng!", "success");
    }
  };

  const handleCancelEditName = () => {
    setTempRestaurantName(restaurantName);
    setIsEditingName(false);
  };

  // Menu item handlers
  const handleAddItem = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (id) => {
    const item = menuItems.find((i) => i.id === id);
    if (item) {
      setEditingItem(item);
      setIsItemModalOpen(true);
    }
  };

  const handleSaveItem = (itemData) => {
    try {
      if (editingItem) {
        updateItem(editingItem.id, itemData);
        showNotification(
          `Đã cập nhật món "${itemData.name}" thành công!`,
          "success"
        );
      } else {
        addItem(itemData);
        showNotification(
          `Đã thêm món "${itemData.name}" thành công!`,
          "success"
        );
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      showNotification("Có lỗi xảy ra khi lưu món ăn!", "error");
    }
  };

  const handleDeleteItem = (id) => {
    const item = menuItems.find((i) => i.id === id);
    if (item) {
      setDeleteModal({ isOpen: true, item });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteModal.item) {
      try {
        deleteItem(deleteModal.item.id);
        showNotification(
          `Đã xóa món "${deleteModal.item.name}" thành công!`,
          "success"
        );
        setDeleteModal({ isOpen: false, item: null });
      } catch (error) {
        showNotification("Có lỗi xảy ra khi xóa món ăn!", "error");
      }
    }
  };

  const handleToggleStatus = (id) => {
    const item = menuItems.find((i) => i.id === id);
    if (item) {
      try {
        toggleStatus(id);
        const newStatus =
          item.status === "available" ? "unavailable" : "available";
        const statusText =
          newStatus === "available" ? "kích hoạt" : "tạm ngừng";
        showNotification(`Đã ${statusText} món "${item.name}"`, "success");
      } catch (error) {
        showNotification("Có lỗi xảy ra khi thay đổi trạng thái!", "error");
      }
    }
  };

  // Filter handlers
  const handleFilterByStatus = (status) => {
    setStatusFilter(status);
    if (status) {
      setSearchTerm("");
      setCategoryFilter("");
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setStatusFilter("");
  };

  // Excel handlers
  const handleExportExcel = async () => {
    if (menuItems.length === 0) {
      showNotification("Không có dữ liệu để xuất!", "error");
      return;
    }

    try {
      setIsExporting(true);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
      exportToExcel(menuItems, restaurantName);
      showNotification(
        `Đã xuất ${menuItems.length} món ăn ra file Excel thành công!`,
        "success"
      );
    } catch (error) {
      showNotification("Có lỗi xảy ra khi xuất file Excel!", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!validTypes.includes(fileExtension)) {
      showNotification(
        "Vui lòng chọn file CSV hoặc Excel (.csv, .xlsx, .xls)!",
        "error"
      );
      event.target.value = "";
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification(
        "File quá lớn! Vui lòng chọn file nhỏ hơn 5MB.",
        "error"
      );
      event.target.value = "";
      return;
    }

    try {
      setIsImporting(true);
      const result = await importFromExcel(file);

      if (result.items && result.items.length > 0) {
        // Validate imported data
        const validation = validateImportData(result.items);

        if (!validation.isValid) {
          showNotification(
            `File có lỗi: ${validation.errors.slice(0, 3).join(", ")}${
              validation.errors.length > 3 ? "..." : ""
            }`,
            "error"
          );
          return;
        }

        // Add imported items
        let successCount = 0;
        result.items.forEach((item) => {
          try {
            addItem(item);
            successCount++;
          } catch (error) {
            console.warn("Failed to add item:", item.name, error);
          }
        });

        // Show success message
        showNotification(
          `Đã nhập thành công ${successCount}/${result.totalProcessed} món ăn!`,
          "success"
        );

        // Show warnings if any
        if (validation.warnings.length > 0) {
          console.warn("Import warnings:", validation.warnings);
        }

        if (result.errors && result.errors.length > 0) {
          console.warn("Import errors:", result.errors);
        }
      } else {
        showNotification("Không tìm thấy dữ liệu hợp lệ trong file!", "error");
      }
    } catch (error) {
      console.error("Import error:", error);
      showNotification(`Lỗi khi đọc file: ${error.message}`, "error");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadSampleTemplate(restaurantName);
      showNotification("Đã tải file mẫu thành công!", "success");
    } catch (error) {
      showNotification("Có lỗi xảy ra khi tải file mẫu!", "error");
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            handleAddItem();
            break;
          case "f":
            e.preventDefault();
            document.querySelector(".menu-management__search-input")?.focus();
            break;
          case "e":
            e.preventDefault();
            handleExportExcel();
            break;
          default:
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="menu-management">
      {/* Page Header */}
      <div className="menu-management__header">
        <div className="menu-management__header-content">
          <div className="menu-management__header-left">
            {isEditingName ? (
              <div className="menu-management__name-editor">
                <input
                  type="text"
                  className="menu-management__name-input"
                  value={tempRestaurantName}
                  onChange={(e) => setTempRestaurantName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRestaurantName();
                    if (e.key === "Escape") handleCancelEditName();
                  }}
                  autoFocus
                />
                <div className="menu-management__name-actions">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveRestaurantName}
                  >
                    Lưu
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCancelEditName}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="menu-management__header-info">
                <h1
                  className="menu-management__title"
                  onClick={handleEditRestaurantName}
                >
                  {restaurantName}
                  <span className="menu-management__edit-hint">✏️</span>
                </h1>
                <p className="menu-management__subtitle">
                  Quản lý thực đơn và món ăn của nhà hàng • {menuItems.length}{" "}
                  món
                </p>
              </div>
            )}
          </div>

          <div className="menu-management__header-actions">
            <Button
              variant="secondary"
              onClick={handleDownloadTemplate}
              title="Tải file mẫu Excel"
            >
              <FileText size={16} />
              File mẫu
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsPriceModalOpen(true)}
              title="Quản lý giá và khuyến mãi"
            >
              <DollarSign size={16} />
              Quản lý giá
            </Button>
            <Button
              variant="secondary"
              onClick={() => document.getElementById("importFile").click()}
              loading={isImporting}
              title="Nhập menu từ file Excel (Ctrl+I)"
            >
              <Upload size={16} />
              {isImporting ? "Đang nhập..." : "Nhập Menu"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              loading={isExporting}
              title="Xuất menu ra file Excel (Ctrl+E)"
            >
              <Download size={16} />
              {isExporting ? "Đang xuất..." : "Xuất Menu"}
            </Button>
            <Button
              variant="primary"
              onClick={handleAddItem}
              title="Thêm món mới (Ctrl+N)"
            >
              <Plus size={16} />
              Thêm Món Mới
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsGrid stats={stats} onFilterByStatus={handleFilterByStatus} />

      {/* Category Stats */}
      {categoryStats.length > 0 && <CategoryStats categories={categoryStats} />}

      {/* Controls */}
      <div className="menu-management__controls">
        <div className="menu-management__controls-content">
          <div className="menu-management__controls-left">
            <div className="menu-management__search">
              <Search className="menu-management__search-icon" size={16} />
              <input
                type="text"
                className="menu-management__search-input"
                placeholder="Tìm kiếm món ăn... (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="menu-management__search-clear"
                  onClick={() => setSearchTerm("")}
                  title="Xóa tìm kiếm"
                >
                  ×
                </button>
              )}
            </div>

            <select
              className="menu-management__filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              title="Lọc theo danh mục"
            >
              <option value="">Tất cả danh mục</option>
              {Object.values(CATEGORIES).map((category) => (
                <option key={category.key} value={category.key}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>

            <select
              className="menu-management__filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Lọc theo trạng thái"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.values(STATUSES).map((status) => (
                <option key={status.key} value={status.key}>
                  {status.name}
                </option>
              ))}
            </select>

            {(searchTerm || categoryFilter || statusFilter) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
                title="Xóa tất cả bộ lọc"
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>

          <div className="menu-management__controls-right">
            <div className="menu-management__results-count">
              {filteredItems.length} / {menuItems.length} món
            </div>
            <div className="menu-management__view-toggle">
              <button
                className={`menu-management__view-btn ${
                  viewMode === VIEW_MODES.GRID
                    ? "menu-management__view-btn--active"
                    : ""
                }`}
                onClick={() => setViewMode(VIEW_MODES.GRID)}
                title="Xem dạng lưới"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={`menu-management__view-btn ${
                  viewMode === VIEW_MODES.LIST
                    ? "menu-management__view-btn--active"
                    : ""
                }`}
                onClick={() => setViewMode(VIEW_MODES.LIST)}
                title="Xem dạng danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      {filteredItems.length === 0 ? (
        <div className="menu-management__empty-state">
          <div className="menu-management__empty-icon">
            {menuItems.length === 0 ? "🍽️" : "🔍"}
          </div>
          <h3 className="menu-management__empty-title">
            {menuItems.length === 0
              ? "Chưa có món ăn nào"
              : "Không tìm thấy món ăn"}
          </h3>
          <p className="menu-management__empty-description">
            {menuItems.length === 0
              ? "Hãy thêm món ăn đầu tiên vào menu của bạn"
              : "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"}
          </p>
          {menuItems.length === 0 ? (
            <Button variant="primary" onClick={handleAddItem}>
              <Plus size={16} />
              Thêm Món Mới
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleClearFilters}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`menu-management__menu ${
            viewMode === VIEW_MODES.LIST
              ? "menu-management__menu--list"
              : "menu-management__menu--grid"
          }`}
        >
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              viewMode={viewMode}
              onEdit={handleEditItem}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        id="importFile"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleImportExcel}
      />

      {/* Modals */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        editingItem={editingItem}
      />

      <PriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        menuItems={menuItems}
        onBulkUpdatePrices={bulkUpdatePrices}
        onShowNotification={showNotification}
      />

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleConfirmDelete}
        itemName={deleteModal.item?.name || ""}
      />

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
    </div>
  );
};

export default MenuManagement;
